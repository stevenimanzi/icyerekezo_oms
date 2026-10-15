import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../../core/api';
import { startPolling } from '../../core/polling';
import type { Locale } from '../../core/types';
import type { ChatText } from './text';
import type { ChatMessageRow, MessagesResponse } from './types';

type Props = {
    conversationId: number;
    group: boolean;
    locale: Locale;
    text: ChatText;
    onActivity: () => void;
};

const POLL_MS = 2500;
const LOCALES: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR' };

/** One open conversation: loads recent messages, picks up new ones every few seconds and sends instantly. */
export function MessageThread({ conversationId, group, locale, text, onActivity }: Props) {
    const [messages, setMessages] = useState<ChatMessageRow[]>([]);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [ready, setReady] = useState(false);
    const lastId = useRef(0);
    const end = useRef<HTMLDivElement | null>(null);
    const stick = useRef(true);
    const list = useRef<HTMLDivElement | null>(null);

    const append = useCallback((incoming: ChatMessageRow[]) => {
        if (!incoming.length) return;
        setMessages((current) => {
            const known = new Set(current.map((message) => message.id));

            return [...current, ...incoming.filter((message) => !known.has(message.id))];
        });
        lastId.current = Math.max(lastId.current, ...incoming.map((message) => message.id));
    }, []);

    const load = useCallback(() => {
        const after = lastId.current;

        return api<MessagesResponse>(
            `/api/chat/conversations/${conversationId}/messages${after ? `?after=${after}` : ''}`,
        )
            .then((result) => {
                append(result.messages);
                setReady(true);
                setError('');
                if (result.messages.some((message) => !message.mine)) onActivity();
            })
            .catch((reason: Error) => setError(reason.message));
    }, [conversationId, append, onActivity]);

    useEffect(() => {
        setMessages([]);
        setReady(false);
        lastId.current = 0;
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
        if (element)
            stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    };

    const send = async () => {
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            const message = await api<ChatMessageRow>(
                `/api/chat/conversations/${conversationId}/messages`,
                {
                    method: 'POST',
                    body: JSON.stringify({ body }),
                },
            );
            setDraft('');
            stick.current = true;
            append([message]);
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
                                {group && !message.mine && (
                                    <span className="tc-author">{message.user.name}</span>
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
