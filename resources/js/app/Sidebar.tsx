import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, LogOut, Settings, X } from 'lucide-react';
import type { Labels } from '../core/labels';
import type { AuthUser, Locale } from '../core/types';
import type { NavEntry } from './navigation';
import { Logo } from './Logo';

type Props = {
    user: AuthUser;
    locale: Locale;
    labels: Labels;
    entries: NavEntry[];
    activePage: string;
    open: boolean;
    lowStockCount: number;
    showSettings: boolean;
    showSupport: boolean;
    isOwner: boolean;
    isSchoolUser: boolean;
    switchingFactory: number | null;
    onNavigate: (page: string) => void;
    onClose: () => void;
    onSwitchFactory: (factoryId: number) => void;
    onLogout: () => void;
};

export function Sidebar(props: Props) {
    const { user, locale, labels, entries, activePage, open, lowStockCount, onNavigate, onClose } = props;
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const text = (en: string, fr: string) => (locale === 'en' ? en : fr);
    const canSwitchFactory = !user.is_platform_admin && (user.factories?.length || 0) > 1;

    useEffect(() => {
        entries.forEach((entry) => {
            if (entry.type === 'group' && entry.items.some(([page]) => page === activePage)) {
                setOpenGroups((current) => ({ ...current, [entry.key]: true }));
            }
        });
    }, [activePage, entries]);

    const go = (page: string) => {
        onNavigate(page);
        onClose();
    };

    const badge = (page: string) => {
        if (page === 'inventory' && lowStockCount > 0) {
            return <i title={text('Low-stock items that need attention', 'Articles en stock faible nécessitant une attention')}>{lowStockCount}</i>;
        }
        if (page === 'sales' && (user.pending_orders_count ?? 0) > 0) {
            return (
                <i className="bg-blue-500" title={text('Pending incoming orders', 'Commandes entrantes en attente')}>
                    {user.pending_orders_count}
                </i>
            );
        }

        return null;
    };

    const factoryCardSubtitle = user.is_platform_admin
        ? text('System administration', 'Administration système')
        : props.isSchoolUser
          ? text('School account', 'Compte scolaire')
          : canSwitchFactory
            ? text('Switch factory', "Changer d'usine")
            : props.isOwner
              ? text('Performance overview', 'Vue des performances')
              : text('Factory workspace', 'Espace usine');

    const onFactoryCardClick = () => {
        if (canSwitchFactory) {
            setSwitcherOpen((current) => !current);
            return;
        }
        onNavigate(user.is_platform_admin ? 'system-settings' : props.isSchoolUser ? 'school-profile' : props.isOwner ? 'dashboard' : 'settings');
    };

    return (
        <aside className={`sidebar ${open ? 'open' : ''}`}>
            <div className="sidebar-head">
                <Logo />
                <button className="icon-btn mobile-only" onClick={onClose} aria-label="Close menu">
                    <X size={20} />
                </button>
            </div>
            <nav>
                <p className="nav-label">{labels.general}</p>
                {entries.map((entry) =>
                    entry.type === 'item' ? (
                        <button key={entry.key} className={`nav-item ${activePage === entry.key ? 'active' : ''}`} onClick={() => go(entry.key)}>
                            <entry.item.1 size={18} />
                            <span>{entry.item[2]}</span>
                            {badge(entry.key)}
                        </button>
                    ) : (
                        <div
                            key={entry.key}
                            className={`nav-group ${openGroups[entry.key] ? 'expanded' : ''} ${entry.items.some(([page]) => activePage === page) ? 'has-active' : ''}`}
                        >
                            <button className="nav-group-toggle" onClick={() => setOpenGroups((current) => ({ ...current, [entry.key]: !current[entry.key] }))}>
                                <entry.icon size={18} />
                                <span>{entry.label}</span>
                                <ChevronDown size={14} className="nav-group-chevron" />
                            </button>
                            <div className="nav-group-children">
                                {entry.items.map(([page, Icon, label]) => (
                                    <button key={page} className={`nav-item nav-child ${activePage === page ? 'active' : ''}`} onClick={() => go(page)}>
                                        <Icon size={16} />
                                        <span>{label}</span>
                                        {badge(page)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ),
                )}
                {!user.is_platform_admin && (
                    <>
                        <p className="nav-label">{props.isOwner ? 'ASSISTANCE' : labels.management}</p>
                        {props.showSettings && (
                            <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}>
                                <Settings size={18} />
                                <span>{labels.settings}</span>
                            </button>
                        )}
                        {props.showSupport && (
                            <button className={`nav-item ${activePage === 'support' ? 'active' : ''}`} onClick={() => go('support')}>
                                <HelpCircle size={18} />
                                <span>{labels.support}</span>
                            </button>
                        )}
                    </>
                )}
            </nav>
            <div className="popover-anchor">
                <button className="factory-card" onClick={onFactoryCardClick}>
                    <div className="factory-avatar">{user.current_factory?.name.slice(0, 2).toUpperCase() || 'IC'}</div>
                    <div>
                        <strong>{user.current_factory?.name || user.system?.name || 'ICYEREKEZO OMS'}</strong>
                        <span>{factoryCardSubtitle}</span>
                    </div>
                    <ChevronRight size={17} />
                </button>
                {switcherOpen && canSwitchFactory && (
                    <div className="top-popover" style={{ bottom: 'calc(100% + 12px)', top: 'auto' }}>
                        <strong>{text('Switch factory', "Changer d'usine")}</strong>
                        {(user.factories || []).map((factory) => (
                            <button
                                key={factory.id}
                                disabled={props.switchingFactory !== null}
                                onClick={() => {
                                    if (factory.id === user.current_factory?.id) {
                                        setSwitcherOpen(false);
                                        return;
                                    }
                                    props.onSwitchFactory(factory.id);
                                }}
                                style={{ fontWeight: factory.id === user.current_factory?.id ? 700 : 500, color: factory.id === user.current_factory?.id ? 'var(--brand)' : undefined }}
                            >
                                {props.switchingFactory === factory.id ? text('Switching…', 'Changement…') : factory.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <button type="button" className="sidebar-logout-btn" onClick={props.onLogout} title={text('Sign out', 'Se déconnecter')}>
                <LogOut size={16} />
                <span>{text('Sign out', 'Se déconnecter')}</span>
            </button>
        </aside>
    );
}
