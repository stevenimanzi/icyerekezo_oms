import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    Edit3,
    Filter,
    Layers,
    Plus,
    RefreshCw,
    Scissors,
    Sparkles,
    Target,
    Trash2,
    TrendingUp,
    X,
} from 'lucide-react';

interface ProductionTargetItem {
    id: number;
    title: string;
    product_name: string;
    stage: 'cutting' | 'sewing' | 'finishing' | 'packing' | 'finished';
    target_quantity: number;
    actual_quantity: number;
    remaining_quantity: number;
    progress_percent: number;
    is_completed: boolean;
    start_date: string | null;
    end_date: string | null;
    days_left: number | null;
    daily_pace_needed: number;
    period_type: string;
    status: string;
    notes: string | null;
    created_at: string;
}

interface SummaryData {
    total_target_units: number;
    total_actual_units: number;
    total_remaining_units: number;
    overall_progress_percent: number;
    active_targets_count: number;
    completed_targets_count: number;
    total_targets_count: number;
}

interface ProductItem {
    id: number;
    name: string;
    type: string;
    color?: string;
}

const STAGE_LABELS: Record<string, { label: string; labelFr: string; color: string; bg: string }> = {
    cutting: { label: 'Cutting Stage', labelFr: 'Atelier Coupe', color: 'var(--info)', bg: '#eff6ff' },
    sewing: { label: 'Sewing Stage', labelFr: 'Atelier Couture', color: 'var(--info)', bg: '#f5f3ff' },
    finishing: { label: 'Finishing Stage', labelFr: 'Atelier Finition', color: 'var(--warn)', bg: '#fffbeb' },
    packing: { label: 'Packing Stage', labelFr: 'Atelier Emballage', color: '#0891b2', bg: '#ecfeff' },
    finished: { label: 'Finished Output', labelFr: 'Produits Finis', color: 'var(--ok)', bg: '#f0fdf4' },
};

const PERIOD_LABELS: Record<string, { en: string; fr: string }> = {
    daily: { en: 'Daily Target', fr: 'Objectif Journalier' },
    weekly: { en: 'Weekly Target', fr: 'Objectif Hebdomadaire' },
    monthly: { en: 'Monthly Target', fr: 'Objectif Mensuel' },
    batch: { en: 'Batch Target', fr: 'Objectif par Lot' },
};

