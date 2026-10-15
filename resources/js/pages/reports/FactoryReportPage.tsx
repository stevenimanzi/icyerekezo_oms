import { useMemo, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import '../../components/ui.css';
import { makeFormat } from '../../core/format';
import { useLiveData } from '../../core/liveData';
import type { AuthUser, Locale } from '../../core/types';
import '../production/flow/flow.css';
import './report.css';
import { RegisterView } from './RegisterView';
import { QualitySection, SalesSection, StageSection, WarehouseSection } from './sections';
import { reportText } from './text';
import type { FactoryReportData, Section } from './types';

type Props = { user: AuthUser; locale: Locale };
type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

const PERIODS: Period[] = ['day', 'week', 'month', 'year', 'custom'];
const REFRESH_MS = 60000;
const today = () => new Date().toLocaleDateString('en-CA');

/** One report covering every department, shown to management in full and to each team for its own department. */
export default function FactoryReportPage({ user, locale }: Props) {
    const text = reportText[locale];
    const format = useMemo(
        () => makeFormat(locale, user.current_factory?.currency_code ?? ''),
        [locale, user],
    );
    const [period, setPeriod] = useState<Period>('week');
    const [from, setFrom] = useState(today());
    const [to, setTo] = useState(today());
    const [department, setDepartment] = useState<'' | Section>('');
    const [tab, setTab] = useState<'register' | 'departments'>('register');

    const params = new URLSearchParams({ period });
    if (period === 'custom') {
        params.set('from', from);
        params.set('to', to < from ? from : to);
    }
    if (department) params.set('department', department);
    const { data, error, loading, reload } = useLiveData<FactoryReportData>(
        `/api/flow/factory-report?${params.toString()}`,
        REFRESH_MS,
    );

    const common = { text, format, locale };

    return (
        <section className="ui rp">
            <div className="page-heading no-print">
                <div>
                    <h1>{text.title}</h1>
                    <p>{text.subtitle}</p>
                </div>
                <div className="ui-actions">
                    <button className="secondary-btn" onClick={reload} disabled={loading}>
                        <RefreshCw size={15} />
                        {text.refresh}
                    </button>
                    <a
                        className="secondary-btn"
                        href={`/api/flow/factory-report.xlsx?${params.toString()}`}
                        download
                    >
                        <Download size={15} />
                        {text.download}
                    </a>
                    <button className="primary-btn" onClick={() => window.print()} disabled={!data}>
                        <Printer size={15} />
                        {text.print}
                    </button>
                </div>
            </div>

            <article className="panel no-print">
                <div className="ui-toolbar">
                    <label>
                        {text.period}
                        <select
                            value={period}
                            onChange={(event) => setPeriod(event.target.value as Period)}
                        >
                            {PERIODS.map((key) => (
                                <option key={key} value={key}>
                                    {text.periods[key]}
                                </option>
                            ))}
                        </select>
                    </label>
                    {period === 'custom' && (
                        <>
                            <label>
                                {text.from}
                                <input
                                    type="date"
                                    value={from}
                                    max={today()}
                                    onChange={(event) => setFrom(event.target.value)}
                                />
                            </label>
                            <label>
                                {text.to}
                                <input
                                    type="date"
                                    value={to}
                                    min={from}
                                    max={today()}
                                    onChange={(event) => setTo(event.target.value)}
                                />
                            </label>
                        </>
                    )}
                    {data && data.available.length > 1 && (
                        <label>
                            {text.department}
                            <select
                                value={department}
                                onChange={(event) =>
                                    setDepartment(event.target.value as '' | Section)
                                }
                            >
                                <option value="">{text.allDepartments}</option>
                                {data.available.map((key) => (
                                    <option key={key} value={key}>
                                        {text.departments[key]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>
            </article>

            {error && <div className="ui-error">{error}</div>}
            {!data && !error && <div className="ui-empty">{text.loading}</div>}

            {data && (
                <>
                    <header className="rp-head">
                        <div>
                            <h2>{user.current_factory?.name}</h2>
                            <p>
                                {text.covering(
                                    format.date(data.period.from),
                                    format.date(data.period.to),
                                )}
                            </p>
                        </div>
                        <small>
                            {text.generated} {format.dateTime(new Date().toISOString())} ·{' '}
                            {user.name}
                        </small>
                    </header>

                    <div className="ui-tabs no-print" role="tablist">
                        {(['register', 'departments'] as const).map((key) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={tab === key}
                                className={tab === key ? 'active' : ''}
                                onClick={() => setTab(key)}
                            >
                                {text.tabs[key]}
                            </button>
                        ))}
                    </div>

                    {tab === 'departments' && (
                        <section className="rp-section">
                            <h2>{text.summaryTitle}</h2>
                            <div className="ui-kpis">
                                {(Object.keys(data.summary) as (keyof typeof data.summary)[]).map(
                                    (key) => {
                                        const value = data.summary[key] ?? 0;
                                        const money =
                                            key === 'stock_in_value' ||
                                            key === 'stock_out_value' ||
                                            key === 'revenue';

                                        return (
                                            <article className="panel ui-kpi" key={key}>
                                                <small>{text.summary[key]}</small>
                                                <strong>
                                                    {money
                                                        ? format.money(value)
                                                        : key === 'quality_pass_rate'
                                                          ? format.percent(value)
                                                          : format.whole(value)}
                                                </strong>
                                            </article>
                                        );
                                    },
                                )}
                            </div>
                        </section>
                    )}

                    {tab === 'register' && (
                        <RegisterView register={data.register} text={text} format={format} />
                    )}

                    {tab === 'departments' &&
                        data.shown.map((key) => {
                            if (key === 'warehouse' && data.warehouse)
                                return (
                                    <WarehouseSection
                                        key={key}
                                        block={data.warehouse}
                                        {...common}
                                    />
                                );
                            if (key === 'quality' && data.quality)
                                return (
                                    <QualitySection key={key} block={data.quality} {...common} />
                                );
                            if (key === 'sales' && data.sales)
                                return <SalesSection key={key} block={data.sales} {...common} />;
                            const block =
                                key === 'cutting' ||
                                key === 'sewing' ||
                                key === 'finishing' ||
                                key === 'packing'
                                    ? data[key]
                                    : undefined;

                            return block ? (
                                <StageSection key={key} block={block} {...common} />
                            ) : null;
                        })}
                </>
            )}
        </section>
    );
}
