import type { Locale } from '../../../../core/types';

const en = {
    hello: (name: string) =>
        `Hello ${name}. Here is what is happening in the production flow right now.`,
    updated: 'Updated',
    open: 'Open',
    attention: 'Needs your attention',
    allClear: 'Everything is up to date.',
    chartTitle: 'Pieces finished each day (last 14 days)',
    chartEmpty: 'No work was recorded in the last 14 days.',
    done: 'Done',
    damaged: 'Damaged',
    stageCards: 'Where the pieces are now',
    here: 'At this stage',
    arriving: 'On the way',
    ready: 'Ready to send',
    waitingQuality: 'Waiting for quality',
    alertArriving: (n: number) =>
        `${n} ${n === 1 ? 'delivery is' : 'deliveries are'} waiting for you to receive`,
    alertRequests: (n: number) =>
        `${n} material ${n === 1 ? 'request is' : 'requests are'} waiting for the warehouse`,
    alertHeld: (n: number) => `${n} ${n === 1 ? 'lot is' : 'lots are'} on quality hold`,
    alertFinal: (n: number) =>
        `${n} packed ${n === 1 ? 'piece waits' : 'pieces wait'} for the final quality check`,
    alertStuck: (n: number) =>
        `${n} ${n === 1 ? 'delivery has' : 'deliveries have'} waited over a day`,
    alertMissing: (n: number) =>
        `${n} ${n === 1 ? 'piece went' : 'pieces went'} missing between stages`,
    openStage: 'Open my work page',
    openFlow: 'Open the production flow',
    openRequests: 'Request materials',
};

const fr: typeof en = {
    hello: (name) =>
        `Bonjour ${name}. Voici ce qui se passe dans le flux de production en ce moment.`,
    updated: 'Mis à jour',
    open: 'Ouvrir',
    attention: 'À surveiller',
    allClear: 'Tout est à jour.',
    chartTitle: 'Pièces terminées chaque jour (14 derniers jours)',
    chartEmpty: 'Aucun travail enregistré ces 14 derniers jours.',
    done: 'Fait',
    damaged: 'Abîmé',
    stageCards: 'Où sont les pièces maintenant',
    here: 'À cette étape',
    arriving: 'En route',
    ready: 'Prêt à envoyer',
    waitingQuality: 'Attend la qualité',
    alertArriving: (n) => `${n} livraison${n === 1 ? ' attend' : 's attendent'} votre réception`,
    alertRequests: (n) =>
        `${n} demande${n === 1 ? ' de matières attend' : 's de matières attendent'} l’entrepôt`,
    alertHeld: (n) => `${n} lot${n === 1 ? ' est bloqué' : 's sont bloqués'} par la qualité`,
    alertFinal: (n) =>
        `${n} pièce${n === 1 ? ' emballée attend' : 's emballées attendent'} le contrôle qualité final`,
    alertStuck: (n) => `${n} livraison${n === 1 ? ' attend' : 's attendent'} depuis plus d’un jour`,
    alertMissing: (n) => `${n} pièce${n === 1 ? ' a disparu' : 's ont disparu'} entre deux étapes`,
    openStage: 'Ouvrir ma page de travail',
    openFlow: 'Ouvrir le flux de production',
    openRequests: 'Demander des matières',
};

export const homeText: Record<Locale, typeof en> = { en, fr };
