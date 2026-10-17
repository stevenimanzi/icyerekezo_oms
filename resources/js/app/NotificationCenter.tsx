import { useState } from 'react';
import {
    Bell,
    BellRing,
    Check,
    CheckCheck,
    Factory,
    LifeBuoy,
    Package,
    ShieldCheck,
    ShoppingCart,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import type { AppNotificationItem, Locale } from '../core/types';
import type { NotificationsState } from './hooks/useNotifications';
import './notifications.css';

const ICONS = {
    production: Factory,
    inventory: Package,
    quality: ShieldCheck,
    sales: ShoppingCart,
    support: LifeBuoy,
} as const;

export const iconFor = (item: AppNotificationItem) =>
    ICONS[(item.data.category ?? '') as keyof typeof ICONS] ?? Bell;

/** "5 min ago" in the person's language. */
export function timeAgo(iso: string, locale: Locale): string {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    const units: [number, string, string][] = [
        [86400, 'd', 'j'],
        [3600, 'h', 'h'],
        [60, 'min', 'min'],
    ];

    for (const [size, en, fr] of units) {
        if (seconds >= size) {
            const amount = Math.floor(seconds / size);

            return locale === 'en' ? `${amount} ${en} ago` : `il y a ${amount} ${fr}`;
        }
    }

    return locale === 'en' ? 'Just now' : 'À l’instant';
}

type Props = {
    state: NotificationsState;
    locale: Locale;
    onOpen: (item: AppNotificationItem) => void;
    onViewAll: () => void;
};

/** The notification drop-down: waiting work first, then messages, each one markable as read. */
export function NotificationCenter({ state, locale, onOpen, onViewAll }: Props) {
    const text = (en: string, fr: string) => (locale === 'en' ? en : fr);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const rows = state.notifications.filter((item) => !unreadOnly || !item.read_at);
    const announcements = state.announcements;

    return (
        <div
            className="top-popover nc"
            role="dialog"
            aria-label={text('Notifications', 'Notifications')}
        >
            <header className="nc-head">
                <div>
                    <strong>{text('Notifications', 'Notifications')}</strong>
                    <small>
                        {state.unreadCount
                            ? text(`${state.unreadCount} unread`, `${state.unreadCount} non lue(s)`)
                            : text('You are all caught up', 'Tout est à jour')}
                    </small>
                </div>
                <div className="nc-tools">
                    <button
                        type="button"
                        className="nc-icon"
                        onClick={state.toggleSound}
                        aria-pressed={state.sound}
                        title={
                            state.sound
                                ? text('Turn sound off', 'Couper le son')
                                : text('Turn sound on', 'Activer le son')
                        }
                    >
                        {state.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                    <button
                        type="button"
                        className="nc-icon"
                        onClick={state.markAllRead}
                        disabled={!state.unreadCount}
                        title={text('Mark all as read', 'Tout marquer comme lu')}
                    >
                        <CheckCheck size={16} />
                    </button>
                </div>
            </header>

            <div className="nc-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={!unreadOnly}
                    className={!unreadOnly ? 'active' : ''}
                    onClick={() => setUnreadOnly(false)}
                >
                    {text('All', 'Toutes')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={unreadOnly}
                    className={unreadOnly ? 'active' : ''}
                    onClick={() => setUnreadOnly(true)}
                >
                    {text('Unread', 'Non lues')}
                    {state.unreadCount > 0 && <b>{state.unreadCount}</b>}
                </button>
            </div>

            <ul className="nc-list">
                {rows.slice(0, 8).map((item) => {
                    const Icon = iconFor(item);

                    return (
                        <li key={item.id} className={`nc-item ${item.read_at ? '' : 'unread'}`}>
                            <button type="button" className="nc-open" onClick={() => onOpen(item)}>
                                <span className={`nc-badge ${item.data.category ?? 'general'}`}>
                                    <Icon size={16} />
                                </span>
                                <span className="nc-copy">
                                    <b>
                                        {item.data.title}
                                        {item.pending && <em>{text('To do', 'À faire')}</em>}
                                    </b>
                                    <span>{item.data.body}</span>
                                    {!item.pending && (
                                        <small>{timeAgo(item.created_at, locale)}</small>
                                    )}
                                </span>
                            </button>
                            {!item.read_at && (
                                <button
                                    type="button"
                                    className="nc-read"
                                    onClick={() => state.markRead(item.id)}
                                    title={text('Mark as read', 'Marquer comme lu')}
                                    aria-label={text('Mark as read', 'Marquer comme lu')}
                                >
                                    <Check size={14} />
                                </button>
                            )}
                        </li>
                    );
                })}
                {!unreadOnly &&
                    announcements.slice(0, 3).map((item) => (
                        <li key={`a${item.id}`} className="nc-item">
                            <div className="nc-open">
                                <span className="nc-badge general">
                                    <BellRing size={16} />
                                </span>
                                <span className="nc-copy">
                                    <b>{item.title}</b>
                                    <span>{item.message}</span>
                                </span>
                            </div>
                        </li>
                    ))}
                {!rows.length && (!announcements.length || unreadOnly) && (
                    <li className="nc-empty">
                        <Bell size={22} />
                        {unreadOnly
                            ? text('Nothing unread', 'Rien de non lu')
                            : text('No notifications yet', 'Aucune notification')}
                    </li>
                )}
            </ul>

            <footer className="nc-foot">
                {!state.pushSubscribed && (
                    <button type="button" onClick={state.enablePush}>
                        <BellRing size={14} />
                        {text('Enable browser alerts', 'Activer les alertes du navigateur')}
                    </button>
                )}
                <button type="button" onClick={onViewAll}>
                    {text('View all notifications', 'Voir toutes les notifications')}
                </button>
            </footer>
        </div>
    );
}

type ToastProps = {
    state: NotificationsState;
    locale: Locale;
    onOpen: (item: AppNotificationItem) => void;
};

/** Small pop-ups that slide in when something new arrives, even when the drop-down is closed. */
export function NotificationToasts({ state, locale, onOpen }: ToastProps) {
    if (!state.toasts.length) return null;

    return (
        <div className="nt-stack" role="region" aria-live="polite" aria-label="Notifications">
            {state.toasts.map(({ key, item }) => {
                const Icon = iconFor(item);

                return (
                    <div className="nt" key={key}>
                        <button type="button" className="nt-body" onClick={() => onOpen(item)}>
                            <span className={`nc-badge ${item.data.category ?? 'general'}`}>
                                <Icon size={16} />
                            </span>
                            <span className="nc-copy">
                                <b>{item.data.title}</b>
                                <span>{item.data.body}</span>
                                <small>
                                    {locale === 'en' ? 'Click to open' : 'Cliquer pour ouvrir'}
                                </small>
                            </span>
                        </button>
                        <button
                            type="button"
                            className="nt-close"
                            onClick={() => state.dismissToast(key)}
                            aria-label={locale === 'en' ? 'Dismiss' : 'Fermer'}
                        >
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
