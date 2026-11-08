import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { makeFormat } from '../../../core/format';
import type { AuthUser, Locale } from '../../../core/types';
import '../../../components/ui.css';
import './flow.css';
import { CutModal } from './stage/CutModal';
import { FabricLossModal } from './stage/FabricLossModal';
import { FlowChain } from './stage/FlowChain';
import { HistoryTab } from './stage/HistoryTab';
import { ReceiveModal } from './stage/ReceiveModal';
import { RecordWorkModal } from './stage/RecordWorkModal';
import { ReportTab } from './stage/ReportTab';
import { SendModal } from './stage/SendModal';
import { SendStockModal } from './stage/SendStockModal';
import { InspectModal } from './monitor/InspectModal';
import { monitorText } from './monitor/monitorText';
import { stageLabel } from './stages';
import { WorkTab, type WorkModal } from './stage/WorkTab';
import { buildKpis } from './stage/kpis';
import { flowText } from './text';
import type { StageKey, StageOverview } from './types';
import { useLiveData } from '../../../core/liveData';

export type Tab = 'work' | 'history' | 'report';

const TABS: Tab[] = ['work', 'history', 'report'];
const NOTICE_MS = 7000;

type Props = { user: AuthUser; locale: Locale; stage: StageKey; initialTab?: Tab };

