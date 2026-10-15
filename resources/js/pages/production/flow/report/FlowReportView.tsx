import { useMemo, useState } from 'react';
import type { Format } from '../../../../core/format';
import type { Locale } from '../../../../core/types';
import { STAGE_ORDER, stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { FlowReport, StageKey } from '../types';
import { useLiveData } from '../../../../core/liveData';

type Period = 'today' | 'week' | 'month' | 'thisMonth';

type Props = { locale: Locale; text: FlowText; format: Format; highlight?: StageKey };

const isoDay = (date: Date) => date.toLocaleDateString('en-CA');

function rangeFor(period: Period): { from: string; to: string } {
    const end = new Date();
    const start = new Date();

    if (period === 'week') start.setDate(end.getDate() - 6);
    if (period === 'month') start.setDate(end.getDate() - 29);
    if (period === 'thisMonth') start.setDate(1);

    return { from: isoDay(start), to: isoDay(end) };
}

export function FlowReportView({ locale, text, format, highlight }: Props) {
    const t = text.report;
    const [period, setPeriod] = useState<Period>('week');
    const range = useMemo(() => rangeFor(period), [period]);
    const { data, error, loading } = useLiveData<FlowReport>(
        `/api/flow/report?from=${range.from}&to=${range.to}`,
    );

    return (
        <>
            <div className="ui-report-controls">
                {(Object.keys(t.periods) as Period[]).map((key) => (
                    <button
                        key={key}
                        className={period === key ? 'primary-btn' : 'secondary-btn'}
                        onClick={() => setPeriod(key)}
                    >
                        {t.periods[key]}
                    </button>
                ))}
            </div>

            {error && <div className="ui-error">{error}</div>}
            {!data && loading && <div className="ui-empty">{t.loading}</div>}

            {data && (
                <>
                    <article className="panel">
                        <div className="panel-title">
                            <h2>{t.stagesTitle}</h2>
                        </div>
                        <div className="ui-table-wrap">
                            <table className="ui-table" style={{ minWidth: 820 }}>
                                <thead>
                                    <tr>
                                        <th>{t.stage}</th>
                                        <th className="num">{t.good}</th>
                                        <th className="num">{t.damaged}</th>
                                        <th className="num">{t.damageRate}</th>
                                        <th className="num">{t.sent}</th>
                                        <th className="num">{t.missing}</th>
                                        <th className="num">{t.checks}</th>
                                        <th className="num">{t.passed}</th>
                                        <th className="num">{t.rejected}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.stages.map((row) => (
                                        <tr
                                            key={row.key}
                                            style={
                                                row.key === highlight
                                                    ? { fontWeight: 700 }
                                                    : undefined
                                            }
                                        >
                                            <td>{row.label[locale]}</td>
                                            <td className="num">{format.whole(row.good)}</td>
                                            <td className="num">{format.whole(row.damaged)}</td>
                                            <td className="num">
                                                {format.percent(row.damage_rate)}
                                            </td>
                                            <td className="num">{format.whole(row.sent)}</td>
                                            <td className="num">{format.whole(row.missing)}</td>
                                            <td className="num">{format.whole(row.checks)}</td>
                                            <td className="num">{format.whole(row.passed)}</td>
                                            <td className="num">{format.whole(row.rejected)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </article>

                    <div className="ui-report-grid">
                        <article className="panel">
                            <div className="panel-title">
                                <h2>{t.dailyTitle}</h2>
                            </div>
                            <div className="ui-table-wrap">
                                <table className="ui-table" style={{ minWidth: 420 }}>
                                    <thead>
                                        <tr>
                                            <th>{t.day}</th>
                                            {STAGE_ORDER.map((key) => (
                                                <th key={key} className="num">
                                                    {stageLabel(key, locale)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.daily.length ? (
                                            data.daily.map((day) => (
                                                <tr key={day.day}>
                                                    <td>{format.date(day.day)}</td>
                                                    {STAGE_ORDER.map((key) => (
                                                        <td key={key} className="num">
                                                            {format.whole(day[key].good)}
                                                            {day[key].damaged > 0 && (
                                                                <small>
                                                                    −
                                                                    {format.whole(day[key].damaged)}
                                                                </small>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="empty">
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
                                <h2>{t.fabricTitle}</h2>
                            </div>
                            <div className="ui-table-wrap">
                                <table className="ui-table" style={{ minWidth: 380 }}>
                                    <thead>
                                        <tr>
                                            <th>{t.fabric}</th>
                                            <th className="num">{t.used}</th>
                                            <th className="num">{t.waste}</th>
                                            <th className="num">{t.wasteRate}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.fabric.length ? (
                                            data.fabric.map((row) => (
                                                <tr key={row.name}>
                                                    <td>
                                                        <b>{row.name}</b>
                                                        <small>{row.unit ?? text.none}</small>
                                                    </td>
                                                    <td className="num">
                                                        {format.number(row.used)}
                                                    </td>
                                                    <td className="num">
                                                        {format.number(row.waste)}
                                                    </td>
                                                    <td className="num">
                                                        {format.percent(row.waste_rate)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="empty">
                                                    {t.empty}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    </div>
                </>
            )}
        </>
    );
}
