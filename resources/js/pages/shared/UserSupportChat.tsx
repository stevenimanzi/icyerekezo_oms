import { useEffect, useRef, useState } from 'react';
import { MessageSquare, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { api } from '../../core/api';
import { type AuthUser, type Locale } from '../../core/types';

export function UserSupportChat({ user, locale }: { user: AuthUser; locale: Locale }) {
    const [tickets, setTickets] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const messageEnd = useRef<HTMLDivElement | null>(null);

    const normalize = (item: any) => ({
        ...item,
        id: Number(item?.id || 0),
        subject: String(item?.subject || 'Support request'),
        ticket_number: String(item?.ticket_number || ''),
        status: String(item?.status || 'open'),
        category: String(item?.category || 'general'),
        priority: String(item?.priority || 'normal'),
        messages: Array.isArray(item?.messages) ? item.messages.filter(Boolean) : [],
    });

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const result: any = await api('/api/support/tickets');
            setTickets(Array.isArray(result?.data) ? result.data.map(normalize) : []);
            setError('');
            setLastUpdated(new Date());
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to load support messages.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const timer = window.setInterval(() => load(true), 3000);
        return () => window.clearInterval(timer);
    }, []);

    const active = tickets[0] || null;

    useEffect(() => {
        messageEnd.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }, [active?.messages?.length]);

    const send = async () => {
        const text = message.trim();
        if (!text || busy) return;
        setBusy(true);
        setError('');
        try {
            if (active) {
                await api(`/api/support/tickets/${active.id}/reply`, {
                    method: 'POST',
                    body: JSON.stringify({ message: text }),
                });
            } else {
                await api('/api/support/tickets', {
                    method: 'POST',
                    body: JSON.stringify({
                        subject: 'Support conversation',
                        message: text,
                        category: 'general',
                        priority: 'normal',
                    }),
                });
            }
            setMessage('');
            await load(true);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to send your message.');
        } finally {
            setBusy(false);
        }
    };

    const initials = (name: string) =>
        name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase() || 'U';
    const messages = active?.messages || [];
    const firstDate = messages[0]?.created_at ? new Date(messages[0].created_at) : new Date();
    return (
        <section className="module-page support-page">
            <div className="module-hero support-page-hero">
                <div className="module-title">
                    <div>
                        <div className="eyebrow">
                            <i></i>
                            {locale === 'en' ? 'SUPPORT ONLINE' : 'SUPPORT EN LIGNE'}
                        </div>
                        <h1>
                            {locale === 'en' ? 'Chat with support' : 'Discuter avec le support'}
                        </h1>
                        <p>
                            {locale === 'en'
                                ? 'Get help directly from the ICYEREKEZO system administration team.'
                                : "Obtenez de l'aide directement auprès de l'équipe ICYEREKEZO."}
                        </p>
                    </div>
                </div>
                <div className="support-actions">
                    <span className="support-live">
                        <i></i>
                        {lastUpdated
                            ? (locale === 'en' ? 'Updated ' : 'Actualisé ') +
                              lastUpdated.toLocaleTimeString()
                            : locale === 'en'
                              ? 'Connecting...'
                              : 'Connexion...'}
                    </span>
                    <button className="secondary-btn" disabled={loading} onClick={() => load()}>
                        <RefreshCw size={17} />
                        {locale === 'en' ? 'Refresh' : 'Actualiser'}
                    </button>
                </div>
            </div>
            {error && <div className="admin-alert error">{error}</div>}
            <div className="support-room user-support-room panel">
                <section
                    className="chat-window"
                    aria-label={
                        locale === 'en' ? 'Support conversation' : 'Conversation avec le support'
                    }
                >
                    <header className="support-conversation-header">
                        <div className="support-contact">
                            <div className="support-admin-avatar">
                                <MessageSquare size={22} />
                            </div>
                            <div className="support-admin-name">
                                <h3>
                                    {locale === 'en' ? 'ICYEREKEZO Support' : 'Support ICYEREKEZO'}
                                </h3>
                                <p>
                                    <i></i>
                                    {locale === 'en'
                                        ? 'System administrator online'
                                        : 'Administrateur système en ligne'}
                                </p>
                            </div>
                        </div>
                        <div className="support-private">
                            <ShieldCheck size={18} />
                            <span>
                                <b>{locale === 'en' ? 'Private support' : 'Support privé'}</b>
                                <small>
                                    {locale === 'en'
                                        ? 'Only you and support can see this chat'
                                        : 'Visible uniquement par vous et le support'}
                                </small>
                            </span>
                        </div>
                    </header>
                    <div
                        className="chat-messages professional-chat-messages"
                        role="log"
                        aria-live="polite"
                    >
                        {loading && !active ? (
                            <div className="chat-empty">
                                {locale === 'en'
                                    ? 'Loading your conversation...'
                                    : 'Chargement de votre conversation...'}
                            </div>
                        ) : messages.length ? (
                            <>
                                <div className="support-date-divider">
                                    <span>
                                        {firstDate.toLocaleDateString(undefined, {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </span>
                                </div>
                                {messages.map((item: any) => {
                                    const mine = Number(item.user_id) === user.id;
                                    const sender = mine
                                        ? user.name
                                        : item.user?.name || 'ICYEREKEZO Support';
                                    return (
                                        <div
                                            key={item.id}
                                            className={`support-message-row ${mine ? 'mine' : 'theirs'}`}
                                        >
                                            {!mine && (
                                                <div className="support-message-avatar support-avatar-admin">
                                                    IC
                                                </div>
                                            )}
                                            <div className="support-message-stack">
                                                <div className="support-message-meta">
                                                    <b>
                                                        {mine
                                                            ? locale === 'en'
                                                                ? 'You'
                                                                : 'Vous'
                                                            : sender}
                                                    </b>
                                                    <time>
                                                        {item.created_at
                                                            ? new Date(
                                                                  item.created_at,
                                                              ).toLocaleTimeString([], {
                                                                  hour: '2-digit',
                                                                  minute: '2-digit',
                                                              })
                                                            : ''}
                                                    </time>
                                                </div>
                                                <div className="support-message-bubble">
                                                    <p>{String(item.message || '')}</p>
                                                </div>
                                            </div>
                                            {mine && (
                                                <div className="support-message-avatar">
                                                    {initials(user.name)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            <div className="chat-welcome-simple">
                                <span className="welcome-support-icon">
                                    <MessageSquare size={30} />
                                </span>
                                <h3>
                                    {locale === 'en'
                                        ? 'Start a conversation'
                                        : 'Commencer une conversation'}
                                </h3>
                                <p>
                                    {locale === 'en'
                                        ? 'Write your message below. The system administrator will reply in this secure chat.'
                                        : "Écrivez votre message ci-dessous. L'administrateur système répondra dans cette discussion sécurisée."}
                                </p>
                            </div>
                        )}
                        <div ref={messageEnd} />
                    </div>
                    <form
                        className="chat-compose professional-chat-compose"
                        onSubmit={(event) => {
                            event.preventDefault();
                            send();
                        }}
                    >
                        <div className="support-input-wrap">
                            <textarea
                                aria-label={locale === 'en' ? 'Message' : 'Message'}
                                maxLength={10000}
                                rows={1}
                                placeholder={
                                    locale === 'en'
                                        ? 'Write your message here...'
                                        : 'Écrivez votre message ici...'
                                }
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                            />
                            <small>
                                {locale === 'en'
                                    ? 'Enter to send · Shift + Enter for a new line'
                                    : 'Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne'}
                            </small>
                        </div>
                        <button
                            className="support-send-btn"
                            type="submit"
                            disabled={busy || !message.trim()}
                        >
                            <span>
                                {busy
                                    ? locale === 'en'
                                        ? 'Sending'
                                        : 'Envoi'
                                    : locale === 'en'
                                      ? 'Send'
                                      : 'Envoyer'}
                            </span>
                            <Send size={19} />
                        </button>
                    </form>
                </section>
            </div>
        </section>
    );
}
