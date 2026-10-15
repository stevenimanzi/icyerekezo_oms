import { useEffect, useMemo, useState } from 'react';
import { api } from '../../core/api';
import type { HomeProps } from '../types';
import { humanize, makeFormat } from './format';
import './owner.css';
import { ownerText } from './text';
import type { ActivityPage } from './types';

const SEARCH_DELAY_MS = 300;

export default function OwnerActivityPage({ user, locale }: HomeProps) {
    const text = ownerText[locale].activityPage;
    const system = ownerText[locale].system;
    const format = useMemo(
        () => makeFormat(locale, user.current_factory?.currency_code || 'RWF'),
        [locale, user],
    );

    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [module, setModule] = useState('');
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<ActivityPage | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQuery(search.trim());
            setPage(1);
        }, SEARCH_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const params = new URLSearchParams({ page: String(page) });
        if (query) params.set('q', query);
        if (module) params.set('module', module);

        api<ActivityPage>(`/api/executive/activity?${params}`)
            .then((response) => {
                setResult(response);
                setError('');
            })
            .catch((reason: Error) => setError(reason.message));
    }, [page, query, module]);

    return (
        <section className="ow">
            <div className="page-heading">
                <div>
                    <h1>{text.title}</h1>
                    <p>{text.subtitle}</p>
                </div>
                <div className="ow-controls">
                    <input
                        type="search"
                        value={search}
                        placeholder={text.search}
                        aria-label={text.search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <select
                        aria-label={text.area}
                        value={module}
                        onChange={(event) => {
                            setModule(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">{text.allModules}</option>
                        {(result?.modules ?? []).map((name) => (
                            <option key={name} value={name}>
                                {humanize(name)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}

            <article className="panel ow-log">
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>{text.when}</th>
                                <th>{text.who}</th>
                                <th>{text.area}</th>
                                <th>{text.what}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result?.data.length ? (
                                result.data.map((entry) => (
                                    <tr key={entry.id}>
                                        <td>{format.dateTime(entry.at)}</td>
                                        <td>{entry.who === 'System' ? system : entry.who}</td>
                                        <td className="ow-cap">{humanize(entry.module)}</td>
                                        <td>{entry.description || humanize(entry.event)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="empty-cell">
                                        {result ? text.none : text.loading}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {result && result.meta.last_page > 1 && (
                    <div className="ow-pager">
                        <span>
                            {text.page(result.meta.page, result.meta.last_page, result.meta.total)}
                        </span>
                        <div>
                            <button
                                className="secondary-btn"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                {text.previous}
                            </button>
                            <button
                                className="secondary-btn"
                                disabled={page >= result.meta.last_page}
                                onClick={() => setPage(page + 1)}
                            >
                                {text.next}
                            </button>
                        </div>
                    </div>
                )}
            </article>
        </section>
    );
}