export default function ProductionOperations({ locale = 'en' }: { can?: any; user?: any; locale?: string }) {
    const isFr = locale === 'fr';

    const [summary, setSummary] = useState<SummaryData>({
        total_target_units: 0,
        total_actual_units: 0,
        total_remaining_units: 0,
        overall_progress_percent: 0,
        active_targets_count: 0,
        completed_targets_count: 0,
        total_targets_count: 0,
    });
    const [targets, setTargets] = useState<ProductionTargetItem[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Filters
    const [selectedTab, setSelectedTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState<ProductionTargetItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Form inputs
    const [title, setTitle] = useState('');
    const [productName, setProductName] = useState('');
    const [stage, setStage] = useState<'cutting' | 'sewing' | 'finishing' | 'packing' | 'finished'>('finished');
    const [targetQuantity, setTargetQuantity] = useState<number | string>(100);
    const [periodType, setPeriodType] = useState('weekly');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    );
    const [notes, setNotes] = useState('');

    const fetchTargets = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        setError(null);

        try {
            const res = await fetch('/api/production/targets', {
                headers: { Accept: 'application/json' },
            });
            if (!res.ok) {
                throw new Error('Failed to load production targets.');
            }
            const data = await res.json();
            setSummary(data.summary || {});
            setTargets(data.targets || []);
            setProducts(data.products || []);
        } catch (err: any) {
            setError(err.message || 'Error loading targets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTargets();
    }, []);

    const openCreateModal = () => {
        setEditingTarget(null);
        setTitle('');
        setProductName('');
        setStage('finished');
        setTargetQuantity(100);
        setPeriodType('weekly');
        setStartDate(new Date().toISOString().slice(0, 10));
        setEndDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
        setNotes('');
        setFormError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (target: ProductionTargetItem) => {
        setEditingTarget(target);
        setTitle(target.title);
        setProductName(target.product_name === 'All Products' ? '' : target.product_name);
        setStage(target.stage);
        setTargetQuantity(target.target_quantity);
        setPeriodType(target.period_type || 'weekly');
        setStartDate(target.start_date || new Date().toISOString().slice(0, 10));
        setEndDate(target.end_date || new Date().toISOString().slice(0, 10));
        setNotes(target.notes || '');
        setFormError(null);
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!title.trim()) {
            setFormError(isFr ? 'Veuillez saisir un titre pour cet objectif.' : 'Please enter a target title.');
            return;
        }

        const qty = Number(targetQuantity);
        if (isNaN(qty) || qty <= 0) {
            setFormError(isFr ? 'La quantité cible doit être supérieure à 0.' : 'Target quantity must be greater than 0.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                title: title.trim(),
                product_name: productName.trim() || null,
                stage,
                target_quantity: qty,
                period_type: periodType,
                start_date: startDate || null,
                end_date: endDate || null,
                notes: notes.trim() || null,
            };

            const url = editingTarget
                ? `/api/production/targets/${editingTarget.id}`
                : '/api/production/targets';
            const method = editingTarget ? 'PUT' : 'POST';

            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const res = await fetch(url, {
                method,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to save target.');
            }

            setSuccessMessage(
                editingTarget
                    ? (isFr ? 'Objectif mis à jour avec succès.' : 'Target updated successfully.')
                    : (isFr ? 'Nouvel objectif de production défini avec succès.' : 'Production target set successfully.')
            );
            setTimeout(() => setSuccessMessage(null), 4000);
            setIsModalOpen(false);
            fetchTargets(true);
        } catch (err: any) {
            setFormError(err.message || 'An error occurred while saving the target.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTarget = async (id: number) => {
        const confirmMsg = isFr
            ? 'Voulez-vous vraiment supprimer cet objectif de production ?'
            : 'Are you sure you want to delete this production target?';
        if (!window.confirm(confirmMsg)) return;

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch(`/api/production/targets/${id}`, {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete target.');
            }

            setSuccessMessage(isFr ? 'Objectif supprimé.' : 'Target removed successfully.');
            setTimeout(() => setSuccessMessage(null), 4000);
            fetchTargets(true);
        } catch (err: any) {
            alert(err.message || 'Failed to delete target.');
        }
    };

    const filteredTargets = useMemo(() => {
        return targets.filter((target) => {
            // Stage / Completion tab filter
            if (selectedTab === 'completed' && !target.is_completed) return false;
            if (selectedTab !== 'all' && selectedTab !== 'completed' && target.stage !== selectedTab) {
                return false;
            }
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = target.title.toLowerCase().includes(q);
                const matchesProduct = (target.product_name || '').toLowerCase().includes(q);
                const matchesStage = target.stage.toLowerCase().includes(q);
                if (!matchesTitle && !matchesProduct && !matchesStage) return false;
            }
            return true;
        });
    }, [targets, selectedTab, searchQuery]);

    return (
        <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text)' }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '24px',
                    gap: '16px',
                    flexWrap: 'wrap',
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: '26px',
                            fontWeight: 700,
                            color: 'var(--text)',
                            margin: '0 0 6px 0',
                            letterSpacing: '-0.02em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                    >
                        <Target size={26} color="#2563eb" />
                        {isFr ? 'Planification & Objectifs de Production' : 'Production Planning & Targets'}
                    </h1>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', maxWidth: '720px' }}>
                        {isFr
                            ? 'Définissez vos objectifs de production par produit et atelier, suivez l’avancement en temps réel et mesurez le pourcentage d’atteinte.'
                            : 'Set production output targets by product and stage, monitor live factory progress, and track % achievement towards your goals in real-time.'}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => fetchTargets(true)}
                        disabled={refreshing || loading}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 16px',
                            background: 'var(--panel)',
                            border: '1px solid var(--line)',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                        {isFr ? 'Actualiser' : 'Refresh'}
                    </button>

                    <button
                        onClick={openCreateModal}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 18px',
                            background: '#2563eb',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                        }}
                    >
                        <Plus size={16} />
                        {isFr ? '+ Définir un Objectif' : '+ Set Production Target'}
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {successMessage && (
                <div
                    style={{
                        padding: '12px 18px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--ok-bg)',
                        border: '1px solid #86efac',
                        color: 'var(--ok)',
                        marginBottom: '20px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}
                >
                    <CheckCircle2 size={18} />
                    {successMessage}
                </div>
            )}

            {error && (
                <div
                    style={{
                        padding: '12px 18px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bad-bg)',
                        border: '1px solid #fca5a5',
                        color: 'var(--bad)',
                        marginBottom: '20px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}
                >
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Row 1: KPI Summary Cards */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                    marginBottom: '28px',
                }}
            >
                {/* Total Target */}
                <div
                    style={{
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                            {isFr ? 'Objectif Total' : 'Total Target Units'}
                        </span>
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'var(--info-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--info)',
                            }}
                        >
                            <Target size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', margin: '8px 0 4px 0' }}>
                        {summary.total_target_units.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>pcs</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {summary.total_targets_count} {isFr ? 'objectifs au total' : 'planned target goals'}
                    </span>
                </div>

                {/* Actual Output Reached */}
                <div
                    style={{
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                            {isFr ? 'Production Réalisée' : 'Actual Output Reached'}
                        </span>
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'var(--ok-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--ok)',
                            }}
                        >
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ok)', margin: '8px 0 4px 0' }}>
                        {summary.total_actual_units.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>pcs</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {isFr ? 'Produits fabriqués validés' : 'Completed pieces recorded'}
                    </span>
                </div>

                {/* Remaining Needed */}
                <div
                    style={{
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                            {isFr ? 'Reste à Produire' : 'Remaining Needed'}
                        </span>
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'var(--warn-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--warn)',
                            }}
                        >
                            <Clock size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warn)', margin: '8px 0 4px 0' }}>
                        {summary.total_remaining_units.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>pcs</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {isFr ? 'Pour compléter tous les objectifs' : 'Units needed to reach goals'}
                    </span>
                </div>

                {/* Overall Achievement Rate */}
                <div
                    style={{
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                            {isFr ? 'Taux d’Atteinte' : 'Overall Progress'}
                        </span>
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: '#f5f3ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--info)',
                            }}
                        >
                            <Sparkles size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', margin: '8px 0 4px 0' }}>
                        {summary.overall_progress_percent}%
                    </div>
                    {/* Visual Progress Bar */}
                    <div
                        style={{
                            width: '100%',
                            height: '6px',
                            borderRadius: '999px',
                            background: '#e2e8f0',
                            overflow: 'hidden',
                            marginTop: '8px',
                        }}
                    >
                        <div
                            style={{
                                width: `${Math.min(100, summary.overall_progress_percent)}%`,
                                height: '100%',
                                background:
                                    summary.overall_progress_percent >= 80
                                        ? '#16a34a'
                                        : summary.overall_progress_percent >= 40
                                        ? '#2563eb'
                                        : '#f59e0b',
                                transition: 'width 0.4s ease',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div
                style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                }}
            >
                {/* Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                        { key: 'all', label: isFr ? 'Tous les Objectifs' : 'All Targets' },
                        { key: 'finished', label: isFr ? 'Produits Finis' : 'Finished Goods' },
                        { key: 'cutting', label: isFr ? 'Coupe' : 'Cutting' },
                        { key: 'sewing', label: isFr ? 'Couture' : 'Sewing' },
                        { key: 'finishing', label: isFr ? 'Finition' : 'Finishing' },
                        { key: 'packing', label: isFr ? 'Emballage' : 'Packing' },
                        { key: 'completed', label: isFr ? 'Atteints (100%)' : 'Achieved (100%)' },
                    ].map((tab) => {
                        const isActive = selectedTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setSelectedTab(tab.key)}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: isActive ? '#2563eb' : 'var(--soft)',
                                    color: isActive ? '#ffffff' : 'var(--muted)',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Search */}
                <div style={{ minWidth: '220px', maxWidth: '320px', width: '100%' }}>
                    <input
                        type="text"
                        placeholder={isFr ? 'Filtrer par titre ou produit...' : 'Filter targets or product...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '13px',
                            border: '1px solid var(--line)',
                            borderRadius: '8px',
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            {/* Target Cards Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: '18px',
                    marginBottom: '32px',
                }}
            >
                {filteredTargets.map((target) => {
                    const stageMeta = STAGE_LABELS[target.stage] || STAGE_LABELS.finished;
                    const periodMeta = PERIOD_LABELS[target.period_type] || { en: 'Target', fr: 'Objectif' };
                    const isPassed = target.is_completed;

                    return (
                        <div
                            key={target.id}
                            style={{
                                background: 'var(--panel)',
                                border: '1px solid var(--line)',
                                borderRadius: '12px',
                                padding: '20px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                            }}
                        >
                            {/* Card Top */}
                            <div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '10px',
                                        gap: '8px',
                                    }}
                                >
                                    <div>
                                        <h3
                                            style={{
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                color: 'var(--text)',
                                                margin: '0 0 4px 0',
                                            }}
                                        >
                                            {target.title}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span
                                                style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: stageMeta.bg,
                                                    color: stageMeta.color,
                                                }}
                                            >
                                                {isFr ? stageMeta.labelFr : stageMeta.label}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: 'var(--soft)',
                                                    color: 'var(--text)',
                                                }}
                                            >
                                                {target.product_name || (isFr ? 'Tous les produits' : 'All Products')}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: 'var(--soft)',
                                                    color: 'var(--muted)',
                                                    border: '1px solid var(--line)',
                                                }}
                                            >
                                                {isFr ? periodMeta.fr : periodMeta.en}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    {isPassed ? (
                                        <span
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: 'var(--ok-bg)',
                                                color: 'var(--ok)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <CheckCircle2 size={12} />
                                            {isFr ? 'Atteint' : 'Achieved'}
                                        </span>
                                    ) : (
                                        <span
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: 'var(--info-bg)',
                                                color: 'var(--info)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {isFr ? 'En cours' : 'In Progress'}
                                        </span>
                                    )}
                                </div>

                                {target.notes && (
                                    <p
                                        style={{
                                            fontSize: '12px',
                                            color: 'var(--muted)',
                                            margin: '0 0 14px 0',
                                            lineHeight: '1.4',
                                        }}
                                    >
                                        {target.notes}
                                    </p>
                                )}

                                {/* Progress Metrics */}
                                <div style={{ margin: '16px 0 12px 0' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'baseline',
                                            marginBottom: '6px',
                                        }}
                                    >
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                                            {isFr ? 'Avancement vers l’objectif' : 'Progress Towards Target'}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                color: isPassed ? 'var(--ok)' : 'var(--info)',
                                            }}
                                        >
                                            {target.progress_percent}%
                                        </span>
                                    </div>

                                    {/* Progress Meter Bar */}
                                    <div
                                        style={{
                                            width: '100%',
                                            height: '8px',
                                            borderRadius: '999px',
                                            background: 'var(--soft)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: `${target.progress_percent}%`,
                                                height: '100%',
                                                background:
                                                    isPassed
                                                        ? '#16a34a'
                                                        : target.progress_percent >= 50
                                                        ? '#2563eb'
                                                        : '#f59e0b',
                                                borderRadius: '999px',
                                                transition: 'width 0.3s ease',
                                            }}
                                        />
                                    </div>

                                    {/* Breakdown: Output vs Target */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: '12px',
                                            color: 'var(--muted)',
                                            marginTop: '8px',
                                        }}
                                    >
                                        <span>
                                            <b>{target.actual_quantity.toLocaleString()}</b> / {target.target_quantity.toLocaleString()} pcs
                                        </span>
                                        <span>
                                            {isPassed ? (
                                                <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                                                    {isFr ? 'Objectif atteint !' : 'Goal reached!'}
                                                </span>
                                            ) : (
                                                <span>
                                                    <b>{target.remaining_quantity.toLocaleString()}</b> {isFr ? 'restants' : 'remaining'}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer: Deadlines and Actions */}
                            <div
                                style={{
                                    borderTop: '1px solid #f1f5f9',
                                    paddingTop: '12px',
                                    marginTop: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                }}
                            >
                                <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} />
                                    {target.end_date ? (
                                        <span>
                                            {isFr ? 'Échéance: ' : 'Due: '}
                                            <b>{target.end_date}</b>
                                            {target.days_left !== null && !isPassed && (
                                                <span style={{ marginLeft: '4px', color: target.days_left <= 2 ? 'var(--bad)' : 'var(--muted)' }}>
                                                    ({target.days_left} {isFr ? 'j restants' : 'd left'})
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span>{isFr ? 'Continu' : 'Ongoing target'}</span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                        onClick={() => openEditModal(target)}
                                        title={isFr ? 'Modifier' : 'Edit target'}
                                        style={{
                                            padding: '5px 8px',
                                            background: 'var(--soft)',
                                            border: '1px solid var(--line)',
                                            borderRadius: '6px',
                                            color: 'var(--muted)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Edit3 size={13} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTarget(target.id)}
                                        title={isFr ? 'Supprimer' : 'Delete target'}
                                        style={{
                                            padding: '5px 8px',
                                            background: 'var(--bad-bg)',
                                            border: '1px solid #fecaca',
                                            borderRadius: '6px',
                                            color: 'var(--bad)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredTargets.length === 0 && !loading && (
                <div
                    style={{
                        background: 'var(--panel)',
                        border: '1px dashed var(--line)',
                        borderRadius: '12px',
                        padding: '48px 24px',
                        textAlign: 'center',
                        color: 'var(--muted)',
                    }}
                >
                    <Target size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px 0' }}>
                        {isFr ? 'Aucun objectif trouvé' : 'No production targets found'}
                    </h3>
                    <p style={{ fontSize: '13px', margin: '0 0 16px 0' }}>
                        {isFr
                            ? 'Définissez votre premier objectif de production pour suivre les performances de l’usine.'
                            : 'Set your first production target to begin tracking output and reaching goals.'}
                    </p>
                    <button
                        onClick={openCreateModal}
                        style={{
                            padding: '8px 16px',
                            background: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        {isFr ? '+ Définir un Objectif' : '+ Set Production Target'}
                    </button>
                </div>
            )}

            {/* Detailed Planning Table */}
            {targets.length > 0 && (
                <div
                    style={{
                        background: 'var(--panel)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                >
                    <div
                        style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--line)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                            {isFr ? 'Tableau Récapitulatif des Objectifs' : 'Production Targets Overview'}
                        </h2>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {targets.length} {isFr ? 'objectifs au total' : 'total goals'}
                        </span>
                    </div>

                    <div style={{ overflowX: 'auto', width: '100%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: 'var(--soft)', borderBottom: '1px solid var(--line)' }}>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? 'Objectif' : 'Target Goal'}
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? 'Produit & Atelier' : 'Product & Stage'}
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? 'Quantité Cible' : 'Target Qty'}
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? 'Réalisé' : 'Actual Reached'}
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? 'Reste à faire' : 'Remaining'}
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? '% d’Atteinte' : '% Progress'}
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? 'Échéance' : 'Deadline'}
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--muted)' }}>
                                        {isFr ? 'Actions' : 'Actions'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {targets.map((t) => {
                                    const stageMeta = STAGE_LABELS[t.stage] || STAGE_LABELS.finished;
                                    const isPassed = t.is_completed;
                                    return (
                                        <tr
                                            key={t.id}
                                            style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background 0.15s ease',
                                            }}
                                        >
                                            <td style={{ textAlign: 'left', padding: '12px 18px' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t.title}</div>
                                                {t.notes && (
                                                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                                        {t.notes}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 18px' }}>
                                                <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                                                    {t.product_name || (isFr ? 'Tous les produits' : 'All Products')}
                                                </div>
                                                <span
                                                    style={{
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        background: stageMeta.bg,
                                                        color: stageMeta.color,
                                                        display: 'inline-block',
                                                        marginTop: '3px',
                                                    }}
                                                >
                                                    {isFr ? stageMeta.labelFr : stageMeta.label}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--text)' }}>
                                                {t.target_quantity.toLocaleString()} pcs
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, color: 'var(--ok)' }}>
                                                {t.actual_quantity.toLocaleString()} pcs
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 18px', color: isPassed ? 'var(--ok)' : 'var(--warn)', fontWeight: 500 }}>
                                                {isPassed ? (isFr ? '0 (Atteint)' : '0 (Reached)') : `${t.remaining_quantity.toLocaleString()} pcs`}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 18px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div
                                                        style={{
                                                            width: '60px',
                                                            height: '6px',
                                                            borderRadius: '999px',
                                                            background: '#e2e8f0',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: `${t.progress_percent}%`,
                                                                height: '100%',
                                                                background: isPassed ? '#16a34a' : '#2563eb',
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        style={{
                                                            fontWeight: 700,
                                                            color: isPassed ? 'var(--ok)' : 'var(--info)',
                                                            fontSize: '12px',
                                                        }}
                                                    >
                                                        {t.progress_percent}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 18px', color: 'var(--muted)' }}>
                                                {t.end_date || '—'}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 18px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <button
                                                        onClick={() => openEditModal(t)}
                                                        title="Edit"
                                                        style={{
                                                            padding: '4px 6px',
                                                            background: 'var(--soft)',
                                                            border: '1px solid var(--line)',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            color: 'var(--muted)',
                                                        }}
                                                    >
                                                        <Edit3 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTarget(t.id)}
                                                        title="Delete"
                                                        style={{
                                                            padding: '4px 6px',
                                                            background: 'var(--bad-bg)',
                                                            border: '1px solid #fecaca',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            color: 'var(--bad)',
                                                        }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Target Modal (Create or Edit) */}
            {isModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(15, 23, 42, 0.55)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '16px',
                    }}
                >
                    <div
                        style={{
                            background: 'var(--panel)',
                            borderRadius: '16px',
                            maxWidth: '560px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            style={{
                                padding: '18px 24px',
                                borderBottom: '1px solid var(--line)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                                {editingTarget
                                    ? (isFr ? 'Modifier l’Objectif' : 'Edit Production Target')
                                    : (isFr ? 'Définir un Nouvel Objectif' : 'Set New Production Target')}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleFormSubmit} style={{ padding: '24px' }}>
                            {formError && (
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        background: 'var(--bad-bg)',
                                        border: '1px solid #fecaca',
                                        borderRadius: '8px',
                                        color: 'var(--bad)',
                                        fontSize: '13px',
                                        marginBottom: '16px',
                                    }}
                                >
                                    {formError}
                                </div>
                            )}

                            {/* Title */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                    {isFr ? 'Titre de l’Objectif *' : 'Target Title *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={isFr ? 'Ex: Objectif Chemises Semaine 45' : 'e.g. Weekly Shirts Target'}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        border: '1px solid var(--line)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* Product and Stage */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                        {isFr ? 'Produit Cible' : 'Target Product'}
                                    </label>
                                    <select
                                        value={productName}
                                        onChange={(e) => setProductName(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            border: '1px solid var(--line)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            background: 'var(--panel)',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        <option value="">{isFr ? 'Tous les produits' : 'All Products'}</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.name}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                        {isFr ? 'Atelier / Étape *' : 'Target Stage *'}
                                    </label>
                                    <select
                                        value={stage}
                                        onChange={(e) => setStage(e.target.value as any)}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            border: '1px solid var(--line)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            background: 'var(--panel)',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        <option value="finished">{isFr ? 'Produits Finis (Sortie Finale)' : 'Finished Output (Final)'}</option>
                                        <option value="cutting">{isFr ? 'Coupe (Pièces coupées)' : 'Cutting Stage'}</option>
                                        <option value="sewing">{isFr ? 'Couture (Pièces cousues)' : 'Sewing Stage'}</option>
                                        <option value="finishing">{isFr ? 'Finition (Pièces finies)' : 'Finishing Stage'}</option>
                                        <option value="packing">{isFr ? 'Emballage (Pièces emballées)' : 'Packing Stage'}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Quantity and Period */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                        {isFr ? 'Quantité Cible (pcs) *' : 'Target Quantity (pcs) *'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={targetQuantity}
                                        onChange={(e) => setTargetQuantity(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            border: '1px solid var(--line)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                        {isFr ? 'Période' : 'Period Type'}
                                    </label>
                                    <select
                                        value={periodType}
                                        onChange={(e) => setPeriodType(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            border: '1px solid var(--line)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            background: 'var(--panel)',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        <option value="daily">{isFr ? 'Journalier' : 'Daily'}</option>
                                        <option value="weekly">{isFr ? 'Hebdomadaire' : 'Weekly'}</option>
                                        <option value="monthly">{isFr ? 'Mensuel' : 'Monthly'}</option>
                                        <option value="batch">{isFr ? 'Par Lot Spécifique' : 'Batch Specific'}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                        {isFr ? 'Date de Début' : 'Start Date'}
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            border: '1px solid var(--line)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                        {isFr ? 'Date d’Échéance Cible' : 'Target Deadline'}
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            border: '1px solid var(--line)',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                                    {isFr ? 'Instructions / Notes' : 'Notes / Floor Instructions'}
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder={isFr ? 'Notes ou directives pour les chefs d’ateliers...' : 'Optional floor notes or specifications...'}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        border: '1px solid var(--line)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>

                            {/* Modal Footer Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{
                                        padding: '9px 16px',
                                        background: 'var(--soft)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: 'var(--muted)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isFr ? 'Annuler' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{
                                        padding: '9px 20px',
                                        background: '#2563eb',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isSubmitting
                                        ? (isFr ? 'Enregistrement...' : 'Saving...')
                                        : editingTarget
                                        ? (isFr ? 'Enregistrer les Modifications' : 'Update Target')
                                        : (isFr ? 'Enregistrer l’Objectif' : 'Save Target')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
