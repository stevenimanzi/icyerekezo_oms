import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../core/api';
import { urlBase64ToUint8Array } from '../../core/push';
import type { AppNotificationItem, AuthUser } from '../../core/types';
import { startPolling } from '../../core/polling';
import { playChime, saveSoundEnabled, soundEnabled, unlockSound } from '../../core/sound';

const ANNOUNCEMENT_REFRESH_MS = 30000;
const NOTIFICATION_REFRESH_MS = 10000;
const TOAST_MS = 9000;
const MAX_TOASTS = 3;

export type NotificationToast = { key: string; item: AppNotificationItem };

/** One key per thing the person should be told about; waiting work is told again when its number changes. */
const keyOf = (item: AppNotificationItem) =>
    item.pending ? `${item.id}:${item.data.count ?? ''}` : item.id;

export function useNotifications(user: AuthUser, onMaintenance: (message: string) => void) {
    const [announcements, setAnnouncements] = useState(user.announcements || []);
    const [notifications, setNotifications] = useState<AppNotificationItem[]>(
        user.notifications || [],
    );
    const [unreadCount, setUnreadCount] = useState(user.unread_notifications_count || 0);
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [sound, setSound] = useState(soundEnabled);
    const [toasts, setToasts] = useState<NotificationToast[]>([]);
    const told = useRef<Set<string> | null>(null);
    const soundRef = useRef(sound);
    soundRef.current = sound;

    useEffect(() => {
        const refresh = () =>
            api<{ user: AuthUser }>('/api/auth/me')
                .then((result) => setAnnouncements(result.user.announcements || []))
                .catch((reason: any) => {
                    if (reason?.status === 503) onMaintenance(reason.message);
                });
        const timer = startPolling(refresh, ANNOUNCEMENT_REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [onMaintenance]);

    useEffect(() => unlockSound(), []);

    const dismissToast = useCallback((key: string) => {
        setToasts((current) => current.filter((toast) => toast.key !== key));
    }, []);

    useEffect(() => {
        const refresh = () =>
            api<{ notifications: AppNotificationItem[]; unread_count: number }>(
                '/api/notifications',
            )
                .then((result) => {
                    const list = result.notifications || [];
                    setNotifications(list);
                    setUnreadCount(result.unread_count || 0);

                    const unread = list.filter((item) => !item.read_at);
                    const known = told.current;
                    told.current = new Set([...(known ?? []), ...unread.map(keyOf)]);
                    if (known === null) return;

                    const fresh = unread.filter((item) => !known.has(keyOf(item)));
                    if (!fresh.length) return;

                    if (soundRef.current) playChime();
                    setToasts((current) =>
                        [...fresh.map((item) => ({ key: keyOf(item), item })), ...current].slice(
                            0,
                            MAX_TOASTS,
                        ),
                    );
                    fresh.forEach((item) =>
                        window.setTimeout(() => dismissToast(keyOf(item)), TOAST_MS),
                    );
                })
                .catch(() => {});
        refresh();
        const timer = startPolling(refresh, NOTIFICATION_REFRESH_MS);
        const wake = () => {
            if (!document.hidden) refresh();
        };
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('focus', wake);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', wake);
            window.removeEventListener('focus', wake);
        };
    }, [dismissToast]);

    useEffect(() => {
        navigator.serviceWorker?.ready
            .then((registration) => registration.pushManager.getSubscription())
            .then((subscription) => setPushSubscribed(!!subscription))
            .catch(() => {});
    }, []);

    const markRead = (id: string) => {
        const target = notifications.find((item) => item.id === id);
        if (target && !target.read_at) {
            setNotifications((current) =>
                current.map((item) =>
                    item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
                ),
            );
            setUnreadCount((count) => Math.max(0, count - 1));
        }
        setToasts((current) => current.filter((toast) => toast.item.id !== id));

        return api('/api/notifications/' + id + '/read', { method: 'POST' }).catch(() => {});
    };

    const toggleSound = () => {
        const next = !sound;
        setSound(next);
        saveSoundEnabled(next);
        if (next) playChime();
    };

    const markAllRead = () =>
        api('/api/notifications/read-all', { method: 'POST' })
            .then(() => {
                setNotifications((current) =>
                    current.map((item) => ({
                        ...item,
                        read_at: item.read_at || new Date().toISOString(),
                    })),
                );
                setUnreadCount(0);
                setToasts([]);
            })
            .catch(() => {});

    const enablePush = async () => {
        try {
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;
            }
            if (Notification.permission !== 'granted') return;

            const registration = await navigator.serviceWorker.ready;
            const { public_key } = await api<{ public_key: string }>('/api/push/vapid-public-key');
            if (!public_key) return;

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
            });
            await api('/api/push/subscriptions', {
                method: 'POST',
                body: JSON.stringify(subscription.toJSON()),
            });
            setPushSubscribed(true);
        } catch {}
    };

    return {
        announcements,
        notifications,
        unreadCount,
        markRead,
        markAllRead,
        pushSubscribed,
        enablePush,
        sound,
        toggleSound,
        toasts,
        dismissToast,
    };
}

export type NotificationsState = ReturnType<typeof useNotifications>;
