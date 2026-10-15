import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Format } from '../../../../core/format';
import type { Locale } from '../../../../core/types';
import { STAGE_ORDER, stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { LotDetail, StageKey, TimelineItem } from '../types';
import { postFlow, useFlowData } from '../useFlowData';
import type { MonitorText } from './monitorText';

type Props = {
    lotId: number;
    canInspect: boolean;
    locale: Locale;
    text: FlowText;
    words: MonitorText;
    format: Format;
    onClose: () => void;
    onInspect: (lotId: number, balances: LotDetail['balances']) => void;
    onChanged: (message: string) => void;
};

export function LotDetailModal({
    lotId,
    canInspect,
    locale,
    text,
    words,
    format,
    onClose,
    onInspect,
    onChanged,
}: Props) {
    const t = words.detail;
    const { data, error: loadError, reload } = useFlowData<LotDetail>(`/api/flow/lots/${lotId}`);
    const [holding, setHolding] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const act = async (path: string, body: object, message: string) => {
        setBusy(true);
        setError('');
        try {
            await postFlow(`/api/flow/lots/${lotId}/${path}`, body);
            setHolding(false);
            setReason('');
            reload();
            onChanged(message);
        } catch (reasonError) {
            setError(reasonError instanceof Error ? reasonError.message : '');
        } finally {
            setBusy(false);
        }
    };

    const lot = data?.lot;
    const held = lot?.status === 'held';
    const stageName = (key: StageKey) => stageLabel(key, locale);

    const describe = (item: TimelineItem) => {
        if (item.kind === 'entry') return t.entry(stageName(item.stage), item.good, item.damaged);
        if (item.kind === 'transfer')
            return t.transfer(stageName(item.from), stageName(item.to), item.sent, item.received);

        return t.inspection(stageName(item.stage), item.passed, item.rejected);
    };

    const noteFor = (item: TimelineItem) => {
        if (item.kind === 'entry')
            return item.voided ? `${t.cancelled}: ${item.void_reason ?? ''}` : item.note;
        if (item.kind === 'transfer') return item.receive_note ?? item.note;

        return item.defects ?? item.notes;
    };

    return (
        <Modal
            title={lot ? t.title(lot.lot_number) : text.loading}
            onClose={onClose}
            footer={
                lot && canInspect ? (
                    <>
                        {held ? (
                            <button
                                className="secondary-btn"
                                onClick={() => act('release', {}, t.release)}
                                disabled={busy}
                            >
                                {t.release}
                            </button>
                        ) : (
                            !holding && (
                                <button
                                    className="secondary-btn"
                                    onClick={() => setHolding(true)}
                                    disabled={busy || lot.status === 'completed'}
                                >
                                    {t.hold}
                                </button>
                            )
                        )}
                        <button
                            className="primary-btn"
                            onClick={() => data && onInspect(lotId, data.balances)}
                            disabled={busy}
                        >
                            {t.check}
                        </button>
                    </>
                ) : undefined
            }
        >
            {(error || loadError) && <div className="ui-error">{error || loadError}</div>}

            {data && lot && (
                <>
                    <div>
                        <b>{[lot.product, lot.color, lot.size].filter(Boolean).join(' · ')}</b>
                        <small style={{ display: 'block', color: 'var(--muted)' }}>
                            {[
                                lot.fabric && `${t.fabric}: ${lot.fabric}`,
                                lot.created_by && `${t.by}: ${lot.created_by}`,
                                format.date(lot.cut_on),
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </small>
                        <small style={{ display: 'block', marginTop: 6 }}>
                            {t.summary(
                                data.balances.cut,
                                data.balances.finished,
                                data.balances.in_progress,
                                data.balances.damaged,
                                data.balances.rejected,
                                data.balances.shortage,
                            )}
                        </small>
                    </div>

                    {held && <div className="ui-error">{t.heldSince(lot.hold_reason ?? '')}</div>}

                    {holding && (
                        <div className="ui-field">
                            <label>
                                {t.holdReason}
                                <input
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    autoFocus
                                />
                            </label>
                            <div className="ui-actions">
                                <button className="secondary-btn" onClick={() => setHolding(false)}>
                                    {text.cancel}
                                </button>
                                <button
                                    className="primary-btn"
                                    disabled={busy || reason.trim().length < 3}
                                    onClick={() => act('hold', { reason: reason.trim() }, t.hold)}
                                >
                                    {t.confirmHold}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 460 }}>
                            <thead>
                                <tr>
                                    <th>{t.balances}</th>
                                    <th className="num">{t.wip}</th>
                                    <th className="num">{t.good}</th>
                                    <th className="num">{t.ready}</th>
                                    <th className="num">{words.damaged}</th>
                                    <th className="num">{words.awaiting}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {STAGE_ORDER.map((key) => {
                                    const row = data.balances.stages[key];

                                    return (
                                        <tr key={key}>
                                            <td>{stageName(key)}</td>
                                            <td className="num">{format.whole(row.wip)}</td>
                                            <td className="num">{format.whole(row.good)}</td>
                                            <td className="num">{format.whole(row.outbox)}</td>
                                            <td className="num">{format.whole(row.damaged)}</td>
                                            <td className="num">
                                                {format.whole(row.awaiting_quality)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <h3 style={{ margin: '4px 0 0', fontSize: 14 }}>{t.timeline}</h3>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 460 }}>
                            <tbody>
                                {data.timeline.length ? (
                                    data.timeline.map((item, index) => (
                                        <tr
                                            key={`${item.kind}-${item.at}-${index}`}
                                            className={
                                                item.kind === 'entry' && item.voided
                                                    ? 'ui-struck'
                                                    : ''
                                            }
                                        >
                                            <td>
                                                {describe(item)}
                                                {noteFor(item) && <small>{noteFor(item)}</small>}
                                            </td>
                                            <td>
                                                {item.who ?? text.none}
                                                <small>{format.dateTime(item.at)}</small>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="empty">{t.timelineEmpty}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </Modal>
    );
}
