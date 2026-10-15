import type { Format } from '../../../core/format';
import type { StockText } from './text';
import type { StockRow } from './types';

type Props = { rows: StockRow[]; text: StockText; format: Format; showHeld: boolean };

export function StockTable({ rows, text, format, showHeld }: Props) {
    const copy = text.overview;

    return (
        <div className="ui-table-wrap">
            <table className="ui-table" style={{ minWidth: 760 }}>
                <thead>
                    <tr>
                        <th>{copy.item}</th>
                        <th className="num">{copy.onHand}</th>
                        <th className="num">{copy.available}</th>
                        {showHeld && <th className="num">{copy.held}</th>}
                        <th className="num">{copy.reorder}</th>
                        <th className="num">{copy.value}</th>
                        <th>{copy.status}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length ? (
                        rows.map((row) => (
                            <tr key={row.id}>
                                <td>
                                    <b>{row.name}</b>
                                    <small>{row.sku}</small>
                                </td>
                                <td className="num">
                                    <b>{format.number(row.on_hand)}</b> {row.unit ?? ''}
                                </td>
                                <td className="num">{format.number(row.available)}</td>
                                {showHeld && (
                                    <td className="num">
                                        {row.held > 0 ? format.number(row.held) : text.none}
                                    </td>
                                )}
                                <td className="num">
                                    {row.reorder_level > 0
                                        ? format.number(row.reorder_level)
                                        : text.none}
                                </td>
                                <td className="num">{format.money(row.value)}</td>
                                <td>
                                    <span
                                        className={`ui-chip ${row.status === 'ok' ? 'ok' : row.status === 'low' ? 'warn' : 'bad'}`}
                                    >
                                        {copy.statusLabels[row.status]}
                                    </span>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={showHeld ? 7 : 6} className="empty">
                                {copy.empty}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
