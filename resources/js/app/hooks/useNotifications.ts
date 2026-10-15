import { useEffect, useState } from 'react';
import { api } from '../../core/api';
import { urlBase64ToUint8Array } from '../../core/push';
import type { AppNotificationItem, AuthUser } from '../../core/types';

const ANNOUNCEMENT_REFRESH_MS = 5000;
const NOTIFICATION_REFRESH_MS = 20000;

export function useNotifications(user: AuthUser, onMaintenance: (message: string) => void) {
    const [announcements, setAnnouncements] = useState(user.announcements || []);
    const [notifications, setNotifications] = useState<AppNotificationItem[]>(
        user.notifications || [],
    );
    const [unreadCount, setUnreadCount] = useState(user.unread_notifications_count || 0);
    const [pushSubscribed, setPushSubscribed] = useState(false);

    useEffect(() => {
        const refresh = () =>
            api<{ user: AuthUser }>('/api/auth/me')
                .then((result) => setAnnouncements(result.user.announcements || []))
                .catch((reason: any) => {
                    if (reason?.status === 503) onMaintenance(reason.message);
                });
        const timer = window.setInterval(refresh, ANNOUNCEMENT_REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [onMaintenance]);

    useEffect(() => {
        const refresh = () =>
            api<{ notifications: AppNotificationItem[]; unread_count: number }>(
                '/api/notifications',
            )
                .then((result) => {
                    setNotifications(result.notifications || []);
                    setUnreadCount(result.unread_count || 0);
                })
                .catch(() => {});
        refresh();
        const timer = window.setInterval(refresh, NOTIFICATION_REFRESH_MS);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        navigator.serviceWorker?.ready
            .then((registration) => registration.pushManager.getSubscription())
            .then((subscription) => setPushSubscribed(!!subscription))
            .catch(() => {});
    }, []);

    const markRead = (id: string) =>
        api('/api/notifications/' + id + '/read', { method: 'POST' })
            .then(() => {
                setNotifications((current) =>
                    current.map((item) =>
                        item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
                    ),
                );
                setUnreadCount((count) => Math.max(0, count - 1));
            })
            .catch(() => {});

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
        } catch {
        }
    };

    return {
        announcements,
        notifications,
        unreadCount,
        markRead,
        markAllRead,
        pushSubscribed,
        enablePush,
    };
}

export type NotificationsState = ReturnType<typeof useNotifications>;
