import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { makeFormat } from '../../../core/format';
import type { AuthUser, Locale } from '../../../core/types';
import '../../../components/ui.css';
import './flow.css';
import { CutModal } from './stage/CutModal';
import { FabricLossModal } from './stage/FabricLossModal';
import { FlowChain } from './stage/FlowChain';
import { HistoryTab } from './stage/HistoryTab';
import { MaterialsTab } from './stage/MaterialsTab';
import { ReceiveModal } from './stage/ReceiveModal';
import { RecordWorkModal } from './stage/RecordWorkModal';
import { ReportTab } from './stage/ReportTab';
import { SendModal } from './stage/SendModal';
import { WorkTab, type WorkModal } from './stage/WorkTab';
import { buildKpis } from './stage/kpis';
import { flowText } from './text';
import type { StageKey, StageOverview } from './types';
import { useFlowData } from './useFlowData';

export type Tab = 'work' | 'materials' | 'history' | 'report';

const TABS: Tab[] = ['work', 'materials', 'history', 'report'];
const NOTICE_MS = 7000;

type Props = { user: AuthUser; locale: Locale; stage: StageKey; initialTab?: Tab };

export default function StageWorkspace({ locale, stage, initialTab = 'work' }: Props) {
    const text = flowText[locale];
    const format = useMemo(() => makeFormat(locale, ''), [locale]);
    const [tab, setTab] = useState<Tab>(initialTab);
    const [modal, setModal] = useState<WorkModal | null>(null);
    const [notice, setNotice] = useState('');
    const { data, error, loading, reload } = useFlowData<StageOverview>(`/api/flow/overview?stage=${stage}`);

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

    const canWork = Boolean(data?.capabilities.work);

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
                    {canWork && stage === 'cutting' && (
                        <>
                            <button className="secondary-btn" onClick={() => setModal({ kind: 'loss' })}>
                                {text.work.damagedFabric}
                            </button>
                            <button className="primary-btn" onClick={() => setModal({ kind: 'cut' })}>
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

            {data && (
                <>
                    <FlowChain stage={data.stage} locale={locale} text={text} />

                    <div className="ui-kpis six">
                        {buildKpis(stage, data, text).map((kpi) => (
                            <article className={`panel ui-kpi ${kpi.alert ? 'alert' : ''}`} key={kpi.label}>
                                <small>{kpi.label}</small>
                                <strong>{format.whole(kpi.value)}</strong>
                            </article>
                        ))}
                    </div>

                    <div className="ui-tabs" role="tablist">
                        {TABS.map((key) => (
                            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                                {text.tabs[key]}
                            </button>
                        ))}
                    </div>

                    {tab === 'work' && <WorkTab data={data} locale={locale} text={text} format={format} onModal={setModal} />}
                    {tab === 'materials' && <MaterialsTab data={data} locale={locale} text={text} format={format} onChanged={done} />}
                    {tab === 'history' && <HistoryTab data={data} locale={locale} text={text} format={format} onChanged={done} />}
                    {tab === 'report' && <ReportTab stage={stage} locale={locale} text={text} format={format} />}

                    {modal?.kind === 'receive' && <ReceiveModal transfer={modal.transfer} text={text} onClose={close} onDone={done} />}
                    {modal?.kind === 'record' && <RecordWorkModal lot={modal.lot} stage={data.stage} locale={locale} text={text} onClose={close} onDone={done} />}
                    {modal?.kind === 'send' && <SendModal lot={modal.lot} stage={data.stage} locale={locale} text={text} onClose={close} onDone={done} />}
                    {modal?.kind === 'cut' && <CutModal lot={modal.lot} data={data} text={text} format={format} onClose={close} onDone={done} />}
                    {modal?.kind === 'loss' && <FabricLossModal data={data} text={text} format={format} onClose={close} onDone={done} />}
                </>
            )}
        </section>
    );
}
