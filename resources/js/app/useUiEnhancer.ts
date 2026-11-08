import { useEffect } from 'react';

/**
 * Two small project-wide touches that apply to every page, so no page has to remember them:
 *
 * 1. Every table that lists data gets a filter bar (search, dates, and drop-downs for columns such
 *    as status or type) unless the page already has its own filters.
 * 2. Buttons that have a text label do not also carry a decorative icon.
 *
 * Rows are only hidden, never removed, so the page's own logic keeps working.
 */

const MIN_ROWS = 6;
const MAX_SELECTS = 3;
const BAR_CLASS = 'data-filters tf-bar no-print';
const SKIP_HEADER = /action|^\s*$|^#$|^no\.?$/i;
const NOT_CATEGORY = /name|number|no\.|description|note|reference|email|phone|address|comment|reason|code|id$|link|details?/i;
const DATE_HEADER = /date|time|created|updated|received|ordered|dispatched|delivered|due|paid on|\bday\b|when|month|period|\bon\b/i;

type State = {
    bar: HTMLElement;
    search: string;
    from: string;
    to: string;
    selects: Map<number, string>;
    dateColumn: number;
    categoryColumns: number[];
    signature: string;
};

const states = new WeakMap<HTMLTableElement, State>();
const tracked = new Set<HTMLTableElement>();

const textOf = (cell: Element | undefined) => (cell?.textContent || '').replace(/\s+/g, ' ').trim();
const looksNumeric = (value: string) =>
    /\d/.test(value) && value.replace(/[A-Za-z]{1,4}/g, '').replace(/[\d.,\s%$€£:/-]/g, '') === '';

function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
    const columns = table.tHead?.rows[table.tHead.rows.length - 1]?.cells.length || 0;

    return Array.from(table.tBodies)
        .flatMap((body) => Array.from(body.rows))
        .filter((row) => row.cells.length === columns && !row.querySelector('td[colspan]'));
}

function skipTable(table: HTMLTableElement): boolean {
    if (!table.isConnected || table.dataset.nofilter !== undefined) return true;
    if (table.closest('.modal-backdrop, [role="dialog"], .no-table-filter, .sidebar, .print-only')) return true;
    if (/(^|\s)(fb-table|wrap-cells|noguchi-[a-z-]*table|legacy-order-table|report-print-table)(\s|$)/.test(table.className)) return true;
    if (!table.offsetParent && getComputedStyle(table).position !== 'fixed') return true;
    if (!table.tHead || !table.tHead.rows.length) return true;

    const parent = table.parentElement;
    if (!parent) return true;
    const style = getComputedStyle(parent);
    if (style.display.includes('flex') && style.flexDirection.startsWith('row')) return true;

    // The page already has filters near this table.
    const holder = table.closest('.panel, article, section, .fb-panel') || parent;
    const own = holder.querySelectorAll('input[type="search"], input[type="date"], select, input[type="text"]');
    for (const field of Array.from(own)) {
        if (!table.contains(field) && !field.closest('.tf-bar') && !field.closest('.modal-backdrop, [role="dialog"]')) return true;
    }
    const before = (table.closest('.admin-table-wrap, .ui-table-wrap, .report-table-scroll') || table).previousElementSibling;
    if (before && !before.classList.contains('tf-bar') && before.matches('.data-filters, .fb-filters, .filters, [class*="filter"], [class*="toolbar"]')) return true;

    return false;
}

