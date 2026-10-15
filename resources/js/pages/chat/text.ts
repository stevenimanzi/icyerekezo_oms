import type { Locale } from '../../core/types';

const en = {
    title: 'Chat',
    subtitle: 'Talk with your team, message one person, or write to the system administrators.',
    support: 'System administrator',
    supportHint: 'Private help from the support team',
    group: 'Everyone',
    groupHint: 'The whole factory team',
    direct: 'Private messages',
    newMessage: 'New message',
    choosePerson: 'Start a private chat',
    searchPeople: 'Search a person',
    noPeople: 'Nobody else is in your team yet.',
    noMessages: 'No messages yet. Say hello.',
    write: 'Write a message…',
    send: 'Send',
    hint: 'Enter to send · Shift + Enter for a new line',
    you: 'You',
    today: 'Today',
    loading: 'Loading…',
    back: 'Back',
    live: 'Live',
    unreadLabel: (n: number) => `${n} new`,
    members: 'Whole team',
};

const fr: typeof en = {
    title: 'Discussion',
    subtitle: 'Parlez avec votre équipe, écrivez à une personne ou aux administrateurs du système.',
    support: 'Administrateur du système',
    supportHint: 'Aide privée de l’équipe d’assistance',
    group: 'Tout le monde',
    groupHint: 'Toute l’équipe de l’usine',
    direct: 'Messages privés',
    newMessage: 'Nouveau message',
    choosePerson: 'Démarrer une discussion privée',
    searchPeople: 'Chercher une personne',
    noPeople: 'Personne d’autre n’est encore dans votre équipe.',
    noMessages: 'Aucun message. Dites bonjour.',
    write: 'Écrivez un message…',
    send: 'Envoyer',
    hint: 'Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne',
    you: 'Vous',
    today: 'Aujourd’hui',
    loading: 'Chargement…',
    back: 'Retour',
    live: 'En direct',
    unreadLabel: (n) => `${n} nouveaux`,
    members: 'Toute l’équipe',
};

export const chatText: Record<Locale, typeof en> = { en, fr };
export type ChatText = typeof en;
