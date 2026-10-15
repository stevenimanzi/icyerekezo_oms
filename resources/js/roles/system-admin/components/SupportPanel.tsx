import { useEffect, useState } from 'react';
import { Status } from './Status';

export function SupportPanel({ records, reply, busy }: any) {
    const [activeId, setActiveId] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    useEffect(() => {
        if (records.length && !records.some((item: any) => item.id === activeId))
            setActiveId(records[0].id);
    }, [records, activeId]);
    const ticket = records.find((item: any) => item.id === activeId);
    const send = () => {
        const text = message.trim();
        if (!text || !ticket) return;
        reply(ticket.id, text, 'waiting_customer');
        setMessage('');
    };

    if (!records.length) {
        return (
            <div className="panel empty-state">
                <h3>No support conversations yet</h3>
                <p>Questions sent by factory users will appear here automatically.</p>
            </div>
        );
    }

    return (
        <div className="support-room panel">
            <aside className="chat-list">
                {records.map((item: any) => (
                    <button
                        key={item.id}
                        className={item.id === activeId ? 'active' : ''}
                        onClick={() => setActiveId(item.id)}
                    >
                        <span>{item.user?.name?.slice(0, 2).toUpperCase() || 'US'}</span>
                        <div>
                            <b>{item.user?.name || 'System user'}</b>
                            <small>{item.subject}</small>
                            <em>
                                {item.factory?.name || 'Platform'} ·{' '}
                                {item.status.replaceAll('_', ' ')}
                            </em>
                        </div>
                    </button>
                ))}
            </aside>
            {ticket && (
                <section className="chat-window">
                    <header>
                        <div>
                            <h3>{ticket.subject}</h3>
                            <p>
                                {ticket.user?.name} · {ticket.user?.email} ·{' '}
                                {ticket.factory?.name || 'Platform'}
                            </p>
                        </div>
                        <Status value={ticket.status} />
                    </header>
                    <div className="chat-messages">
                        {ticket.messages?.map((item: any) => (
                            <div
                                key={item.id}
                                className={
                                    item.user?.is_platform_admin
                                        ? 'chat-message admin'
                                        : 'chat-message user'
                                }
                            >
                                <b>
                                    {item.user?.is_platform_admin
                                        ? 'System administrator'
                                        : item.user?.name || 'User'}
                                </b>
                                <p>{item.message}</p>
                                <time>{new Date(item.created_at).toLocaleString()}</time>
                            </div>
                        ))}
                    </div>
                    <div className="chat-compose">
                        <textarea
                            aria-label="Reply message"
                            placeholder="Write your answer…"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                        />
                        <button
                            className="primary-btn"
                            disabled={busy || !message.trim()}
                            onClick={send}
                        >
                            Send
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
