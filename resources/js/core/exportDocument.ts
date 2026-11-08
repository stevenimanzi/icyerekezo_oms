import { csrf } from './api';

export type ExportColumn = { label: string; kind?: 'text' | 'number' | 'money' | 'date'; decimals?: number };
export type ExportTable = {
    heading?: string;
    columns: ExportColumn[];
    rows: (string | number | null | undefined)[][];
    totals?: (string | number | null | undefined)[];
};
export type ExportDoc = {
    title: string;
    subtitle?: string;
    summary?: { label: string; value: string | number }[];
    tables: ExportTable[];
};

/** Asks the server for a finished PDF or Excel file of the report on screen and saves it. */
export async function downloadExport(format: 'pdf' | 'xlsx', doc: ExportDoc): Promise<void> {
    const response = await fetch(`/api/exports/${format}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: format === 'pdf' ? 'application/pdf' : 'application/octet-stream',
            'X-CSRF-TOKEN': csrf(),
        },
        body: JSON.stringify(doc),
    });
    if (!response.ok) {
        let message = 'The file could not be made. Please try again.';
        try {
            const body = await response.json();
            message = body.message || message;
        } catch {
            /* keep the simple message */
        }
        throw new Error(message);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] || `report.${format}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

const clean = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();
const NUMBER = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/;

/**
 * Builds a document from the tables currently shown on the page, so every report page can offer
 * the same finished PDF and Excel files without each one describing its data twice.
 */
export function docFromPage(title: string, root: ParentNode = document.querySelector('main') ?? document.body): ExportDoc {
    const tables: ExportTable[] = [];
    root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
        if (tables.length >= 8 || table.closest('.no-print')) return;
        const headRow = table.querySelector('thead tr:last-child') ?? table.querySelector('tr');
        if (!headRow) return;
        const labels = Array.from(headRow.querySelectorAll('th,td')).slice(0, 18).map((cell) => clean(cell.textContent));
        if (!labels.length) return;
        const bodyRows = Array.from(table.querySelectorAll('tbody tr, tfoot tr'))
            .filter((row) => row !== headRow)
            .map((row) => Array.from(row.querySelectorAll('td,th')).slice(0, labels.length).map((cell) => clean((cell as HTMLElement).innerText ?? cell.textContent)))
            .filter((cells) => cells.length > 0 && !(cells.length === 1 && labels.length > 1));
        if (!bodyRows.length) return;

        const kinds: ExportColumn[] = labels.map((label, index) => {
            const values = bodyRows.map((cells) => cells[index] ?? '').filter((value) => value !== '' && value !== '—');
            const numeric = values.length > 0 && values.every((value) => NUMBER.test(value));
            const decimals = numeric ? Math.min(2, Math.max(0, ...values.map((value) => (value.split('.')[1] || '').length))) : 0;
            return { label: label || ' ', kind: numeric ? 'number' : 'text', decimals };
        });
        const rows = bodyRows.map((cells) =>
            kinds.map((column, index) => {
                const value = cells[index] ?? '';
                return column.kind === 'number' && NUMBER.test(value) ? Number(value.replace(/,/g, '')) : value;
            }),
        );

        let heading = clean(table.querySelector('caption')?.textContent);
        if (!heading) {
            let node: Element | null = table.closest('section,article,div') ;
            for (let depth = 0; node && depth < 4 && !heading; depth += 1, node = node.parentElement) {
                const found = node.querySelector('h2,h3,h4');
                if (found && !table.contains(found)) heading = clean(found.textContent);
            }
        }
        tables.push({ heading: heading.slice(0, 110), columns: kinds, rows: rows.slice(0, 5000) });
    });

    const summary = Array.from(root.querySelectorAll<HTMLElement>('.ui-kpi, .kpi-card, .report-kpi'))
        .slice(0, 12)
        .map((card) => {
            const parts = Array.from(card.children).map((child) => clean(child.textContent)).filter(Boolean);
            return { label: parts[0] || '', value: parts.slice(1).join(' ') };
        })
        .filter((item) => item.label && item.value);
    const period = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="date"]'))
        .map((input) => input.value)
        .filter(Boolean);

    return {
        title: title.slice(0, 110),
        subtitle: period.length === 2 ? `From ${period[0]} to ${period[1]}` : undefined,
        summary,
        tables: tables.length ? tables : [{ columns: [{ label: 'Nothing to show' }], rows: [] }],
    };
}
