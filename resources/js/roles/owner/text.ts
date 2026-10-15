import type { Locale } from '../../core/types';

const en = {
    eyebrow: 'FACTORY DATA',
    title: 'Factory performance',
    greeting: (name: string) => `Welcome, ${name}. Here is how your factory is doing.`,
    updatedAt: 'Data updated at',
    connecting: 'Connecting to live data…',
    loading: 'Loading your factory figures…',
    refresh: 'Refresh',
    periods: {
        7: 'Last 7 days',
        30: 'Last 30 days',
        90: 'Last 90 days',
        365: 'Last 12 months',
    } as Record<number, string>,
    comparedWith: (days: number) => `vs previous ${days === 365 ? '12 months' : `${days} days`}`,
    noEarlierData: 'No earlier period to compare',
    noChange: 'No change',

    attention: 'Needs your attention',
    allClear: 'All clear. Nothing needs your attention right now.',
    alerts: {
        serious_incident: (n: number) =>
            `${n} serious safety ${n === 1 ? 'incident is' : 'incidents are'} still open`,
        machines_down: (n: number) =>
            `${n} ${n === 1 ? 'machine is' : 'machines are'} out of service`,
        overdue_payments: (n: number) =>
            `${n} customer ${n === 1 ? 'order is' : 'orders are'} overdue for payment`,
        late_orders: (n: number) =>
            `${n} customer ${n === 1 ? 'order is' : 'orders are'} late for delivery`,
        late_production: (n: number) =>
            `${n} production ${n === 1 ? 'order is' : 'orders are'} behind schedule`,
        low_stock: (n: number) =>
            `${n} ${n === 1 ? 'item is' : 'items are'} at or below the reorder level`,
        expiring_batches: (n: number) =>
            `${n} ${n === 1 ? 'batch expires' : 'batches expire'} within 30 days`,
        service_overdue: (n: number) =>
            `${n} ${n === 1 ? 'machine is' : 'machines are'} overdue for service`,
        failed_inspections: (n: number) =>
            `${n} quality ${n === 1 ? 'inspection' : 'inspections'} failed this period`,
        payment_receipts: (n: number) =>
            `${n} payment ${n === 1 ? 'receipt is' : 'receipts are'} waiting for review`,
    } as Record<string, (n: number) => string>,

    kpi: {
        revenue: 'Sales value',
        orders: 'Orders received',
        units: 'Units delivered',
        output: 'Production output',
        collected: 'Cash collected',
    },

    trend: 'Growth over the last 12 months',
    trendTabs: { revenue: 'Sales value', orders: 'Orders', output: 'Output' },

    cash: {
        title: 'Money',
        billed: 'Total billed to customers',
        collected: 'Total received',
        rate: 'Share received',
        receivable: 'Still owed by customers',
        overdue: 'Overdue from customers',
        payable: 'Owed to suppliers',
        receipts: 'Payment receipts to review',
        maintenance: 'Maintenance spending',
    },
    production: {
        title: 'Production',
        planned: 'Planned',
        completed: 'Completed',
        rate: 'Plan completed',
        rejected: 'Rejected',
        rejectRate: 'Reject rate',
        waste: 'Waste',
        open: 'Open orders',
        late: 'Orders behind schedule',
        onTime: 'Finished on time',
        downtime: 'Downtime',
    },
    stock: {
        title: 'Stock',
        value: 'Stock value',
        low: 'Items to reorder',
        out: 'Items out of stock',
        expiring: 'Batches expiring in 30 days',
        tracked: 'Items tracked',
    },
    customers: {
        title: 'Customers and orders',
        received: 'Orders received',
        open: 'Orders still open',
        late: 'Orders late',
        ordered: 'Units ordered',
        delivered: 'Units delivered',
        fulfilment: 'Delivered so far',
        returns: 'Returns',
        top: 'Top customers',
        noCustomers: 'No customer orders in this period.',
        orders: (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`,
    },
    quality: {
        title: 'Quality',
        passRate: 'Inspections passed',
        before: 'Previous period',
        inspections: 'Inspections done',
        failed: 'Failed',
        conditional: 'Passed with conditions',
        rejected: 'Units rejected',
        pending: 'Waiting for inspection',
    },
    people: {
        title: 'People',
        headcount: 'Active employees',
        attendance: 'Attendance',
        late: 'Late arrivals',
        absent: 'Absences',
        leaveToday: 'On leave today',
        leavePending: 'Leave waiting for approval',
    },
    safety: {
        title: 'Safety',
        incidents: 'Incidents this period',
        open: 'Incidents still open',
        serious: 'Serious incidents open',
        days: 'Days without an incident',
        none: 'No incident recorded',
    },
    equipment: {
        title: 'Equipment',
        machines: 'Machines',
        availability: 'Available for work',
        unavailable: 'Out of service',
        overdue: 'Overdue for service',
        open: 'Open maintenance jobs',
        downtime: 'Downtime from repairs',
    },

    activity: 'Latest activity',
    viewAll: 'View all activity',
    noActivity: 'No activity recorded yet.',
    system: 'System',

    activityPage: {
        title: 'Factory activity',
        subtitle: 'Everything done in your factory, newest first.',
        search: 'Search activity…',
        allModules: 'All areas',
        when: 'When',
        who: 'Who',
        area: 'Area',
        what: 'What happened',
        loading: 'Loading activity…',
        none: 'No activity matches your search.',
        previous: 'Previous',
        next: 'Next',
        page: (page: number, last: number, total: number) =>
            `Page ${page} of ${last} · ${total} records`,
    },
    openPage: 'Open',
};

const fr: typeof en = {
    eyebrow: 'DONNÉES DE L’USINE',
    title: 'Performances de l’usine',
    greeting: (name) => `Bonjour, ${name}. Voici comment se porte votre usine.`,
    updatedAt: 'Données actualisées à',
    connecting: 'Connexion aux données…',
    loading: 'Chargement des chiffres de votre usine…',
    refresh: 'Actualiser',
    periods: {
        7: '7 derniers jours',
        30: '30 derniers jours',
        90: '90 derniers jours',
        365: '12 derniers mois',
    },
    comparedWith: (days) =>
        `par rapport aux ${days === 365 ? '12 mois' : `${days} jours`} précédents`,
    noEarlierData: 'Aucune période précédente à comparer',
    noChange: 'Aucun changement',

    attention: 'À votre attention',
    allClear: 'Tout va bien. Rien ne demande votre attention pour le moment.',
    alerts: {
        serious_incident: (n) =>
            `${n} incident${n === 1 ? ' grave de sécurité est' : 's graves de sécurité sont'} encore ouvert${n === 1 ? '' : 's'}`,
        machines_down: (n) => `${n} machine${n === 1 ? ' est' : 's sont'} hors service`,
        overdue_payments: (n) =>
            `${n} commande${n === 1 ? ' client est' : 's clients sont'} en retard de paiement`,
        late_orders: (n) =>
            `${n} commande${n === 1 ? ' client est' : 's clients sont'} en retard de livraison`,
        late_production: (n) =>
            `${n} ordre${n === 1 ? ' de production est' : 's de production sont'} en retard`,
        low_stock: (n) =>
            `${n} article${n === 1 ? ' est' : 's sont'} au niveau de réapprovisionnement ou en dessous`,
        expiring_batches: (n) => `${n} lot${n === 1 ? ' expire' : 's expirent'} dans les 30 jours`,
        service_overdue: (n) => `${n} machine${n === 1 ? ' est' : 's sont'} en retard d’entretien`,
        failed_inspections: (n) =>
            `${n} inspection${n === 1 ? '' : 's'} qualité en échec sur la période`,
        payment_receipts: (n) =>
            `${n} reçu${n === 1 ? ' de paiement attend' : 's de paiement attendent'} une vérification`,
    },

    kpi: {
        revenue: 'Valeur des ventes',
        orders: 'Commandes reçues',
        units: 'Unités livrées',
        output: 'Production réalisée',
        collected: 'Encaissements',
    },

    trend: 'Évolution sur les 12 derniers mois',
    trendTabs: { revenue: 'Valeur des ventes', orders: 'Commandes', output: 'Production' },

    cash: {
        title: 'Argent',
        billed: 'Total facturé aux clients',
        collected: 'Total reçu',
        rate: 'Part encaissée',
        receivable: 'Encore dû par les clients',
        overdue: 'En retard de la part des clients',
        payable: 'Dû aux fournisseurs',
        receipts: 'Reçus de paiement à vérifier',
        maintenance: 'Dépenses de maintenance',
    },
    production: {
        title: 'Production',
        planned: 'Prévu',
        completed: 'Réalisé',
        rate: 'Plan réalisé',
        rejected: 'Rejeté',
        rejectRate: 'Taux de rejet',
        waste: 'Pertes',
        open: 'Ordres ouverts',
        late: 'Ordres en retard',
        onTime: 'Terminés à temps',
        downtime: 'Temps d’arrêt',
    },
    stock: {
        title: 'Stock',
        value: 'Valeur du stock',
        low: 'Articles à réapprovisionner',
        out: 'Articles en rupture',
        expiring: 'Lots expirant sous 30 jours',
        tracked: 'Articles suivis',
    },
    customers: {
        title: 'Clients et commandes',
        received: 'Commandes reçues',
        open: 'Commandes encore ouvertes',
        late: 'Commandes en retard',
        ordered: 'Unités commandées',
        delivered: 'Unités livrées',
        fulfilment: 'Livré à ce jour',
        returns: 'Retours',
        top: 'Meilleurs clients',
        noCustomers: 'Aucune commande client sur cette période.',
        orders: (n) => `${n} commande${n === 1 ? '' : 's'}`,
    },
    quality: {
        title: 'Qualité',
        passRate: 'Inspections réussies',
        before: 'Période précédente',
        inspections: 'Inspections effectuées',
        failed: 'Échecs',
        conditional: 'Acceptées sous conditions',
        rejected: 'Unités rejetées',
        pending: 'En attente d’inspection',
    },
    people: {
        title: 'Personnel',
        headcount: 'Employés actifs',
        attendance: 'Présence',
        late: 'Retards',
        absent: 'Absences',
        leaveToday: 'En congé aujourd’hui',
        leavePending: 'Congés en attente d’approbation',
    },
    safety: {
        title: 'Sécurité',
        incidents: 'Incidents sur la période',
        open: 'Incidents encore ouverts',
        serious: 'Incidents graves ouverts',
        days: 'Jours sans incident',
        none: 'Aucun incident enregistré',
    },
    equipment: {
        title: 'Équipements',
        machines: 'Machines',
        availability: 'Disponibles pour le travail',
        unavailable: 'Hors service',
        overdue: 'En retard d’entretien',
        open: 'Travaux de maintenance ouverts',
        downtime: 'Arrêts pour réparations',
    },

    activity: 'Dernière activité',
    viewAll: 'Voir toute l’activité',
    noActivity: 'Aucune activité enregistrée pour le moment.',
    system: 'Système',

    activityPage: {
        title: 'Activité de l’usine',
        subtitle: 'Tout ce qui se fait dans votre usine, du plus récent au plus ancien.',
        search: 'Rechercher dans l’activité…',
        allModules: 'Tous les domaines',
        when: 'Quand',
        who: 'Qui',
        area: 'Domaine',
        what: 'Ce qui s’est passé',
        loading: 'Chargement de l’activité…',
        none: 'Aucune activité ne correspond à votre recherche.',
        previous: 'Précédent',
        next: 'Suivant',
        page: (page, last, total) => `Page ${page} sur ${last} · ${total} enregistrements`,
    },
    openPage: 'Ouvrir',
};

export const ownerText: Record<Locale, typeof en> = { en, fr };
