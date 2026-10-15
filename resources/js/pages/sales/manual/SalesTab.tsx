import type { Format } from '../../../core/format';
import { StatusChip } from './components/StatusChip';
import type { salesText } from './text';
import type { Sale, SalesOverview } from './types';
import type { SalesFilters } from './useSalesOverview';

type Props = {
    data: SalesOverview;
    filters: SalesFilters;
    searchInput: string;
    text: (typeof salesText)['en'];
    format: Format;
    onSearch: (value: string) => void;
    onFilters: (changes: Partial<SalesFilters>) => void;
    onOpen: (sale: Sale) => void;
};

const PAYMENT_FILTERS = ['', 'unpaid', 'partially_paid', 'paid', 'cancelled'] as const;

export function SalesTab({
    data,
    filters,
    searchInput,
    text,
    format,
    onSearch,
    onFilters,
    onOpen,
}: Props) {
    const { sales } = data;
    const filtered = Boolean(filters.search || filters.payment || filters.from || filters.to);

    const openReceipt = (sale: Sale) =>
        window.open(`/api/sales/manual/${sale.id}/receipt`, '_blank');

    return (
        <article className="panel">
            <div className="ms-toolbar">
                <label className="grow">
                    <span>{text.filters.search}</span>
                    <input
                        type="search"
                        value={searchInput}
                        placeholder={text.filters.search}
                        onChange={(event) => onSearch(event.target.value)}
                    />
                </label>
                <label>
                    <span>{text.table.status}</span>
                    <select
                        value={filters.payment}
                        onChange={(event) => onFilters({ payment: event.target.value, page: 1 })}
                    >
                        {PAYMENT_FILTERS.map((value) => (
                            <option key={value} value={value}>
                                {value === '' ? text.filters.all : text.filters[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>{text.filters.from}</span>
                    <input
                        type="date"
                        value={filters.from}
                        onChange={(event) => onFilters({ from: event.target.value, page: 1 })}
                    />
                </label>
                <label>
                    <span>{text.filters.to}</span>
                    <input
                        type="date"
                        value={filters.to}
                        onChange={(event) => onFilters({ to: event.target.value, page: 1 })}
                    />
                </label>
                {filtered && (
                    <button
                        className="secondary-btn"
                        onClick={() => {
                            onSearch('');
                            onFilters({ payment: '', from: '', to: '', page: 1 });
                        }}
                    >
                        {text.filters.clear}
                    </button>
                )}
            </div>

            <div className="ms-table-wrap">
                <table className="ms-table">
                    <thead>
                        <tr>
                            <th>{text.table.receipt}</th>
                            <th>{text.table.date}</th>
                            <th>{text.table.customer}</th>
                            <th className="num">{text.table.items}</th>
                            <th className="num">{text.table.total}</th>
                            <th className="num">{text.table.paid}</th>
                            <th className="num">{text.table.balance}</th>
                            <th>{text.table.status}</th>
                            <th>{text.table.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.data.length ? (
                            sales.data.map((sale) => {
                                const balance =
                                    Number(sale.total_amount) - Number(sale.paid_amount);
                                const cancelled = sale.status === 'cancelled';

                                return (
                                    <tr
                                        key={sale.id}
                                        className="clickable"
                                        onClick={() => onOpen(sale)}
                                    >
                                        <td>
                                            <b>{sale.document_number}</b>
                                        </td>
                                        <td>{format.date(sale.document_date)}</td>
                                        <td>
                                            {sale.customer_name}
                                            {sale.customer_phone && (
                                                <small>{sale.customer_phone}</small>
                                            )}
                                        </td>
                                        <td className="num">{sale.item_count}</td>
                                        <td className="num">
                                            <b>{format.money(Number(sale.total_amount))}</b>
                                        </td>
                                        <td className="num">
                                            {format.money(Number(sale.paid_amount))}
                                        </td>
                                        <td className="num">
                                            {cancelled || balance <= 0
                                                ? '—'
                                                : format.money(balance)}
                                        </td>
                                        <td>
                                            <StatusChip sale={sale} text={text} />
                                        </td>
                                        <td onClick={(event) => event.stopPropagation()}>
                                            <div className="ms-row-actions">
                                                <button
                                                    className="ms-link"
                                                    onClick={() => onOpen(sale)}
                                                >
                                                    {text.table.view}
                                                </button>
                                                <button
                                                    className="ms-link"
                                                    onClick={() => openReceipt(sale)}
                                                >
                                                    {text.table.receiptPdf}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={9} className="empty">
                                    {filtered ? text.table.emptyFiltered : text.table.empty}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {sales.last_page > 1 && (
                <div className="ms-pager">
                    <span>{text.table.page(sales.current_page, sales.last_page, sales.total)}</span>
                    <div>
                        <button
                            className="secondary-btn"
                            disabled={sales.current_page <= 1}
                            onClick={() => onFilters({ page: sales.current_page - 1 })}
                        >
                            {text.table.previous}
                        </button>
                        <button
                            className="secondary-btn"
                            disabled={sales.current_page >= sales.last_page}
                            onClick={() => onFilters({ page: sales.current_page + 1 })}
                        >
                            {text.table.next}
                        </button>
                    </div>
                </div>
            )}
        </article>
    );
}