function analyse(table: HTMLTableElement, rows: HTMLTableRowElement[]) {
    const head = table.tHead!.rows[table.tHead!.rows.length - 1];
    const simpleHead = table.tHead!.rows.length === 1 && Array.from(head.cells).every((cell) => cell.colSpan === 1);
    let dateColumn = -1;
    const categoryColumns: number[] = [];
    if (simpleHead) {
        Array.from(head.cells).forEach((cell, index) => {
            const label = textOf(cell);
            if (SKIP_HEADER.test(label)) return;
            const values = rows.map((row) => textOf(row.cells[index])).filter((value) => value && value !== '—' && value !== '-');
            if (values.length < rows.length / 2) return;
            if (dateColumn < 0 && DATE_HEADER.test(label)) {
                const parsed = values.filter((value) => /\d/.test(value) && !Number.isNaN(Date.parse(value))).length;
                if (parsed >= values.length * 0.6) {
                    dateColumn = index;
                    return;
                }
            }
            if (NOT_CATEGORY.test(label) || categoryColumns.length >= MAX_SELECTS) return;
            if (values.filter(looksNumeric).length > values.length / 2) return;
            const distinct = new Set(values);
            const longest = Math.max(...values.map((value) => value.length));
            if (distinct.size >= 2 && distinct.size <= 12 && distinct.size < rows.length && longest <= 32) categoryColumns.push(index);
        });
    }

    return { dateColumn, categoryColumns };
}

function build(table: HTMLTableElement, rows: HTMLTableRowElement[]): State {
    const { dateColumn, categoryColumns } = analyse(table, rows);
    const head = table.tHead!.rows[table.tHead!.rows.length - 1];
    const bar = document.createElement('div');
    bar.className = BAR_CLASS;
    bar.style.gridColumn = '1 / -1';
    const state: State = {
        bar,
        search: '',
        from: '',
        to: '',
        selects: new Map(),
        dateColumn,
        categoryColumns,
        signature: `${head.cells.length}:${dateColumn}:${categoryColumns.join(',')}`,
    };

    const field = (label: string, input: HTMLElement) => {
        const wrap = document.createElement('label');
        wrap.append(label, input);

        return wrap;
    };

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Type to search this table';
    search.addEventListener('input', () => {
        state.search = search.value.trim().toLowerCase();
        apply(table);
    });
    const searchLabel = field('Search', search);
    searchLabel.className = 'data-filters-search';
    bar.append(searchLabel);

    if (dateColumn >= 0) {
        const make = (label: string, key: 'from' | 'to') => {
            const input = document.createElement('input');
            input.type = 'date';
            input.addEventListener('input', () => {
                state[key] = input.value;
                apply(table);
            });
            bar.append(field(label, input));
        };
        make('From', 'from');
        make('To', 'to');
    }

    categoryColumns.forEach((index) => {
        const select = document.createElement('select');
        select.dataset.column = String(index);
        select.addEventListener('change', () => {
            state.selects.set(index, select.value);
            apply(table);
        });
        bar.append(field(textOf(head.cells[index]), select));
    });

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear filters';
    clear.addEventListener('click', () => {
        state.search = '';
        state.from = '';
        state.to = '';
        state.selects.clear();
        bar.querySelectorAll('input').forEach((input) => ((input as HTMLInputElement).value = ''));
        bar.querySelectorAll('select').forEach((select) => ((select as HTMLSelectElement).value = ''));
        apply(table);
    });
    bar.append(clear);

    const count = document.createElement('span');
    count.className = 'data-filters-count';
    bar.append(count);

    return state;
}

/** Fill each drop-down with the values that exist right now, keeping the user's choice. */
function refreshOptions(table: HTMLTableElement, state: State, rows: HTMLTableRowElement[]) {
    state.bar.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
        const index = Number(select.dataset.column);
        const values = Array.from(new Set(rows.map((row) => textOf(row.cells[index])).filter((v) => v && v !== '—' && v !== '-'))).sort();
        const key = values.join('|');
        if (select.dataset.options === key) return;
        const chosen = state.selects.get(index) || '';
        select.dataset.options = key;
        select.replaceChildren(new Option('All', ''), ...values.map((value) => new Option(value, value)));
        select.value = values.includes(chosen) ? chosen : '';
    });
}

