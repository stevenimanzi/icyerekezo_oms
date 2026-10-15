import { Bell, Megaphone } from 'lucide-react';
import { type AppNotificationItem, type AuthUser, type Locale } from '../../core/types';

export function NotificationsPage({
    announcements,
    notifications,
    locale,
    onMarkRead,
    onMarkAllRead,
    onOpen,
}: {
    announcements: NonNullable<AuthUser['announcements']>;
    notifications: AppNotificationItem[];
    locale: Locale;
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onOpen: (url?: string) => void;
}) {
    const hasUnread = notifications.some((item) => !item.read_at);
    return (
        <section className="module-page">
            <div className="module-hero">
                <div className="module-title">
                    <span>
                        <Bell size={22} />
                    </span>
                    <div>
                        <div className="eyebrow">
                            <i></i>
                            {locale === 'en' ? 'Updates' : 'Mises à jour'}
                        </div>
                        <h1>{locale === 'en' ? 'Notifications' : 'Notifications'}</h1>
                        <p>
                            {locale === 'en'
                                ? 'System messages appear here automatically.'
                                : 'Les messages système apparaissent automatiquement ici.'}
                        </p>
                    </div>
                </div>
                {hasUnread && (
                    <button className="secondary-btn" onClick={onMarkAllRead}>
                        {locale === 'en' ? 'Mark all as read' : 'Tout marquer comme lu'}
                    </button>
                )}
            </div>
            <div className="notification-page">
                {notifications.map((item) => (
                    <article
                        className="panel"
                        key={item.id}
                        style={{ cursor: 'pointer', opacity: item.read_at ? 0.65 : 1 }}
                        onClick={() => {
                            if (!item.read_at) onMarkRead(item.id);
                            onOpen(item.data.url);
                        }}
                    >
                        <span className={`notice-icon ${item.read_at ? '' : 'info'}`}>
                            <Bell size={20} />
                        </span>
                        <div>
                            <div>
                                <h3>{item.data.title}</h3>
                                {!item.read_at && (
                                    <span className="admin-status info">
                                        {locale === 'en' ? 'New' : 'Nouveau'}
                                    </span>
                                )}
                            </div>
                            <p>{item.data.body}</p>
                            <time>{new Date(item.created_at).toLocaleString()}</time>
                        </div>
                    </article>
                ))}
                {announcements.map((item) => (
                    <article className="panel" key={'a' + item.id}>
                        <span className={`notice-icon ${item.severity}`}>
                            <Megaphone size={20} />
                        </span>
                        <div>
                            <div>
                                <h3>{item.title}</h3>
                                <span className={`admin-status ${item.severity}`}>
                                    {item.severity}
                                </span>
                            </div>
                            <p>{item.message}</p>
                            <time>{new Date(item.published_at).toLocaleString()}</time>
                        </div>
                    </article>
                ))}
                {!notifications.length && !announcements.length && (
                    <div className="panel empty-state">
                        <h3>{locale === 'en' ? 'No notifications' : 'Aucune notification'}</h3>
                        <p>
                            {locale === 'en'
                                ? 'New system messages will appear here automatically.'
                                : 'Les nouveaux messages apparaîtront ici automatiquement.'}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
