import { useMemo, useState } from 'react';
import type { FlowText } from './text';

export type LotFilterValues = {
    q: string;
    product: string;
    color: string;
    size: string;
    fabric: string;
};

export const emptyLotFilters: LotFilterValues = {
    q: '',
    product: '',
    color: '',
    size: '',
    fabric: '',
};

type Filterable = {
    lot_number: string | null;
    product: string | null;
    color: string | null;
    size: string | null;
    fabric?: string | null;
};

const unique = (values: (string | null | undefined)[]) =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
    );

/** Keeps the filter choices and narrows a list of lots (or deliveries) by lot number, product, colour, size and fabric. */
export function useLotFilters<T extends Filterable>(rows: T[]) {
    const [values, setValues] = useState<LotFilterValues>(emptyLotFilters);

    const options = useMemo(
        () => ({
            products: unique(rows.map((row) => row.product)),
            colors: unique(rows.map((row) => row.color)),
            sizes: unique(rows.map((row) => row.size)),
            fabrics: unique(rows.map((row) => row.fabric)),
        }),
        [rows],
    );

    const filtered = useMemo(() => {
        const needle = values.q.trim().toLowerCase();

        return rows.filter(
            (row) =>
                (!needle || (row.lot_number ?? '').toLowerCase().includes(needle)) &&
                (!values.product || row.product === values.product) &&
                (!values.color || row.color === values.color) &&
                (!values.size || row.size === values.size) &&
                (!values.fabric || row.fabric === values.fabric),
        );
    }, [rows, values]);

    const active = Object.values(values).some(Boolean);

    return {
        values,
        setValues,
        options,
        filtered,
        active,
        clear: () => setValues(emptyLotFilters),
    };
}

type Props = {
    values: LotFilterValues;
    options: { products: string[]; colors: string[]; sizes: string[]; fabrics: string[] };
    text: FlowText;
    onChange: (values: LotFilterValues) => void;
    onClear: () => void;
    active: boolean;
};

export function LotFilters({ values, options, text, onChange, onClear, active }: Props) {
    const set = (key: keyof LotFilterValues) => (event: { target: { value: string } }) =>
        onChange({ ...values, [key]: event.target.value });

    const select = (key: keyof LotFilterValues, all: string, list: string[]) =>
        list.length > 0 && (
            <label>
                <select value={values[key]} onChange={set(key)}>
                    <option value="">{all}</option>
                    {list.map((entry) => (
                        <option key={entry} value={entry}>
                            {entry}
                        </option>
                    ))}
                </select>
            </label>
        );

    return (
        <div className="ui-toolbar">
            <label className="grow">
                <input value={values.q} placeholder={text.work.searchLots} onChange={set('q')} />
            </label>
            {select('product', text.work.allProducts, options.products)}
            {select('color', text.work.allColours, options.colors)}
            {select('size', text.work.allSizes, options.sizes)}
            {select('fabric', text.work.allFabrics, options.fabrics)}
            {active && (
                <button className="secondary-btn" onClick={onClear}>
                    {text.work.clearFilters}
                </button>
            )}
        </div>
    );
}
