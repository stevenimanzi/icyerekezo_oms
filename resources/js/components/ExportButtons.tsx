import { useState } from 'react';
import { docFromPage, downloadExport } from '../core/exportDocument';
import type { ExportDoc } from '../core/exportDocument';

/** "Download PDF" and "Download Excel" for the report on screen. Pass null while the data is loading. */
export function ExportButtons({
    doc,
    disabled = false,
    pdf = true,
}: {
    doc: ExportDoc | null | (() => ExportDoc | null);
    disabled?: boolean;
    pdf?: boolean;
}) {
    const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
    const [error, setError] = useState('');

    const run = async (format: 'pdf' | 'xlsx') => {
        const value = typeof doc === 'function' ? doc() : doc;
        if (!value) return;
        setBusy(format);
        setError('');
        try {
            await downloadExport(format, value);
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <span className="export-buttons no-print">
            {pdf && (
                <button className="secondary-btn" disabled={disabled || !doc || busy !== null} onClick={() => run('pdf')}>
                    {busy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
                </button>
            )}
            <button className="primary-btn" disabled={disabled || !doc || busy !== null} onClick={() => run('xlsx')}>
                {busy === 'xlsx' ? 'Preparing Excel…' : 'Download Excel'}
            </button>
            {error && <small className="export-error">{error}</small>}
        </span>
    );
}

/** Download buttons for a report page whose tables are already on the screen. */
export function PageExportButtons({ title, pdf = true }: { title: string; pdf?: boolean }) {
    return <ExportButtons doc={() => docFromPage(title)} pdf={pdf} />;
}
