import type { StockText } from './text';
import type { StockItemOption } from './types';

type Props = {
    items: StockItemOption[];
    value: string;
    text: StockText;
    onChange: (value: string) => void;
    describe?: (item: StockItemOption) => string;
    onlyInStock?: boolean;
};

const GROUPS = ['raw_material', 'finished_good', 'other'] as const;

const groupOf = (type: string) =>
    type === 'raw_material' || type === 'finished_good' ? type : 'other';

/** A drop-down of the product catalogue, grouped into raw materials, finished products and the rest. */
export function ItemSelect({ items, value, text, onChange, describe, onlyInStock = false }: Props) {
    const usable = onlyInStock ? items.filter((item) => item.available > 0) : items;

    return (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">{text.chooseItem}</option>
            {GROUPS.map((group) => {
                const rows = usable.filter((item) => groupOf(item.type) === group);

                return rows.length ? (
                    <optgroup key={group} label={text.itemGroups[group]}>
                        {rows.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                                {item.color ? ` · ${item.color}` : ''}
                                {item.unit ? ` (${item.unit})` : ''}
                                {describe ? ` — ${describe(item)}` : ''}
                            </option>
                        ))}
                    </optgroup>
                ) : null;
            })}
        </select>
    );
}
