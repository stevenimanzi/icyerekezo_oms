import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Headset, Plus, Users } from 'lucide-react';
import '../../components/ui.css';
import { Modal } from '../../components/Modal';
import { api } from '../../core/api';
import { useLiveData } from '../../core/liveData';
import type { AuthUser, Locale } from '../../core/types';
import { UserSupportChat } from '../shared/UserSupportChat';
import { MessageThread } from './MessageThread';
import { chatText } from './text';
import type { ChatOverview, ConversationRow, Person, Selection } from './types';
import './chat.css';

type Props = { user: AuthUser; locale: Locale };

const initials = (name: string) =>
    name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

/** Team chat: the factory group, private messages between staff and a private line to the system administrators. */
export default function ChatPage({ user, locale }: Props) {
    const text = chatText[locale];
    const { data, reload } = useLiveData<ChatOverview>('/api/chat/overview', 6000);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [picking, setPicking] = useState(false);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');

    const conversations = data?.conversations ?? [];
    const group = conversations.find((row) => row.type === 'group');
    const directs = conversations.filter((row) => row.type === 'direct');

    useEffect(() => {
        if (!selection && group) setSelection({ kind: 'conversation', id: group.id });
    }, [group, selection]);

    const active =
        selection?.kind === 'conversation'
            ? conversations.find((row) => row.id === selection.id)
            : undefined;

    const startChat = async (person: Person) => {
        setError('');
        try {
            const result = await api<{ id: number }>('/api/chat/direct', {
                method: 'POST',
                body: JSON.stringify({ user_id: person.id }),
            });
            setPicking(false);
            setSearch('');
            await reload();
            setSelection({ kind: 'conversation', id: result.id });
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        }
    };

    const people = useMemo(
        () =>
            (data?.people ?? []).filter((person) =>
                person.name.toLowerCase().includes(search.trim().toLowerCase()),
            ),
        [data, search],
    );

    const onActivity = useCallback(() => void reload(), [reload]);

    const row = (conversation: ConversationRow) => {
        const isGroup = conversation.type === 'group';

        return (
            <button
                key={conversation.id}
                className={`tc-row ${active?.id === conversation.id ? 'active' : ''}`}
                onClick={() => setSelection({ kind: 'conversation', id: conversation.id })}
            >
                <span className={`tc-avatar ${isGroup ? 'group' : ''}`}>
                    {isGroup ? <Users size={18} /> : initials(conversation.title)}
                </span>
                <span className="tc-row-body">
                    <b>{isGroup ? text.group : conversation.title}</b>
                    <small>
                        {conversation.last_message
                            ? `${conversation.last_message.by ? `${conversation.last_message.by}: ` : `${text.you}: `}${conversation.last_message.body}`
                            : isGroup
                              ? text.groupHint
                              : text.noMessages}
                    </small>
                </span>
                {conversation.unread > 0 && <span className="tc-count">{conversation.unread}</span>}
            </button>
        );
    };

    return (
        <section className="ui">
            <div className="page-heading">
                <div>
                    <h1>{text.title}</h1>
                    <p>{text.subtitle}</p>
                </div>
            </div>

            <article className={`panel tc ${selection ? 'open' : ''}`}>
                <aside className="tc-side">
                    <div className="tc-side-head">
                        <span>{text.title}</span>
                        <button className="secondary-btn" onClick={() => setPicking(true)}>
                            <Plus size={15} />
                            {text.newMessage}
                        </button>
                    </div>
                    <div className="tc-list">
                        <div className="tc-section">{text.members}</div>
                        {group && row(group)}
                        <div className="tc-section">{text.direct}</div>
                        {directs.map(row)}
                        <div className="tc-section">{text.support}</div>
                        <button
                            className={`tc-row ${selection?.kind === 'support' ? 'active' : ''}`}
                            onClick={() => setSelection({ kind: 'support' })}
                        >
                            <span className="tc-avatar support">
                                <Headset size={18} />
                            </span>
                            <span className="tc-row-body">
                                <b>{text.support}</b>
                                <small>{text.supportHint}</small>
                            </span>
                        </button>
                    </div>
                </aside>

                <div className="tc-main">
                    {selection?.kind === 'support' && (
                        <div className="tc-support">
                            <button
                                className="secondary-btn tc-back"
                                onClick={() => setSelection(null)}
                            >
                                <ArrowLeft size={15} />
                                {text.back}
                            </button>
                            <UserSupportChat user={user} locale={locale} />
                        </div>
                    )}
                    {selection?.kind === 'conversation' && active && (
                        <>
                            <div className="tc-head">
                                <button
                                    className="secondary-btn tc-back"
                                    onClick={() => setSelection(null)}
                                    aria-label={text.back}
                                >
                                    <ArrowLeft size={15} />
                                </button>
                                <span
                                    className={`tc-avatar ${active.type === 'group' ? 'group' : ''}`}
                                >
                                    {active.type === 'group' ? (
                                        <Users size={18} />
                                    ) : (
                                        initials(active.title)
                                    )}
                                </span>
                                <div>
                                    <b>{active.type === 'group' ? text.group : active.title}</b>
                                    <small>
                                        {active.type === 'group' ? text.groupHint : text.live}
                                    </small>
                                </div>
                            </div>
                            <MessageThread
                                key={active.id}
                                conversationId={active.id}
                                group={active.type === 'group'}
                                locale={locale}
                                text={text}
                                onActivity={onActivity}
                            />
                        </>
                    )}
                    {!selection && <div className="tc-empty">{text.loading}</div>}
                </div>
            </article>

            {picking && (
                <Modal title={text.choosePerson} narrow onClose={() => setPicking(false)}>
                    {error && <div className="ui-error">{error}</div>}
                    <input
                        placeholder={text.searchPeople}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        autoFocus
                    />
                    <div className="tc-picker">
                        {people.length ? (
                            people.map((person) => (
                                <button
                                    key={person.id}
                                    className="tc-row"
                                    onClick={() => startChat(person)}
                                >
                                    <span className="tc-avatar">{initials(person.name)}</span>
                                    <span className="tc-row-body">
                                        <b>{person.name}</b>
                                        <small>{person.role ?? ''}</small>
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="ui-empty">{text.noPeople}</div>
                        )}
                    </div>
                </Modal>
            )}
        </section>
    );
}