function apply(table: HTMLTableElement) {
    const state = states.get(table);
    if (!state) return;
    const rows = bodyRows(table);
    const from = state.from ? Date.parse(`${state.from}T00:00:00`) : null;
    const to = state.to ? Date.parse(`${state.to}T23:59:59`) : null;
    let shown = 0;

    rows.forEach((row) => {
        let visible = !state.search || textOf(row).toLowerCase().includes(state.search);
        if (visible && state.dateColumn >= 0 && (from !== null || to !== null)) {
            const time = Date.parse(textOf(row.cells[state.dateColumn]));
            visible = !Number.isNaN(time) && (from === null || time >= from) && (to === null || time <= to);
        }
        if (visible) {
            for (const [index, wanted] of state.selects) {
                if (wanted && textOf(row.cells[index]) !== wanted) {
                    visible = false;
                    break;
                }
            }
        }
        row.style.display = visible ? '' : 'none';
        if (visible) shown += 1;
    });

    const count = state.bar.querySelector('.data-filters-count');
    if (count) count.textContent = `Showing ${shown} of ${rows.length}`;
}

function removeBar(table: HTMLTableElement) {
    const state = states.get(table);
    if (!state) return;
    state.bar.remove();
    bodyRows(table).forEach((row) => (row.style.display = ''));
    states.delete(table);
    tracked.delete(table);
}

function enhanceTable(table: HTMLTableElement) {
    const rows = skipTable(table) ? [] : bodyRows(table);
    if (rows.length < MIN_ROWS) {
        removeBar(table);

        return;
    }
    let state = states.get(table);
    const { dateColumn, categoryColumns } = analyse(table, rows);
    const signature = `${table.tHead!.rows[table.tHead!.rows.length - 1].cells.length}:${dateColumn}:${categoryColumns.join(',')}`;
    if (state && state.signature !== signature) {
        removeBar(table);
        state = undefined;
    }
    if (!state) {
        state = build(table, rows);
        const anchor = table.closest('.admin-table-wrap, .ui-table-wrap, .report-table-scroll') || table;
        anchor.parentElement!.insertBefore(state.bar, anchor);
        states.set(table, state);
        tracked.add(table);
    }
    refreshOptions(table, state, rows);
    apply(table);
}

function dropIcons(root: ParentNode) {
    const selector =
        'button.primary-btn, button.secondary-btn, button.table-action, button.fb-btn, button.ghost-btn, .fb-actions button, .products-heading-actions button, a.primary-btn, a.secondary-btn';
    root.querySelectorAll<HTMLElement>(selector).forEach((button) => {
        if (button.classList.contains('no-btn-icon') || button.closest('.sidebar, .topbar, [role="tab"], [role="tablist"]')) return;
        const hasIcon = Array.from(button.children).some((child) => child.tagName.toLowerCase() === 'svg' && !child.classList.contains('spin'));
        const label = Array.from(button.childNodes)
            .filter((node) => !(node instanceof Element && node.tagName.toLowerCase() === 'svg'))
            .map((node) => node.textContent || '')
            .join('')
            .trim();
        if (hasIcon && label) button.classList.add('no-btn-icon');
    });
}

export function useUiEnhancer() {
    useEffect(() => {
        let timer = 0;
        const run = () => {
            timer = 0;
            document.querySelectorAll('table').forEach((table) => enhanceTable(table as HTMLTableElement));
            tracked.forEach((table) => {
                if (!table.isConnected) removeBar(table);
            });
            dropIcons(document);
        };
        const schedule = () => {
            if (!timer) timer = window.setTimeout(run, 250);
        };
        const observer = new MutationObserver((records) => {
            // Ignore the changes this enhancer makes itself (rows hidden, bar updated).
            const relevant = records.some((record) => {
                const target = record.target as Element;
                if (target.closest?.('.tf-bar')) return false;
                if (record.type === 'attributes') return false;

                return true;
            });
            if (relevant) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: false });
        schedule();

        return () => {
            observer.disconnect();
            window.clearTimeout(timer);
        };
    }, []);
}
