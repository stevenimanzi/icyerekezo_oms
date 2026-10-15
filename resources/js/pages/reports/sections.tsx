import type { Format } from '../../core/format';
import type { Locale } from '../../core/types';
import type { ReportText } from './text';
import type { QualityBlock, SalesBlock, StageBlock, WarehouseBlock } from './types';

type Common = { text: ReportText; format: Format; locale: Locale };

function Tiles({
    items,
}: {
    items: { label: string; value: string; hint?: string; alert?: boolean }[];
}) {
    return (
        <div className="ui-kpis">
            {items.map((item) => (
                <article className={`panel ui-kpi ${item.alert ? 'alert' : ''}`} key={item.label}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    {item.hint && <p>{item.hint}</p>}
                </article>
            ))}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rp-section">
            <h2>{title}</h2>
            {children}
        </section>
    );
}

export function StageSection({ block, text, format, locale }: Common & { block: StageBlock }) {
    const t = text.stage;
    const isCutting = block.key === 'cutting';
    const tiles = [
        ...(isCutting ? [] : [{ label: t.received, value: format.whole(block.received) }]),
        { label: isCutting ? t.cut : t.done, value: format.whole(block.good) },
        { label: t.damaged, value: format.whole(block.damaged), alert: block.damaged > 0 },
        { label: t.sent, value: format.whole(block.sent) },
        { label: t.missing, value: format.whole(block.missing), alert: block.missing > 0 },
        { label: t.waiting, value: format.whole(block.waiting_now) },
        {
            label: block.key === 'packing' ? t.waitingQuality : t.ready,
            value: format.whole(
                block.key === 'packing' ? block.waiting_quality_now : block.ready_now,
            ),
        },
        ...(isCutting ? [{ label: t.lotsCut, value: format.whole(block.lots_cut ?? 0) }] : []),
    ];

    return (
        <Section title={block.label[locale]}>
            <Tiles items={tiles} />
            <p className="rp-line">
                <b>{t.requests}:</b>{' '}
                {t.requestsLine(
                    block.requests.total,
                    block.requests.approved,
                    block.requests.pending,
                    block.requests.rejected,
                )}
            </p>

            {isCutting && block.fabric && block.fabric.length > 0 && (
                <article className="panel">
                    <div className="panel-title">
                        <h3>{t.fabricTitle}</h3>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t.fabric}</th>
                                    <th className="num">{t.used}</th>
                                    <th className="num">{t.waste}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {block.fabric.map((row, index) => (
                                    <tr key={`${row.name}-${index}`}>
                                        <td>
                                            <b>{row.name}</b>{' '}
                                            {row.color && (
                                                <span className="ui-colour">{row.color}</span>
                                            )}
                                        </td>
                                        <td className="num">{format.number(row.used)}</td>
                                        <td className="num">{format.number(row.waste)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            <div className="ui-report-grid">
                <article className="panel">
                    <div className="panel-title">
                        <h3>{t.dailyTitle}</h3>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t.day}</th>
                                    <th className="num">{t.good}</th>
                                    <th className="num">{t.damaged}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {block.daily.length ? (
                                    block.daily.map((day) => (
                                        <tr key={day.day}>
                                            <td>{format.date(day.day)}</td>
                                            <td className="num">{format.whole(day.good)}</td>
                                            <td className="num">{format.whole(day.damaged)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="empty">
                                            {t.empty}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
                <article className="panel">
                    <div className="panel-title">
                        <h3>{t.lotsTitle}</h3>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 520 }}>
                            <thead>
                                <tr>
                                    <th>{t.lot}</th>
                                    <th>{t.product}</th>
                                    <th>{t.colour}</th>
                                    <th>{t.size}</th>
                                    <th className="num">{t.good}</th>
                                    <th className="num">{t.damaged}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {block.lots.length ? (
                                    block.lots.map((lot, index) => (
                                        <tr key={`${lot.lot_number}-${index}`}>
                                            <td>
                                                <b>{lot.lot_number}</b>
                                                <small>{lot.fabric ?? ''}</small>
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
                                            <td className="num">{format.whole(lot.good)}</td>
                                            <td className="num">{format.whole(lot.damaged)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="empty">
                                            {t.empty}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            </div>
        </Section>
    );
}

export function WarehouseSection({ block, text, format }: Common & { block: WarehouseBlock }) {
    const t = text.warehouse;
    const requests = block.requests;

    return (
        <Section title={text.departments.warehouse}>
            <Tiles
                items={[
                    {
                        label: t.stockIn,
                        value: format.money(block.stock_in.value),
                        hint: t.entries(block.stock_in.entries),
                    },
                    {
                        label: t.stockOut,
                        value: format.money(block.stock_out.value),
                        hint: t.entries(block.stock_out.entries),
                    },
                    {
                        label: t.wasted,
                        value: format.money(block.wasted_value),
                        alert: block.wasted_value > 0,
                    },
                    {
                        label: t.requests,
                        value: format.whole(requests.total),
                        hint: text.stage.requestsLine(
                            requests.total,
                            requests.approved,
                            requests.pending,
                            requests.rejected,
                        ),
                    },
                    {
                        label: t.low,
                        value: format.whole(block.low_stock),
                        alert: block.low_stock > 0,
                    },
                    {
                        label: t.out,
                        value: format.whole(block.out_of_stock),
                        alert: block.out_of_stock > 0,
                    },
                    { label: t.value, value: format.money(block.stock_value) },
                ]}
            />
            <article className="panel">
                <div className="panel-title">
                    <h3>{t.itemsTitle}</h3>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t.item}</th>
                                <th className="num">{t.receivedQty}</th>
                                <th className="num">{t.takenOutQty}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {block.items.length ? (
                                block.items.map((row, index) => (
                                    <tr key={`${row.name}-${index}`}>
                                        <td>
                                            <b>{row.name}</b>{' '}
                                            {row.color && (
                                                <span className="ui-colour">{row.color}</span>
                                            )}
                                        </td>
                                        <td className="num">{format.number(row.received)}</td>
                                        <td className="num">{format.number(row.taken_out)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="empty">
                                        {text.stage.empty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </Section>
    );
}

export function QualitySection({ block, text, format, locale }: Common & { block: QualityBlock }) {
    const t = text.quality;

    return (
        <Section title={text.departments.quality}>
            <Tiles
                items={[
                    { label: t.checks, value: format.whole(block.checks) },
                    { label: t.inspected, value: format.whole(block.inspected) },
                    { label: t.passed, value: format.whole(block.passed) },
                    {
                        label: t.rejected,
                        value: format.whole(block.rejected),
                        alert: block.rejected > 0,
                    },
                    { label: t.passRate, value: format.percent(block.pass_rate) },
                ]}
            />
            <div className="ui-report-grid">
                <article className="panel">
                    <div className="panel-title">
                        <h3>{t.byStage}</h3>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 480 }}>
                            <thead>
                                <tr>
                                    <th>{t.stage}</th>
                                    <th className="num">{t.checks}</th>
                                    <th className="num">{t.inspected}</th>
                                    <th className="num">{t.rejected}</th>
                                    <th className="num">{t.passRate}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {block.by_stage.map((row) => (
                                    <tr key={row.key}>
                                        <td>{row.label[locale]}</td>
                                        <td className="num">{format.whole(row.checks)}</td>
                                        <td className="num">{format.whole(row.inspected)}</td>
                                        <td className="num">{format.whole(row.rejected)}</td>
                                        <td className="num">{format.percent(row.pass_rate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
                <article className="panel">
                    <div className="panel-title">
                        <h3>{t.onHold}</h3>
                    </div>
                    {block.on_hold.length ? (
                        <ul className="ui-alerts">
                            {block.on_hold.map((lot) => (
                                <li key={lot.lot_number}>
                                    <span>
                                        <b>{lot.lot_number}</b> {lot.product ?? ''}
                                        <small style={{ display: 'block' }}>{lot.reason}</small>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="ui-empty">{t.noHold}</div>
                    )}
                </article>
            </div>
            <article className="panel">
                <div className="panel-title">
                    <h3>{t.recent}</h3>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ minWidth: 760 }}>
                        <thead>
                            <tr>
                                <th>{t.number}</th>
                                <th>{t.lot}</th>
                                <th>{t.stage}</th>
                                <th className="num">{t.inspected}</th>
                                <th className="num">{t.rejected}</th>
                                <th>{t.result}</th>
                                <th>{t.by}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {block.recent.length ? (
                                block.recent.map((row) => (
                                    <tr key={row.number}>
                                        <td>
                                            <b>{row.number}</b>
                                            <small>{format.dateTime(row.at)}</small>
                                        </td>
                                        <td>{row.lot_number}</td>
                                        <td>
                                            {text.departments[
                                                row.stage as keyof typeof text.departments
                                            ] ?? row.stage}
                                        </td>
                                        <td className="num">{format.whole(row.inspected)}</td>
                                        <td className="num">{format.whole(row.rejected)}</td>
                                        <td>
                                            <span
                                                className={`ui-chip ${row.result === 'passed' ? 'ok' : row.result === 'failed' ? 'bad' : 'warn'}`}
                                            >
                                                {t.results[row.result] ?? row.result}
                                            </span>
                                            {row.defects && <small>{row.defects}</small>}
                                        </td>
                                        <td>{row.by ?? text.none}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="empty">
                                        {t.empty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </Section>
    );
}

export function SalesSection({ block, text, format }: Common & { block: SalesBlock }) {
    const t = text.sales;

    return (
        <Section title={text.departments.sales}>
            <Tiles
                items={[
                    { label: t.revenue, value: format.money(block.revenue) },
                    { label: t.count, value: format.whole(block.sales) },
                    { label: t.items, value: format.whole(block.items_sold) },
                    { label: t.collected, value: format.money(block.collected) },
                    {
                        label: t.outstanding,
                        value: format.money(block.outstanding),
                        alert: block.outstanding > 0,
                    },
                ]}
            />
            <article className="panel">
                <div className="panel-title">
                    <h3>{t.topTitle}</h3>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t.product}</th>
                                <th className="num">{t.quantity}</th>
                                <th className="num">{t.value}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {block.top_products.length ? (
                                block.top_products.map((row) => (
                                    <tr key={row.name}>
                                        <td>{row.name}</td>
                                        <td className="num">{format.whole(row.quantity)}</td>
                                        <td className="num">{format.money(row.revenue)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="empty">
                                        {t.empty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </Section>
    );
}
