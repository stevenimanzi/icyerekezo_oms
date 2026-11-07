import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../../core/api';
import { startPolling } from '../../core/polling';
import type { AuthUser, Locale } from '../../core/types';
import type { ChatText } from './text';

type Props = {
    user: AuthUser;
    locale: Locale;
    text: ChatText;
    onActivity: () => void;
};

type SupportMessageItem = {
    id: number;
    body: string;
    at: string;
    mine: boolean;
    author: string;
};

const POLL_MS = 2500;
const LOCALES: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR' };

export function SupportMessageThread({ user, locale, text, onActivity }: Props) {
    const [messages, setMessages] = useState<SupportMessageItem[]>([]);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [ready, setReady] = useState(false);
    const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
    const end = useRef<HTMLDivElement | null>(null);
    const stick = useRef(true);
    const list = useRef<HTMLDivElement | null>(null);

    const load = useCallback(async () => {
        try {
            const result: any = await api('/api/support/tickets');
            const tickets = Array.isArray(result?.data) ? result.data : [];
            const active = tickets[0] || null;

            if (active) {
                setActiveTicketId(Number(active.id));
                const allRaw = tickets
                    .flatMap((t: any) => (Array.isArray(t?.messages) ? t.messages : []))
                    .filter(Boolean)
                    .sort(
                        (a: any, b: any) =>
                            new Date(a?.created_at || 0).getTime() -
                            new Date(b?.created_at || 0).getTime(),
                    );

                const mapped: SupportMessageItem[] = allRaw.map((item: any) => {
                    const mine = Number(item.user_id) === user.id;
                    return {
                        id: Number(item.id),
                        body: String(item.message || ''),
                        at: item.created_at || new Date().toISOString(),
                        mine,
                        author: mine
                            ? user.name
                            : item.user?.name ||
                              (locale === 'en'
                                  ? 'System Administrator'
                                  : 'Administrateur système'),
                    };
                });
                setMessages(mapped);
                if (mapped.some((m) => !m.mine)) {
                    onActivity();
                }
            } else {
                setActiveTicketId(null);
                setMessages([]);
            }
            setReady(true);
            setError('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
            setReady(true);
        }
    }, [user.id, user.name, locale, onActivity]);

    useEffect(() => {
        setMessages([]);
        setReady(false);
        stick.current = true;
        void load();
        const timer = startPolling(load, POLL_MS);
        return () => window.clearInterval(timer);
    }, [load]);

    useEffect(() => {
        if (stick.current) end.current?.scrollIntoView?.({ block: 'end' });
    }, [messages]);

    const onScroll = () => {
        const element = list.current;
        if (element) {
            stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }
    };

    const send = async () => {
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true);
        setError('');
        try {
            if (activeTicketId) {
                await api(`/api/support/tickets/${activeTicketId}/reply`, {
                    method: 'POST',
                    body: JSON.stringify({ message: body }),
                });
            } else {
                await api('/api/support/tickets', {
                    method: 'POST',
                    body: JSON.stringify({
                        subject: 'Support conversation',
                        message: body,
                        category: 'general',
                        priority: 'normal',
                    }),
                });
            }
            setDraft('');
            stick.current = true;
            await load();
            onActivity();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setSending(false);
        }
    };

    const dayOf = (iso: string) =>
        new Date(iso).toLocaleDateString(LOCALES[locale], { dateStyle: 'medium' });
    const timeOf = (iso: string) =>
        new Date(iso).toLocaleTimeString(LOCALES[locale], { hour: '2-digit', minute: '2-digit' });
    const todayLabel = dayOf(new Date().toISOString());

    return (
        <>
            <div className="tc-messages" ref={list} onScroll={onScroll}>
                {error && <div className="ui-error">{error}</div>}
                {ready && !messages.length && <div className="tc-empty">{text.noMessages}</div>}
                {messages.map((message, index) => {
                    const day = dayOf(message.at);
                    const showDay = index === 0 || dayOf(messages[index - 1].at) !== day;

                    return (
                        <div key={message.id} style={{ display: 'contents' }}>
                            {showDay && (
                                <span className="tc-day">
                                    {day === todayLabel ? text.today : day}
                                </span>
                            )}
                            <div className={`tc-bubble ${message.mine ? 'mine' : ''}`}>
                                {!message.mine && (
                                    <span className="tc-author">{message.author}</span>
                                )}
                                {message.body}
                                <small>{timeOf(message.at)}</small>
                            </div>
                        </div>
                    );
                })}
                <div ref={end} />
            </div>
            <div className="tc-compose">
                <textarea
                    rows={1}
                    value={draft}
                    placeholder={text.write}
                    maxLength={2000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                        }
                    }}
                />
                <button
                    className="primary-btn"
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    title={text.hint}
                >
                    <Send size={16} />
                    {text.send}
                </button>
            </div>
        </>
    );
}
