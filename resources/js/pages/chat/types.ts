export type ConversationRow = {
    id: number;
    type: 'group' | 'direct';
    title: string;
    person_id: number | null;
    unread: number;
    last_message: { body: string; at: string; by: string | null } | null;
};

export type Person = { id: number; name: string; role: string | null };

export type ChatOverview = { conversations: ConversationRow[]; people: Person[]; unread: number };

export type ChatMessageRow = {
    id: number;
    body: string;
    at: string;
    mine: boolean;
    user: { id: number; name: string | null };
};

export type MessagesResponse = { messages: ChatMessageRow[]; last_id: number };

export type Selection = { kind: 'support' } | { kind: 'conversation'; id: number };
