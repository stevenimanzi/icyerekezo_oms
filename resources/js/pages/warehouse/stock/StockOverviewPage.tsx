import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import '../../../components/ui.css';
import { makeFormat } from '../../../core/format';
import { useLiveData } from '../../../core/liveData';
import type { AuthUser, Locale } from '../../../core/types';
import { ManageStockModal } from './ManageStockModals';
import { MovementChart } from './MovementChart';
import { StockTable } from './StockTable';
import { stockText } from './text';
import type { StockAnalytics, StockRow } from './types';
import './stock.css';

type Props = { user: AuthUser; locale: Locale };
type Tab = 'raw_materials' | 'finished_goods' | 'other';

const TABS: Tab[] = ['raw_materials', 'finished_goods', 'other'];
const PERIODS = [7, 30, 90] as const;
const NOTICE_MS = 7000;
const BAR_CLASS: Record<Tab, string> = {
    raw_materials: 'raw',
    finished_goods: 'finished',
    other: 'other',
};

/** What the factory holds right now: figures, trends, items running low and a table per kind of item. */
export default function StockOverviewPage({ user, locale }: Props) {
    const text = stockText[locale];
    const copy = text.overview;
    const format = useMemo(
        () => makeFormat(locale, user.current_factory?.currency_code ?? ''),
        [locale, user],
    );
    const [days, setDays] = useState<number>(30);
    const [tab, setTab] = useState<Tab>('raw_materials');
    const [modal, setModal] = useState<'move' | 'count' | null>(null);
    const [notice, setNotice] = useState('');
    const { data, error, loading, reload } = useLiveData<StockAnalytics>(
        `/api/stock/analytics?days=${days}`,
    );

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);

        return () => window.clearTimeout(timer);
    }, [notice]);

    const isKeeper = user.roles.some((role) => role.slug === 'warehouse-keeper');
    const allItems: StockRow[] = data
        ? [...data.raw_materials, ...data.finished_goods, ...data.other]
        : [];
    const maxGroup = Math.max(1, ...(data?.by_type.map((group) => group.value) ?? [0]));
    const maxTop = Math.max(1, ...(data?.top_items.map((row) => row.value) ?? [0]));

    const kpis = data
        ? [
              {
                  label: copy.kpiTotal,
                  value: format.money(data.kpis.total_value),
                  hint: copy.itemsCount(data.kpis.items_in_stock),
              },
              {
                  label: copy.kpiRaw,
                  value: format.money(data.kpis.raw_value),
                  hint: copy.itemsCount(data.raw_materials.length),
              },
              {
                  label: copy.kpiFinished,
                  value: format.money(data.kpis.finished_value),
                  hint: copy.itemsCount(data.finished_goods.length),
              },
              {
                  label: copy.kpiLow,
                  value: format.whole(data.kpis.low_stock),
                  alert: data.kpis.low_stock > 0,
              },
              {
                  label: copy.kpiOut,
                  value: format.whole(data.kpis.out_of_stock),
                  alert: data.kpis.out_of_stock > 0,
              },
              {
                  label: copy.kpiHeld,
                  value: format.number(data.kpis.held_for_quality),
                  hint: copy.kpiHeldHint,
              },
          ]
        : [];

    return (
        <section className="ui">
            <div className="page-heading">
                <div>
                    <h1>{copy.title}</h1>
                    <p>{copy.subtitle}</p>
                </div>
                <div className="ui-actions">
                    <button className="secondary-btn" onClick={reload} disabled={loading}>
                        <RefreshCw size={15} />
                        {text.refresh}
                    </button>
                    {isKeeper && data && (
                        <>
                            <button className="secondary-btn" onClick={() => setModal('move')}>
                                {copy.moveStock}
                            </button>
                            <button className="primary-btn" onClick={() => setModal('count')}>
                                {copy.countStock}
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

            {!data && !error && <div className="ui-empty">{text.loading}</div>}

            {data && (
                <>
                    <div className="ui-kpis six">
                        {kpis.map((kpi) => (
                            <article
                                className={`panel ui-kpi ${kpi.alert ? 'alert' : ''}`}
                                key={kpi.label}
                            >
                                <small>{kpi.label}</small>
                                <strong>{kpi.value}</strong>
                                {kpi.hint && <p>{kpi.hint}</p>}
                            </article>
                        ))}
                    </div>

                    <div className="ui-report-controls">
                        {PERIODS.map((value) => (
                            <button
                                key={value}
                                className={days === value ? 'primary-btn' : 'secondary-btn'}
                                onClick={() => setDays(value)}
                            >
                                {value === 7
                                    ? text.filters.last7
                                    : value === 30
                                      ? text.filters.last30
                                      : text.filters.last90}
                            </button>
                        ))}
                    </div>

                    <div className="ui-split">
                        <MovementChart movement={data.movement} text={text} format={format} />
                        <article className="panel">
                            <div className="panel-title">
                                <h2>{copy.valueByGroup}</h2>
                            </div>
                            <div className="ui-bars">
                                {data.by_type.map((group) => (
                                    <div className="ui-bar-row" key={group.key}>
                                        <div className="ui-bar-label">
                                            <span>
                                                {copy.tabs[group.key]}{' '}
                                                <small>({copy.itemsCount(group.items)})</small>
                                            </span>
                                            <b>{format.money(group.value)}</b>
                                        </div>
                                        <div className="ui-bar-track">
                                            <div
                                                className={`ui-bar-fill ${BAR_CLASS[group.key]}`}
                                                style={{
                                                    width: `${(group.value / maxGroup) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    </div>

                    <div className="ui-report-grid">
                        <article className="panel">
                            <div className="panel-title">
                                <h2>{copy.attentionTitle}</h2>
                            </div>
                            {data.attention.length ? (
                                <ul className="ui-restock">
                                    {data.attention.map((row) => (
                                        <li key={row.id}>
                                            <span>
                                                <b>{row.name}</b>
                                                <small>
                                                    {copy.reorderAt(
                                                        format.number(row.reorder_level),
                                                    )}
                                                </small>
                                            </span>
                                            <span
                                                className={`ui-chip ${row.status === 'out' ? 'bad' : 'warn'}`}
                                            >
                                                {format.number(row.on_hand)} {row.unit ?? ''}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="ui-empty">{copy.attentionEmpty}</div>
                            )}
                        </article>
                        <article className="panel">
                            <div className="panel-title">
                                <h2>{copy.topItems}</h2>
                            </div>
                            <div className="ui-bars">
                                {data.top_items.length ? (
                                    data.top_items.map((row) => (
                                        <div className="ui-bar-row" key={row.id}>
                                            <div className="ui-bar-label">
                                                <span>{row.name}</span>
                                                <b>{format.money(row.value)}</b>
                                            </div>
                                            <div className="ui-bar-track">
                                                <div
                                                    className="ui-bar-fill"
                                                    style={{
                                                        width: `${(row.value / maxTop) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="ui-empty">{copy.empty}</div>
                                )}
                            </div>
                        </article>
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
                                {copy.tabs[key]} ({data[key].length})
                            </button>
                        ))}
                    </div>
                    <article className="panel">
                        <StockTable
                            rows={data[tab]}
                            text={text}
                            format={format}
                            showHeld={tab === 'finished_goods'}
                        />
                    </article>
                </>
            )}

            {modal && data && (
                <ManageStockModal
                    kind={modal}
                    items={allItems}
                    warehouses={data.warehouses}
                    text={text}
                    onClose={() => setModal(null)}
                    onDone={(message) => {
                        setModal(null);
                        setNotice(message);
                        reload();
                    }}
                />
            )}
        </section>
    );
}
