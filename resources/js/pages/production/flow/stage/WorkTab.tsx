import type { Format } from '../../../../core/format';
import type { Locale } from '../../../../core/types';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { LotRow, StageOverview, TransferRow } from '../types';

export type WorkModal =
    | { kind: 'receive'; transfer: TransferRow }
    | { kind: 'record'; lot: LotRow }
    | { kind: 'send'; lot: LotRow }
    | { kind: 'cut'; lot?: LotRow }
    | { kind: 'loss' };

type Props = {
    data: StageOverview;
    locale: Locale;
    text: FlowText;
    format: Format;
    onModal: (modal: WorkModal) => void;
};

export function WorkTab({ data, locale, text, format, onModal }: Props) {
    const { stage, capabilities } = data;
    const canWork = capabilities.work;
    const isCutting = stage.key === 'cutting';
    const isPacking = stage.key === 'packing';
    const lots = isCutting
        ? data.lots
        : data.lots.filter(
              (lot) => lot.wip + lot.good + lot.damaged + lot.outbox + lot.awaiting_quality > 0,
          );
    const next = stage.next ? stageLabel(stage.next, locale) : '';

    return (
        <>
            {!isCutting && (
                <article className="panel">
                    <div className="panel-title">
                        <h2>{text.work.arrivingTitle(stageLabel(stage.previous, locale))}</h2>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 640 }}>
                            <thead>
                                <tr>
                                    <th>{text.work.lot}</th>
                                    <th>{text.work.product}</th>
                                    <th>{text.work.colorSize}</th>
                                    <th className="num">{text.work.sent}</th>
                                    <th>{text.work.sentBy}</th>
                                    <th>{text.work.note}</th>
                                    <th>{text.work.actions}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.incoming.length ? (
                                    data.incoming.map((transfer) => (
                                        <tr key={transfer.id}>
                                            <td>
                                                <b>{transfer.lot_number}</b>
                                            </td>
                                            <td>{transfer.product ?? text.none}</td>
                                            <td>
                                                {[transfer.color, transfer.size]
                                                    .filter(Boolean)
                                                    .join(' / ') || text.none}
                                            </td>
                                            <td className="num">
                                                <b>{format.whole(transfer.quantity_sent)}</b>
                                            </td>
                                            <td>
                                                {transfer.sent_by ?? text.none}
                                                <small>{format.dateTime(transfer.sent_at)}</small>
                                            </td>
                                            <td>{transfer.note ?? text.none}</td>
                                            <td>
                                                {canWork && (
                                                    <button
                                                        className="primary-btn"
                                                        onClick={() =>
                                                            onModal({ kind: 'receive', transfer })
                                                        }
                                                    >
                                                        {text.work.receive}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="empty">
                                            {text.work.arrivingEmpty}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            <article className="panel">
                <div className="panel-title">
                    <h2>{text.work.lotsTitle}</h2>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ minWidth: 760 }}>
                        <thead>
                            <tr>
                                <th>{text.work.lot}</th>
                                <th>{text.work.product}</th>
                                <th>{text.work.colorSize}</th>
                                {isCutting ? (
                                    <>
                                        <th className="num">{text.work.cutTotal}</th>
                                        <th className="num">{text.work.ready}</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="num">{text.work.waiting}</th>
                                        <th className="num">{text.work.done}</th>
                                        <th className="num">
                                            {isPacking ? text.work.qcWaiting : text.work.ready}
                                        </th>
                                        <th className="num">{text.work.damaged}</th>
                                    </>
                                )}
                                <th>{text.work.actions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lots.length ? (
                                lots.map((lot) => (
                                    <tr key={lot.id}>
                                        <td>
                                            <b>{lot.lot_number}</b>
                                            {lot.held && (
                                                <small>
                                                    <span
                                                        className="ui-chip bad"
                                                        title={text.work.holdWarning(
                                                            lot.hold_reason ?? '',
                                                        )}
                                                    >
                                                        {text.work.onHold}
                                                    </span>
                                                </small>
                                            )}
                                        </td>
                                        <td>{lot.product ?? text.none}</td>
                                        <td>
                                            {[lot.color, lot.size].filter(Boolean).join(' / ') ||
                                                text.none}
                                        </td>
                                        {isCutting ? (
                                            <>
                                                <td className="num">{format.whole(lot.cut)}</td>
                                                <td className="num">
                                                    <b>{format.whole(lot.outbox)}</b>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="num">
                                                    <b>{format.whole(lot.wip)}</b>
                                                </td>
                                                <td className="num">{format.whole(lot.good)}</td>
                                                <td className="num">
                                                    <b>
                                                        {format.whole(
                                                            isPacking
                                                                ? lot.awaiting_quality
                                                                : lot.outbox,
                                                        )}
                                                    </b>
                                                </td>
                                                <td className="num">{format.whole(lot.damaged)}</td>
                                            </>
                                        )}
                                        <td>
                                            {canWork && (
                                                <div className="ui-row-actions">
                                                    {isCutting && (
                                                        <button
                                                            className="ui-link"
                                                            disabled={lot.held}
                                                            onClick={() =>
                                                                onModal({ kind: 'cut', lot })
                                                            }
                                                        >
                                                            {text.work.cutMore}
                                                        </button>
                                                    )}
                                                    {!isCutting && lot.wip > 0 && (
                                                        <button
                                                            className="ui-link"
                                                            disabled={lot.held}
                                                            onClick={() =>
                                                                onModal({ kind: 'record', lot })
                                                            }
                                                        >
                                                            {isPacking
                                                                ? text.work.recordPacking
                                                                : text.work.record}
                                                        </button>
                                                    )}
                                                    {stage.next && lot.outbox > 0 && (
                                                        <button
                                                            className="ui-link"
                                                            disabled={lot.held}
                                                            onClick={() =>
                                                                onModal({ kind: 'send', lot })
                                                            }
                                                        >
                                                            {text.work.send(next)} →
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={isCutting ? 6 : 8} className="empty">
                                        {isCutting
                                            ? text.work.lotsEmptyCutting
                                            : text.work.lotsEmpty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
}
