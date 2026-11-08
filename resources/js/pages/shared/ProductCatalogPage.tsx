import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash, X } from 'lucide-react';
import { startPolling } from '../../core/polling';

const csrf = () =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrf(),
            ...(options.headers || {}),
        },
    });
    const text = await response.text();
    let payload: any = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('Something went wrong. Please sign in again.');
    }
    if (!response.ok) {
        const first = payload.errors ? Object.values(payload.errors).flat()[0] : null;
        throw new Error(String(first || payload.message || 'We could not save this. Please try again.'));
    }
    return payload;
}
const emptyItem = {
    name: '',
    color: '',
    type: 'raw_material',
    category_id: '',
    unit_id: '',
    standard_cost: '0',
    reorder_level: '0',
    is_active: true,
};
const emptyCategory = { name: '' };
const emptyUnit = { name: '', symbol: '', dimension: 'count', precision: '2', is_active: true };

export default function ProductCatalogPage({ user, locale }: { user: any; locale: 'en' | 'fr' }) {
    const [data, setData] = useState<any>(null);
    const [tab, setTab] = useState('items');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [updated, setUpdated] = useState<Date | null>(null);
    const [modal, setModal] = useState<'item' | 'category' | 'unit' | 'price' | null>(null);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(emptyItem);
    const [busy, setBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);

    // Only the warehouse keeper records items, categories and units.
    // Finance can only change prices.
    const canRecord = Boolean(user?.roles?.some((role: any) => role.slug === 'warehouse-keeper'));
    const permissions: string[] = user?.permissions || [];
    const canPrice = permissions.includes('*') || permissions.includes('products.set_price');

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            setData(await request('/api/products/overview'));
            setUpdated(new Date());
            setError('');
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        load();
        const timer = startPolling(() => load(true), 15000);
        return () => window.clearInterval(timer);
    }, [load]);

    const open = (type: 'item' | 'category' | 'unit' | 'price', row: any = null) => {
        setEditing(row);
        setError('');
        setSuccess('');
        setModal(type);
        setForm(
            type === 'price'
                ? { standard_cost: String(row?.standard_cost || 0) }
                : row
                ? type === 'item'
                    ? {
                          name: row.name,
                          color: row.color || '',
                          type: row.type,
                          category_id: row.category_id || '',
                          unit_id: row.unit_id || '',
                          standard_cost: String(row.standard_cost || 0),
                          reorder_level: String(row.reorder_level || 0),
                          is_active: Boolean(row.is_active),
                      }
                    : type === 'category'
                      ? { name: row.name }
                      : {
                            name: row.name,
                            symbol: row.symbol,
                            dimension: row.dimension,
                            precision: String(row.precision),
                            is_active: Boolean(row.is_active),
                        }
                : type === 'item'
                  ? emptyItem
                  : type === 'category'
                    ? emptyCategory
                    : emptyUnit,
        );
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modal) return;
        setBusy(true);
        setError('');
        try {
            const base =
                modal === 'item' || modal === 'price'
                    ? '/api/inventory/items'
                    : modal === 'category'
                      ? '/api/products/categories'
                      : '/api/products/units';
            await request(
                modal === 'price'
                    ? `${base}/${editing.id}/price`
                    : editing
                      ? `${base}/${editing.id}`
                      : base,
                {
                    method: editing ? 'PATCH' : 'POST',
                    body: JSON.stringify(form),
                },
            );
            setModal(null);
            setSuccess(
                modal === 'price'
                    ? `Price of ${editing.name} was updated.`
                    : `${modal === 'item' ? 'Item' : modal === 'category' ? 'Category' : 'Unit'} ${editing ? 'updated' : 'created'} successfully.`,
            );
            await load(true);
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const removeCategory = async () => {
        if (!deleteTarget) return;
        setBusy(true);
        setError('');
        try {
            const result = await request(`/api/products/categories/${deleteTarget.id}`, {
                method: 'DELETE',
            });
            setDeleteTarget(null);
            setSuccess(result.message || 'Category deleted successfully.');
            await load(true);
        } catch (reason: any) {
            setError(reason.message);
            setDeleteTarget(null);
        } finally {
            setBusy(false);
        }
    };

    const money = (value: any) =>
        new Intl.NumberFormat(locale === 'fr' ? 'fr-RW' : 'en-RW', {
            style: 'currency',
            currency: user.current_factory?.currency_code || 'RWF',
            maximumFractionDigits: 0,
        }).format(Number(value) || 0);
    const quantity = (value: any, unit = '') =>
        `${Number(value || 0).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 3 })}${unit ? ' ' + unit : ''}`;
    const units = useMemo(
        () => new Map((data?.units || []).map((unit: any) => [unit.id, unit])),
        [data],
    );

    if (loading && !data) {
        return (
            <section className="product-catalog-page">
                <div className="panel products-loading">
                    <RefreshCw className="spin" />
                    <h2>Loading products and materials</h2>
                    <p>Please wait a moment...</p>
                </div>
            </section>
        );
    }

    const tabs: [string, string][] = [
        ['items', 'Products and materials'],
        ['categories', 'Categories'],
        ['boms', 'Materials needed'],
        ['units', 'Units and conversions'],
    ];

    return (
        <section className="product-catalog-page">
            <header className="products-heading">
                <div>
                    <div className="eyebrow">
                        <i></i>PRODUCT DATA
                    </div>
                    <h1>Products and materials</h1>
                    <p>
                        {canRecord
                            ? 'Add and manage the products, materials, categories and units used in this factory.'
                            : 'See every product and material in this factory. You can change the price of an item.'}
                    </p>
                    <small>{updated ? 'Updated ' + updated.toLocaleTimeString() : ''}</small>
                </div>
                <div className="products-heading-actions">
                    {canRecord && (
                        <>
                            <button className="secondary-btn" onClick={() => open('item')}>
                                Add item
                            </button>
                            <button className="secondary-btn" onClick={() => open('category')}>
                                Add category
                            </button>
                            <button className="primary-btn" onClick={() => open('unit')}>
                                Add unit
                            </button>
                        </>
                    )}
                    <button className="secondary-btn" disabled={loading} onClick={() => load()}>
                        Refresh
                    </button>
                </div>
            </header>

            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            {data && (
                <>
                    <div className="products-metrics ui-kpis">
                        <Metric label="All items" value={data.summary.items} />
                        <Metric label="Active items" value={data.summary.active_items} />
                        <Metric label="Finished products" value={data.summary.finished_products} />
                        <Metric label="Raw materials" value={data.summary.raw_materials} />
                        <Metric label="Product recipes" value={data.summary.recipes} />
                    </div>
                    <nav className="products-tabs" role="tablist">
                        {tabs.map(([key, label]) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={tab === key}
                                className={tab === key ? 'active' : ''}
                                onClick={() => setTab(key)}
                            >
                                {label}
                                <span>
                                    {key === 'items'
                                        ? data.items.length
                                        : key === 'categories'
                                          ? data.categories.length
                                          : key === 'boms'
                                            ? data.boms.length
                                            : data.units.length}
                                </span>
                            </button>
                        ))}
                    </nav>
                    <article className="panel products-data-panel">
                        {tab === 'items' ? (
                            <Items
                                rows={data.items}
                                money={money}
                                quantity={quantity}
                                edit={canRecord ? (row: any) => open('item', row) : null}
                                price={canPrice ? (row: any) => open('price', row) : null}
                            />
                        ) : tab === 'categories' ? (
                            <Categories
                                rows={data.categories}
                                edit={canRecord ? (row: any) => open('category', row) : null}
                                remove={canRecord ? setDeleteTarget : null}
                            />
                        ) : tab === 'boms' ? (
                            <Boms rows={data.boms} units={units} quantity={quantity} />
                        ) : (
                            <Units
                                rows={data.units}
                                conversions={data.conversions}
                                edit={canRecord ? (row: any) => open('unit', row) : null}
                            />
                        )}
                    </article>
                </>
            )}

            {modal && (
                <div className="modal-backdrop" onMouseDown={() => !busy && setModal(null)}>
                    <div
                        className="warehouse-modal products-modal"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <header>
                            <div>
                                <h2>
                                    {modal === 'price'
                                        ? 'Change price'
                                        : `${editing ? 'Edit' : 'Add'} ${modal}`}
                                </h2>
                                <p>
                                    {modal === 'price'
                                        ? editing?.name
                                        : modal === 'item'
                                          ? 'The item code is made for you and cannot be repeated.'
                                          : modal === 'category'
                                            ? 'Put similar items in one group.'
                                            : 'A unit is how an item is counted or measured.'}
                                </p>
                            </div>
                            <button type="button" onClick={() => setModal(null)}>
                                <X />
                            </button>
                        </header>
                        <form className="warehouse-form" onSubmit={save}>
                            {modal === 'price' ? (
                                <div className="warehouse-form-grid">
                                    <Field label={`New price per ${editing?.unit?.symbol || 'unit'}`}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            autoFocus
                                            required
                                            value={form.standard_cost}
                                            onChange={(e) =>
                                                setForm({ ...form, standard_cost: e.target.value })
                                            }
                                        />
                                    </Field>
                                </div>
                            ) : modal === 'item' ? (
                                <ItemForm form={form} setForm={setForm} data={data} />
                            ) : modal === 'category' ? (
                                <CategoryForm form={form} setForm={setForm} />
                            ) : (
                                <UnitForm form={form} setForm={setForm} />
                            )}
                            <footer>
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => setModal(null)}
                                >
                                    Cancel
                                </button>
                                <button className="primary-btn" disabled={busy}>
                                    {busy
                                        ? 'Saving...'
                                        : modal === 'price'
                                          ? 'Save price'
                                          : editing
                                            ? 'Save changes'
                                            : `Add ${modal}`}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="modal-backdrop" onMouseDown={() => !busy && setDeleteTarget(null)}>
                    <div
                        className="warehouse-modal products-modal products-confirm-modal"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <header>
                            <div>
                                <h2>Delete category?</h2>
                                <p>
                                    This action permanently removes the category from this factory.
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setDeleteTarget(null)}
                            >
                                <X />
                            </button>
                        </header>
                        <div className="products-confirm-body">
                            <span>
                                <Trash size={18} />
                            </span>
                            <div>
                                <strong>{deleteTarget.name}</strong>
                                <p>
                                    {deleteTarget.items_count > 0
                                        ? `This category is used by ${deleteTarget.items_count} ${deleteTarget.items_count === 1 ? 'item' : 'items'} and cannot be deleted until those items are moved.`
                                        : 'This category is not used by any item and can be safely deleted.'}
                                </p>
                            </div>
                        </div>
                        <footer className="products-confirm-actions">
                            <button
                                type="button"
                                className="secondary-btn"
                                disabled={busy}
                                onClick={() => setDeleteTarget(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="danger-btn"
                                disabled={busy || deleteTarget.items_count > 0}
                                onClick={removeCategory}
                            >
                                <Trash size={14} />
                                {busy ? 'Deleting...' : 'Delete category'}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </section>
    );
}

function Field({ label, children }: any) {
    return (
        <label>
            <span>{label}</span>
            {children}
        </label>
    );
}
const COMMON_COLOURS = [
    'Black',
    'White',
    'Grey',
    'Blue',
    'Navy',
    'Red',
    'Green',
    'Yellow',
    'Orange',
    'Pink',
    'Purple',
    'Brown',
    'Beige',
];

function ItemForm({ form, setForm, data }: any) {
    const used = (data.items || []).map((item: any) => item.color).filter(Boolean);
    const colours = Array.from(new Set([...used, ...COMMON_COLOURS]));
    const set = (key: string, value: any) => setForm((old: any) => ({ ...old, [key]: value }));
    return (
        <div className="warehouse-form-grid">
            <Field label="Item name">
                <input
                    required
                    value={form.name}
                    placeholder="Example: Cotton fabric"
                    onChange={(e) => set('name', e.target.value)}
                />
            </Field>
            <Field label="Colour (fabrics and coloured items)">
                <input
                    list="item-colours"
                    value={form.color}
                    placeholder="Example: Blue"
                    onChange={(e) => set('color', e.target.value)}
                />
                <datalist id="item-colours">
                    {colours.map((name) => (
                        <option key={name} value={name} />
                    ))}
                </datalist>
            </Field>
            <Field label="Item code">
                <input disabled value="Generated automatically when saved" />
            </Field>
            <Field label="Item type">
                <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                    <option value="raw_material">Raw material</option>
                    <option value="semi_finished">Semi-finished item</option>
                    <option value="finished_good">Finished product</option>
                    <option value="packaging">Packaging</option>
                    <option value="spare_part">Spare part</option>
                    <option value="waste">Waste</option>
                    <option value="by_product">By-product</option>
                </select>
            </Field>
            <Field label="Category">
                <select
                    value={form.category_id}
                    onChange={(e) => set('category_id', e.target.value)}
                >
                    <option value="">Not categorized</option>
                    {data.categories.map((x: any) => (
                        <option key={x.id} value={x.id}>
                            {x.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Measurement unit">
                <select
                    required
                    value={form.unit_id}
                    onChange={(e) => set('unit_id', e.target.value)}
                >
                    <option value="">Choose unit</option>
                    {data.units
                        .filter((x: any) => x.is_active || String(x.id) === String(form.unit_id))
                        .map((x: any) => (
                            <option key={x.id} value={x.id}>
                                {x.name} ({x.symbol})
                            </option>
                        ))}
                </select>
            </Field>
            <Field label="Cost per unit">
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.standard_cost}
                    onChange={(e) => set('standard_cost', e.target.value)}
                />
            </Field>

            <Field label="Low-stock warning level">
                <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.reorder_level}
                    onChange={(e) => set('reorder_level', e.target.value)}
                />
            </Field>
            <label className="warehouse-check">
                <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => set('is_active', e.target.checked)}
                />
                <span>Active and available for factory work</span>
            </label>
        </div>
    );
}
function CategoryForm({ form, setForm }: any) {
    const set = (key: string, value: any) => setForm((old: any) => ({ ...old, [key]: value }));
    return (
        <div className="warehouse-form-grid">
            <Field label="Category name">
                <input
                    required
                    value={form.name}
                    placeholder="Example: Fabrics"
                    onChange={(e) => set('name', e.target.value)}
                />
            </Field>
            <Field label="Category code">
                <input disabled value="Generated automatically when saved" />
            </Field>
        </div>
    );
}
function UnitForm({ form, setForm }: any) {
    const set = (key: string, value: any) => setForm((old: any) => ({ ...old, [key]: value }));
    return (
        <div className="warehouse-form-grid">
            <Field label="Unit name">
                <input
                    required
                    value={form.name}
                    placeholder="Example: Metre"
                    onChange={(e) => set('name', e.target.value)}
                />
            </Field>
            <Field label="Symbol">
                <input
                    required
                    value={form.symbol}
                    placeholder="Example: m"
                    onChange={(e) => set('symbol', e.target.value)}
                />
            </Field>
            <Field label="Measurement type">
                <select value={form.dimension} onChange={(e) => set('dimension', e.target.value)}>
                    {['count', 'mass', 'volume', 'length', 'area', 'time', 'other'].map((x) => (
                        <option key={x}>{x}</option>
                    ))}
                </select>
            </Field>
            <Field label="Decimal places">
                <input
                    type="number"
                    min="0"
                    max="6"
                    value={form.precision}
                    onChange={(e) => set('precision', e.target.value)}
                />
            </Field>
            <label className="warehouse-check">
                <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => set('is_active', e.target.checked)}
                />
                <span>Active</span>
            </label>
        </div>
    );
}
function Metric({ label, value }: any) {
    return (
        <article className="ui-kpi">
            <small>{label}</small>
            <strong>{Number(value || 0).toLocaleString()}</strong>
        </article>
    );
}
function PanelHeader({ title, count }: any) {
    return (
        <header className="products-panel-header">
            <h2>{title}</h2>
            <span>
                {count} {count === 1 ? 'record' : 'records'}
            </span>
        </header>
    );
}
function Empty({ columns, text }: any) {
    return (
        <tr>
            <td colSpan={columns}>
                <div className="products-empty">
                    <b>{text}</b>
                    <span>New database records will appear here automatically.</span>
                </div>
            </td>
        </tr>
    );
}
function Items({ rows, money, quantity, edit, price }: any) {
    const hasActions = Boolean(edit || price);
    return (
        <>
            <PanelHeader title="Products and materials" count={rows.length} />
            <div className="admin-table-wrap">
                <table className="admin-table products-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Colour</th>
                            <th>Type</th>
                            <th>Category</th>
                            <th>Unit</th>
                            <th>In stock</th>
                            <th>Price per unit</th>
                            <th>Stock value</th>
                            <th>Status</th>
                            {hasActions && <th>Action</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length ? (
                            rows.map((item: any) => (
                                <tr key={item.id}>
                                    <td>
                                        <b>{item.name}</b>
                                    </td>
                                    <td>
                                        {item.color ? (
                                            <span className="ui-colour">{item.color}</span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td>{String(item.type).replaceAll('_', ' ')}</td>
                                    <td>{item.category_name || 'Not categorized'}</td>
                                    <td>{item.unit?.symbol || '—'}</td>
                                    <td>{quantity(item.quantity_on_hand, item.unit?.symbol)}</td>
                                    <td>{money(item.standard_cost)}</td>
                                    <td>{money(item.stock_value)}</td>
                                    <td>
                                        <span
                                            className={`admin-status ${item.is_active ? 'active' : 'suspended'}`}
                                        >
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    {hasActions && (
                                        <td>
                                            {edit && (
                                                <button
                                                    className="table-action"
                                                    onClick={() => edit(item)}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {!edit && price && (
                                                <button
                                                    className="table-action"
                                                    onClick={() => price(item)}
                                                >
                                                    Change price
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <Empty
                                columns={hasActions ? 10 : 9}
                                text="No products or materials have been added yet."
                            />
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
function Categories({ rows, edit, remove }: any) {
    const hasActions = Boolean(edit || remove);
    return (
        <>
            <PanelHeader title="Item categories" count={rows.length} />
            <div className="admin-table-wrap">
                <table className="admin-table products-table compact">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Category</th>
                            <th>Items</th>
                            {hasActions && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length ? (
                            rows.map((item: any) => (
                                <tr key={item.id}>
                                    <td>
                                        <b>{item.code}</b>
                                    </td>
                                    <td>{item.name}</td>
                                    <td>{item.items_count}</td>
                                    {hasActions && (
                                        <td>
                                            <div className="products-row-actions">
                                                {edit && (
                                                    <button
                                                        className="table-action action-edit-btn"
                                                        onClick={() => edit(item)}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                {remove && (
                                                    <button
                                                        className="table-action danger action-delete-btn"
                                                        onClick={() => remove(item)}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <Empty
                                columns={hasActions ? 4 : 3}
                                text="No item categories have been added yet."
                            />
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
function Boms({ rows, units, quantity }: any) {
    return (
        <>
            <PanelHeader title="Materials needed for each product" count={rows.length} />
            <div className="products-recipes">
                {rows.length ? (
                    rows.map((bom: any) => (
                        <section key={bom.id}>
                            <header>
                                <div>
                                    <h3>{bom.item?.name || bom.name}</h3>
                                    <p>
                                        {bom.name} · Version {bom.version}
                                    </p>
                                </div>
                                <span
                                    className={`admin-status ${bom.status === 'active' ? 'active' : 'pending'}`}
                                >
                                    {bom.status === 'active' ? 'Active' : 'Draft'}
                                </span>
                            </header>
                            <div className="recipe-summary">
                                <span>
                                    Output{' '}
                                    <b>
                                        {quantity(
                                            bom.output_quantity,
                                            (units.get(bom.item?.unit_id) as any)?.symbol,
                                        )}
                                    </b>
                                </span>
                                <span>
                                    Expected waste <b>{Number(bom.expected_waste_percent || 0)}%</b>
                                </span>
                                <span>
                                    Materials <b>{bom.components.length}</b>
                                </span>
                            </div>
                            <table className="admin-table products-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Quantity needed</th>
                                        <th>Waste</th>
                                        <th>Required</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bom.components.map((component: any) => {
                                        const unit: any = units.get(component.unit_id);
                                        return (
                                            <tr key={component.id}>
                                                <td>
                                                    <b>{component.item?.name || 'Unknown item'}</b>
                                                </td>
                                                <td>
                                                    {quantity(component.quantity, unit?.symbol)}
                                                </td>
                                                <td>{Number(component.waste_percent || 0)}%</td>
                                                <td>
                                                    {component.is_optional
                                                        ? 'Optional'
                                                        : 'Required'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </section>
                    ))
                ) : (
                    <div className="products-empty">
                        <b>No product recipes have been recorded yet.</b>
                        <span>
                            Recipes are managed by the production manager and shown here for stock
                            planning.
                        </span>
                    </div>
                )}
            </div>
        </>
    );
}
function Units({ rows, conversions, edit }: any) {
    const hasActions = Boolean(edit);
    return (
        <>
            <PanelHeader title="Units and conversions" count={rows.length} />
            <div className="products-units-grid">
                <section>
                    <h3>Measurement units</h3>
                    <table className="admin-table products-table compact">
                        <thead>
                            <tr>
                                <th>Unit</th>
                                <th>Short name</th>
                                <th>Measurement</th>
                                <th>Decimal places</th>
                                <th>Status</th>
                                {hasActions && <th>Action</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length ? (
                                rows.map((unit: any) => (
                                    <tr key={unit.id}>
                                        <td>
                                            <b>{unit.name}</b>
                                        </td>
                                        <td>{unit.symbol}</td>
                                        <td>{unit.dimension}</td>
                                        <td>{unit.precision}</td>
                                        <td>{unit.is_active ? 'Active' : 'Inactive'}</td>
                                        {hasActions && (
                                            <td>
                                                <button
                                                    className="table-action"
                                                    onClick={() => edit(unit)}
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <Empty columns={hasActions ? 6 : 5} text="No units have been added yet." />
                            )}
                        </tbody>
                    </table>
                </section>
                <section>
                    <h3>Unit conversions</h3>
                    <table className="admin-table products-table compact">
                        <thead>
                            <tr>
                                <th>From</th>
                                <th>Conversion</th>
                                <th>To</th>
                            </tr>
                        </thead>
                        <tbody>
                            {conversions.length ? (
                                conversions.map((item: any) => (
                                    <tr key={item.id}>
                                        <td>1 {item.from_symbol}</td>
                                        <td>
                                            ×{' '}
                                            {Number(item.multiplier).toLocaleString(undefined, {
                                                maximumFractionDigits: 8,
                                            })}
                                        </td>
                                        <td>{item.to_symbol}</td>
                                    </tr>
                                ))
                            ) : (
                                <Empty
                                    columns={3}
                                    text="No unit conversions have been configured."
                                />
                            )}
                        </tbody>
                    </table>
                </section>
            </div>
        </>
    );
}