export default function StageWorkspace({ user, locale, stage, initialTab = 'work' }: Props) {
    const text = flowText[locale];
    const format = useMemo(() => makeFormat(locale, ''), [locale]);
    const [tab, setTab] = useState<Tab>(initialTab);
    const [modal, setModal] = useState<WorkModal | null>(null);
    const [notice, setNotice] = useState('');
    const { data, error, loading, reload } = useLiveData<StageOverview>(
        `/api/flow/overview?stage=${stage}`,
    );

    useEffect(() => setTab(initialTab), [initialTab, stage]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);

        return () => window.clearTimeout(timer);
    }, [notice]);

    const done = (message: string) => {
        setModal(null);
        setNotice(message);
        reload();
    };
    const close = () => setModal(null);

    const isProductionManager =
        user.roles?.some(
            (r) =>
                r.slug === 'production-manager' ||
                r.slug === 'production-supervisor' ||
                r.slug === 'factory-manager' ||
                r.slug === 'factory-administrator',
        ) ||
        user.workspace === 'production' ||
        user.workspace === 'factory';

    const isQualityManager =
        user.roles?.some(
            (r) =>
                r.slug === 'quality-manager' ||
                r.slug === 'quality-controller' ||
                r.slug === 'quality-officer' ||
                r.slug === 'quality-control',
        ) || user.workspace === 'quality';

    // Production managers oversee and view progress, but CANNOT record new work
    const canWork = !isProductionManager && Boolean(data?.capabilities.work);

    // Quality inspection strictly only for Quality Control Manager / Quality roles
    const canInspect = isQualityManager && !isProductionManager && Boolean(data?.capabilities.inspect);

    const safeData = data
        ? {
              ...data,
              capabilities: {
                  ...data.capabilities,
                  work: canWork,
                  inspect: canInspect,
              },
          }
        : null;

    return (
        <section className="ui">
            <div className="page-heading">
                <div>
                    <h1>{data ? data.stage.label[locale] : text.loading}</h1>
                    <p>{text.stageDescription[stage]}</p>
                </div>
                <div className="ui-actions">
                    <button className="secondary-btn" onClick={reload} disabled={loading}>
                        <RefreshCw size={15} />
                        {text.refresh}
                    </button>
                    {canInspect && data && data.lots.length > 0 && (
                        <button
                            className="secondary-btn"
                            onClick={() => setModal({ kind: 'inspect', lot: data.lots[0] })}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: 'var(--info)', color: 'var(--info)' }}
                        >
                            <ShieldCheck size={15} />
                            {locale === 'en' ? 'Quality Inspection' : 'Contrôle Qualité'}
                        </button>
                    )}
                    {tab === 'work' && canWork && stage !== 'cutting' && (
                        <button
                            className="primary-btn"
                            onClick={() => setModal({ kind: 'record' })}
                        >
                            +{' '}
                            {stage === 'packing'
                                ? text.work.recordPacking
                                : text.work.recordStage(stageLabel(stage, locale))}
                        </button>
                    )}
                    {tab === 'work' && canWork && stage === 'cutting' && (
                        <>
                            <button
                                className="secondary-btn"
                                onClick={() => setModal({ kind: 'loss' })}
                            >
                                {text.work.damagedFabric}
                            </button>
                            <button
                                className="primary-btn"
                                onClick={() => setModal({ kind: 'cut' })}
                            >
                                + {text.work.newCut}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {error && <div className="ui-error">{error}</div>}
            {notice && (
                <div className="ui-notice" role="status">
                    <span>{notice}</span>
                </div>
            )}

            {safeData && (
                <>
                    <FlowChain stage={safeData.stage} locale={locale} text={text} />

                    <div className="ui-kpis eight">
                        {buildKpis(stage, safeData, text).map((kpi) => (
                            <article
                                className={`panel ui-kpi ${kpi.alert ? 'alert' : ''}`}
                                key={kpi.label}
                            >
                                <small>{kpi.label}</small>
                                <strong>{format.whole(kpi.value)}</strong>
                            </article>
                        ))}
                    </div>

                    <div className="ui-tabs" role="tablist">
                        {TABS.map((key) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={tab === key}
                                className={tab === key ? 'active' : ''}
                                onClick={() => setTab(key)}
                            >
                                {text.tabs[key]}
                            </button>
                        ))}
                    </div>

                    {tab === 'work' && (
                        <WorkTab
                            data={safeData}
                            locale={locale}
                            text={text}
                            format={format}
                            onModal={setModal}
                        />
                    )}
                    {tab === 'history' && (
                        <HistoryTab
                            data={safeData}
                            locale={locale}
                            text={text}
                            format={format}
                            onChanged={done}
                        />
                    )}
                    {tab === 'report' && (
                        <ReportTab stage={stage} locale={locale} text={text} format={format} user={user} />
                    )}

                    {modal?.kind === 'receive' && (
                        <ReceiveModal
                            transfer={modal.transfer}
                            text={text}
                            onClose={close}
                            onDone={done}
                        />
                    )}
                    {modal?.kind === 'record' && (
                        <RecordWorkModal
                            lot={modal.lot}
                            lots={data.lots.filter((row) => row.wip > 0 && !row.held)}
                            stage={data.stage}
                            locale={locale}
                            text={text}
                            onClose={close}
                            onDone={done}
                        />
                    )}
                    {modal?.kind === 'send' && (
                        <SendModal
                            lot={modal.lot}
                            stage={data.stage}
                            to={modal.to}
                            locale={locale}
                            text={text}
                            onClose={close}
                            onDone={done}
                        />
                    )}
                    {modal?.kind === 'stock' && (
                        <SendStockModal lot={modal.lot} text={text} onClose={close} onDone={done} />
                    )}
                    {modal?.kind === 'inspect' && (
                        <InspectModal
                            lots={data.lots as any}
                            initialLot={modal.lot?.id}
                            initialStage={stage}
                            locale={locale}
                            text={text}
                            words={monitorText[locale]}
                            onClose={close}
                            onDone={done}
                        />
                    )}
                    {modal?.kind === 'cut' && (
                        <CutModal
                            lot={modal.lot}
                            data={data}
                            text={text}
                            format={format}
                            onClose={close}
                            onDone={done}
                        />
                    )}
                    {modal?.kind === 'loss' && (
                        <FabricLossModal
                            data={data}
                            text={text}
                            format={format}
                            onClose={close}
                            onDone={done}
                        />
                    )}
                </>
            )}
        </section>
    );
}
