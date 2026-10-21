import type { Format } from '../../../../core/format';
import type { Locale } from '../../../../core/types';
import { LotFilters, useLotFilters } from '../LotFilters';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { LotRow, StageKey, StageOverview, TransferRow } from '../types';

export type WorkModal =
    | { kind: 'receive'; transfer: TransferRow }
    | { kind: 'record'; lot?: LotRow }
    | { kind: 'send'; lot: LotRow; to: StageKey }
    | { kind: 'stock'; lot: LotRow }
    | { kind: 'cut'; lot?: LotRow }
    | { kind: 'loss' }
    | { kind: 'inspect'; lot: LotRow };

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
    const here = isCutting
        ? data.lots
        : data.lots.filter(
              (lot) => lot.wip + lot.good + lot.damaged + lot.outbox + lot.awaiting_quality > 0,
          );
    const everything = [...here, ...data.incoming];
    const filters = useLotFilters(everything);
    const lots = here.filter((lot) => filters.filtered.includes(lot));
    const arriving = data.incoming.filter((transfer) => filters.filtered.includes(transfer));

    return (
        <>
            <article className="panel">
                <LotFilters
                    values={filters.values}
                    options={filters.options}
                    text={text}
                    onChange={filters.setValues}
                    onClear={filters.clear}
                    active={filters.active}
                />
            </article>

            {!isCutting && data.incoming.length > 0 && (
                <article className="panel">
                    <div className="panel-title">
                        <h2>{text.work.arrivingTitle()}</h2>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 720 }}>
                            <thead>
                                <tr>
                                    <th>{text.work.lot}</th>
                                    <th>{text.work.product}</th>
                                    <th>{text.work.colour}</th>
                                    <th>{text.work.size}</th>
                                    <th>{text.work.from}</th>
                                    <th className="num">{text.work.sent}</th>
                                    <th>{text.work.sentBy}</th>
                                    <th>{text.work.note}</th>
                                    <th>{text.work.actions}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {arriving.length ? (
                                    arriving.map((transfer) => (
                                        <tr key={transfer.id}>
                                            <td>
                                                <b>{transfer.lot_number}</b>
                                            </td>
                                            <td>{transfer.product ?? text.none}</td>
                                            <td>
                                                {transfer.color ? (
                                                    <span className="ui-colour">
                                                        {transfer.color}
                                                    </span>
                                                ) : (
                                                    text.none
                                                )}
                                            </td>
                                            <td>{transfer.size ?? text.none}</td>
                                            <td>{stageLabel(transfer.from, locale)}</td>
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
                                        <td colSpan={9} className="empty">
                                            {filters.active && data.incoming.length
                                                ? text.work.noMatch
                                                : text.work.arrivingEmpty}
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
                    <table className="ui-table" style={{ minWidth: 920 }}>
                        <thead>
                            <tr>
                                <th>{text.work.lot}</th>
                                <th>{text.work.product}</th>
                                <th>{text.work.colour}</th>
                                <th>{text.work.size}</th>
                                <th>{text.work.fabric}</th>
                                {isCutting ? (
                                    <>
                                        <th className="num">{text.work.cutTotal}</th>
                                        <th className="num">{locale === 'en' ? 'Awaiting QC' : 'Attente QC'}</th>
                                        <th className="num">{locale === 'en' ? 'QC Passed' : 'Validé QC'}</th>
                                        <th className="num">{locale === 'en' ? 'QC Failed' : 'Rejeté QC'}</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="num">{text.work.waiting}</th>
                                        <th className="num">{text.work.done}</th>
                                        <th className="num">{locale === 'en' ? 'Awaiting QC' : 'Attente QC'}</th>
                                        <th className="num">
                                            {isPacking
                                                ? locale === 'en' ? 'Ready for Stock' : 'Prêt Stock'
                                                : locale === 'en' ? 'QC Passed' : 'Validé QC'}
                                        </th>
                                        <th className="num">{locale === 'en' ? 'QC Failed' : 'Rejeté QC'}</th>
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
                                            {lot.quality_rejected && lot.quality_rejected > 0 ? (
                                                <small style={{ display: 'block', marginTop: 2 }}>
                                                    <span
                                                        className="ui-chip bad"
                                                        title={lot.qc_message ? `QC Failed: ${lot.qc_message}` : 'Failed Quality Control'}
                                                        style={{ fontSize: '0.70rem', padding: '1px 5px' }}
                                                    >
                                                        QC Failed: {lot.quality_rejected}
                                                    </span>
                                                </small>
                                            ) : null}
                                            {lot.awaiting_quality > 0 ? (
                                                <small style={{ display: 'block', marginTop: 2 }}>
                                                    <span
                                                        className="ui-chip warning"
                                                        title={locale === 'en' ? 'Awaiting Quality Control Inspection' : 'En attente du contrôle qualité'}
                                                        style={{ fontSize: '0.70rem', padding: '1px 5px' }}
                                                    >
                                                        QC Pending: {lot.awaiting_quality}
                                                    </span>
                                                </small>
                                            ) : null}
                                            {lot.outbox > 0 && !isPacking ? (
                                                <small style={{ display: 'block', marginTop: 2 }}>
                                                    <span
                                                        className="ui-chip good"
                                                        title={locale === 'en' ? 'Quality Control Passed' : 'Contrôle qualité validé'}
                                                        style={{ fontSize: '0.70rem', padding: '1px 5px' }}
                                                    >
                                                        QC Passed: {lot.outbox}
                                                    </span>
                                                </small>
                                            ) : null}
                                        </td>
                                        <td>{lot.product ?? text.none}</td>
                                        <td>
                                            {lot.color ? (
                                                <span className="ui-colour">{lot.color}</span>
                                            ) : (
                                                text.none
                                            )}
                                        </td>
                                        <td>{lot.size ?? text.none}</td>
                                        <td>{lot.fabric ?? text.none}</td>
                                        {isCutting ? (
                                            <>
                                                <td className="num">{format.whole(lot.cut)}</td>
                                                <td className="num">
                                                    <span style={{ color: lot.awaiting_quality > 0 ? '#b45309' : '#64748b' }}>
                                                        {format.whole(lot.awaiting_quality)}
                                                    </span>
                                                </td>
                                                <td className="num">
                                                    <b style={{ color: lot.outbox > 0 ? '#15803d' : '#64748b' }}>
                                                        {format.whole(lot.outbox)}
                                                    </b>
                                                </td>
                                                <td className="num">
                                                    <span style={{ color: (lot.quality_rejected || 0) > 0 ? '#b91c1c' : '#64748b', fontWeight: (lot.quality_rejected || 0) > 0 ? 700 : 400 }}>
                                                        {format.whole(lot.quality_rejected || 0)}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="num">
                                                    <b>{format.whole(lot.wip)}</b>
                                                </td>
                                                <td className="num">{format.whole(lot.good)}</td>
                                                <td className="num">
                                                    <span style={{ color: lot.awaiting_quality > 0 ? '#b45309' : '#64748b' }}>
                                                        {format.whole(lot.awaiting_quality)}
                                                    </span>
                                                </td>
                                                <td className="num">
                                                    <b style={{ color: (isPacking ? lot.ready_for_stock : lot.outbox) > 0 ? '#15803d' : '#64748b' }}>
                                                        {format.whole(
                                                            isPacking
                                                                ? lot.ready_for_stock
                                                                : lot.outbox,
                                                        )}
                                                    </b>
                                                </td>
                                                <td className="num">
                                                    <span style={{ color: (lot.quality_rejected || 0) > 0 ? '#b91c1c' : '#64748b', fontWeight: (lot.quality_rejected || 0) > 0 ? 700 : 400 }}>
                                                        {format.whole(lot.quality_rejected || 0)}
                                                    </span>
                                                </td>
                                                <td className="num">{format.whole(lot.damaged)}</td>
                                            </>
                                        )}
                                        <td>
                                            {canWork && (
                                                <div className="ui-row-actions">
                                                    {capabilities.inspect && !lot.held && (lot.awaiting_quality > 0 || lot.good > 0 || lot.cut > 0) && (
                                                        <button
                                                            className="secondary-btn"
                                                            onClick={() => onModal({ kind: 'inspect', lot })}
                                                            title={locale === 'en' ? 'Quality Control Inspection' : 'Contrôle Qualité'}
                                                            style={{ borderColor: '#0284c7', color: '#0284c7', fontSize: '0.78rem', padding: '3px 8px' }}
                                                        >
                                                            {locale === 'en' ? 'Inspect QC' : 'Contrôler QC'}
                                                        </button>
                                                    )}
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
                                                            className="primary-btn"
                                                            disabled={lot.held}
                                                            onClick={() =>
                                                                onModal({ kind: 'record', lot })
                                                            }
                                                        >
                                                            {isPacking
                                                                ? text.work.recordPacking
                                                                : text.work.recordStage(
                                                                      stageLabel(stage.key, locale),
                                                                  )}
                                                        </button>
                                                    )}
                                                    {isPacking && lot.ready_for_stock > 0 && (
                                                        <button
                                                            className="secondary-btn"
                                                            disabled={lot.held}
                                                            onClick={() =>
                                                                onModal({ kind: 'stock', lot })
                                                            }
                                                        >
                                                            {text.work.sendToStock} →
                                                        </button>
                                                    )}
                                                    {lot.outbox > 0 &&
                                                        stage.destinations.map((to) => (
                                                            <button
                                                                key={to}
                                                                className="secondary-btn"
                                                                disabled={lot.held}
                                                                onClick={() =>
                                                                    onModal({
                                                                        kind: 'send',
                                                                        lot,
                                                                        to,
                                                                    })
                                                                }
                                                            >
                                                                {text.work.send(
                                                                    stageLabel(to, locale),
                                                                )}{' '}
                                                                →
                                                            </button>
                                                        ))}
                                                    {lot.outbox === 0 && !isPacking && (lot.cut > 0 || lot.good > 0) &&
                                                        stage.destinations.map((to) => (
                                                            <button
                                                                key={to}
                                                                className="secondary-btn"
                                                                disabled={lot.held}
                                                                style={{ opacity: 0.7 }}
                                                                onClick={() =>
                                                                    onModal({
                                                                        kind: 'send',
                                                                        lot,
                                                                        to,
                                                                    })
                                                                }
                                                                title={lot.quality_rejected && lot.quality_rejected > 0 ? `Failed QC (${lot.quality_rejected}): ${lot.qc_message || 'Defects found'}` : 'Quality Control inspection required before sending'}
                                                            >
                                                                {text.work.send(
                                                                    stageLabel(to, locale),
                                                                )}{' '}
                                                                (QC Req)
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={isCutting ? 10 : 12}
                                        className="empty"
                                    >
                                        {filters.active && here.length
                                            ? text.work.noMatch
                                            : isCutting
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
