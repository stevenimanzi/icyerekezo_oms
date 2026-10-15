import { useEffect, useRef, useState } from 'react';
import {
    Bell,
    ChevronDown,
    Languages,
    LogOut,
    Menu,
    Moon,
    Search,
    Sun,
    UserRound,
} from 'lucide-react';
import type { Labels } from '../core/labels';
import type { AuthUser, Locale } from '../core/types';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import type { NotificationsState } from './hooks/useNotifications';
import { pageKeyFromPath } from './routing';

type Props = {
    user: AuthUser;
    locale: Locale;
    labels: Labels;
    dark: boolean;
    notifications: NotificationsState;
    onLocaleChange: (locale: Locale) => void;
    onThemeChange: (dark: boolean) => void;
    onNavigate: (page: string) => void;
    onOpenMenu: () => void;
    onLogout: () => void;
};

type Popover = 'search' | 'notifications' | 'profile' | null;

export function Topbar({
    user,
    locale,
    labels,
    dark,
    notifications,
    onLocaleChange,
    onThemeChange,
    onNavigate,
    onOpenMenu,
    onLogout,
}: Props) {
    const ref = useRef<HTMLElement>(null);
    const [popover, setPopover] = useState<Popover>(null);
    const search = useGlobalSearch();
    const text = (en: string, fr: string) => (locale === 'en' ? en : fr);
    const toggle = (name: Exclude<Popover, null>) =>
        setPopover((current) => (current === name ? null : name));

    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setPopover(null);
        };
        const shortcuts = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                document.querySelector<HTMLInputElement>('.search input')?.focus();
            }
            if (event.key === 'Escape') setPopover(null);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        window.addEventListener('keydown', shortcuts);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            window.removeEventListener('keydown', shortcuts);
        };
    }, []);

    const openNotification = (item: NotificationsState['notifications'][number]) => {
        if (!item.read_at) notifications.markRead(item.id);
        setPopover(null);
        if (item.data.url) onNavigate(pageKeyFromPath(user, item.data.url));
    };

    const initials = user.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <header className="topbar" ref={ref}>
            <button className="icon-btn menu-btn" onClick={onOpenMenu} aria-label="Open menu">
                <Menu size={21} />
            </button>
            <label className="search">
                <Search size={18} />
                <input
                    aria-label={labels.search}
                    placeholder={labels.search}
                    value={search.query}
                    onChange={(event) => search.setQuery(event.target.value)}
                    onFocus={() => setPopover('search')}
                />
                <kbd>Ctrl K</kbd>
                {popover === 'search' && (
                    <div className="top-popover search-popover">
                        <strong>{text('Live search results', 'Résultats en direct')}</strong>
                        {!search.hasEnoughLetters ? (
                            <span>
                                {text('Type at least 2 letters', 'Saisissez au moins 2 lettres')}
                            </span>
                        ) : search.results.length ? (
                            search.results.map((item, index) => (
                                <button
                                    key={`${item.type}-${item.title}-${index}`}
                                    onMouseDown={() => {
                                        onNavigate(item.page);
                                        setPopover(null);
                                        search.setQuery('');
                                    }}
                                >
                                    <b>{item.title}</b>
                                    <small>
                                        {item.type} · {item.subtitle}
                                    </small>
                                </button>
                            ))
                        ) : (
                            <span>{text('No matching records', 'Aucun résultat')}</span>
                        )}
                    </div>
                )}
            </label>
            <div className="top-actions">
                <button
                    className="locale-btn"
                    onClick={() => onLocaleChange(locale === 'en' ? 'fr' : 'en')}
                >
                    <Languages size={17} />
                    <span>{locale === 'en' ? 'FR' : 'EN'}</span>
                </button>
                <button
                    className="icon-btn"
                    onClick={() => onThemeChange(!dark)}
                    aria-label="Toggle theme"
                >
                    {dark ? <Sun size={19} /> : <Moon size={19} />}
                </button>
                <div className="popover-anchor">
                    <button
                        className="icon-btn notification"
                        aria-label="Notifications"
                        onClick={() => toggle('notifications')}
                    >
                        <Bell size={19} />
                        <b>{notifications.unreadCount + notifications.announcements.length}</b>
                    </button>
                    {popover === 'notifications' && (
                        <div className="top-popover notification-menu">
                            <strong>Notifications</strong>
                            {notifications.notifications.length ? (
                                notifications.notifications.slice(0, 4).map((item) => (
                                    <span
                                        key={item.id}
                                        style={{
                                            cursor: 'pointer',
                                            opacity: item.read_at ? 0.62 : 1,
                                        }}
                                        onClick={() => openNotification(item)}
                                    >
                                        <b>{item.data.title}</b>
                                        {item.data.body}
                                    </span>
                                ))
                            ) : notifications.announcements.length ? (
                                notifications.announcements.slice(0, 4).map((item) => (
                                    <span key={item.id}>
                                        <b>{item.title}</b>
                                        {item.message}
                                    </span>
                                ))
                            ) : (
                                <span>
                                    {text('No new notifications', 'Aucune nouvelle notification')}
                                </span>
                            )}
                            {!notifications.pushSubscribed && (
                                <button onClick={notifications.enablePush}>
                                    <Bell size={14} />
                                    {text(
                                        'Enable browser notifications',
                                        'Activer les notifications',
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setPopover(null);
                                    onNavigate('notifications');
                                }}
                            >
                                {text('View all notifications', 'Voir toutes les notifications')}
                            </button>
                        </div>
                    )}
                </div>
                <div className="popover-anchor">
                    <button className="user-menu" onClick={() => toggle('profile')}>
                        <span className="avatar">{initials}</span>
                        <span className="user-copy">
                            <strong>{user.name}</strong>
                            <small>
                                {user.employee_profile?.job_title ||
                                    user.roles[0]?.name ||
                                    (user.is_platform_admin
                                        ? 'Platform administrator'
                                        : 'Team member')}
                            </small>
                        </span>
                        <ChevronDown size={16} />
                    </button>
                    {popover === 'profile' && (
                        <div className="top-popover profile-menu">
                            <button
                                onClick={() => {
                                    onNavigate('profile');
                                    setPopover(null);
                                }}
                            >
                                <UserRound size={16} />
                                <span>{text('Profile & settings', 'Profil et paramètres')}</span>
                            </button>
                            <button onClick={onLogout}>
                                <LogOut size={16} />
                                <span>{text('Sign out', 'Se déconnecter')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
