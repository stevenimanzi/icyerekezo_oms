import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { makeFormat } from '../../../core/format';
import type { AuthUser, Locale } from '../../../core/types';
import './manual-sales.css';
import { NewSaleModal } from './NewSaleModal';
import { SaleDetailsModal } from './SaleDetailsModal';
import { SalesReports } from './SalesReports';
import { SalesTab } from './SalesTab';
import { salesText } from './text';
import type { Sale } from './types';
import { useSalesOverview, type SalesFilters } from './useSalesOverview';

type Tab = 'sales' | 'reports';

const SEARCH_DELAY_MS = 300;
const NOTICE_MS = 8000;

export default function ManualSalesPage({ user, locale }: { user: AuthUser; locale: Locale }) {
    const text = salesText[locale];
    const [tab, setTab] = useState<Tab | null>(null);
    const [filters, setFilters] = useState<SalesFilters>({
        search: '',
        payment: '',
        from: '',
        to: '',
        page: 1,
    });
    const [searchInput, setSearchInput] = useState('');
    const [newSale, setNewSale] = useState(false);
    const [selected, setSelected] = useState<Sale | null>(null);
    const [notice, setNotice] = useState<{ message: string; receiptId?: number } | null>(null);
    const { data, error, loading, reload } = useSalesOverview(filters);

    const currency = data?.currency || user.current_factory?.currency_code || 'RWF';
    const format = useMemo(() => makeFormat(locale, currency), [locale, currency]);
    const canRecord = Boolean(data?.capabilities.record);
    const activeTab: Tab = tab ?? (data && !canRecord ? 'reports' : 'sales');

    useEffect(() => {
        const timer = window.setTimeout(
            () => setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 })),
            SEARCH_DELAY_MS,
        );

        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);

        return () => window.clearTimeout(timer);
    }, [notice]);

    return (
        <section className="ms">
            <div className="page-heading">
                <div>
                    <h1>{text.title}</h1>
                    <p>{text.subtitle}</p>
                </div>
                <div className="ms-actions">
                    <button className="secondary-btn" onClick={reload} disabled={loading}>
                        <RefreshCw size={15} />
                        {text.refresh}
                    </button>
                    {canRecord && (
                        <button className="primary-btn" onClick={() => setNewSale(true)}>
                            + {text.newSale}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="ms-error">{error}</div>}
            {notice && (
                <div className="ms-notice" role="status">
                    <span>{notice.message}</span>
                    {notice.receiptId && (
                        <button
                            onClick={() =>
                                window.open(
                                    `/api/sales/manual/${notice.receiptId}/receipt`,
                                    '_blank',
                                )
                            }
                        >
                            {text.form.printReceipt}
                        </button>
                    )}
                </div>
            )}

            {data && (
                <div className="ms-kpis">
                    <article className="panel ms-kpi">
                        <small>{text.kpi.today}</small>
                        <strong>{format.money(data.today.revenue)}</strong>
                        <p>{text.kpi.todayCount(data.today.sales)}</p>
                    </article>
                    <article className={`panel ms-kpi ${data.outstanding > 0 ? 'alert' : ''}`}>
                        <small>{text.kpi.owed}</small>
                        <strong>{format.money(data.outstanding)}</strong>
                        <p>{text.kpi.owedHint}</p>
                    </article>
                </div>
            )}

            <div className="ms-tabs" role="tablist">
                {(['sales', 'reports'] as Tab[]).map((key) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={activeTab === key}
                        className={activeTab === key ? 'active' : ''}
                        onClick={() => setTab(key)}
                    >
                        {text.tabs[key]}
                    </button>
                ))}
            </div>

            {activeTab === 'reports' ? (
                <SalesReports text={text} format={format} />
            ) : data ? (
                <SalesTab
                    data={data}
                    filters={filters}
                    searchInput={searchInput}
                    text={text}
                    format={format}
                    onSearch={setSearchInput}
                    onFilters={(changes) => setFilters((current) => ({ ...current, ...changes }))}
                    onOpen={setSelected}
                />
            ) : (
                <div className="panel ms-empty">{text.loading}</div>
            )}

            {newSale && data?.form && (
                <NewSaleModal
                    options={data.form}
                    text={text}
                    format={format}
                    onClose={() => setNewSale(false)}
                    onSaved={(sale) => {
                        setNewSale(false);
                        setNotice({
                            message: text.form.recorded(sale.document_number),
                            receiptId: sale.id,
                        });
                        setTab('sales');
                        reload();
                    }}
                />
            )}

            {selected && data && (
                <SaleDetailsModal
                    sale={data.sales.data.find((sale) => sale.id === selected.id) ?? selected}
                    methods={
                        data.form?.payment_methods ?? [
                            'cash',
                            'mobile_money',
                            'bank_transfer',
                            'cheque',
                            'card',
                        ]
                    }
                    canRecord={canRecord}
                    text={text}
                    format={format}
                    onClose={() => setSelected(null)}
                    onChanged={(message) => {
                        setNotice({ message });
                        reload().then(() => setSelected(null));
                    }}
                />
            )}
        </section>
    );
}
