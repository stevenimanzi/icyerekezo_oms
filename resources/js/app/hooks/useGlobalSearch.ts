import { useEffect, useState } from 'react';
import { api } from '../../core/api';

const SEARCH_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 2;

export type SearchResult = { type: string; title: string; subtitle: string; page: string };

export function useGlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);

    useEffect(() => {
        if (query.trim().length < MIN_QUERY_LENGTH) {
            setResults([]);
            return;
        }

        const timer = window.setTimeout(
            () =>
                api<{ data: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`)
                    .then((result) => setResults(result.data))
                    .catch(() => setResults([])),
            SEARCH_DELAY_MS,
        );

        return () => window.clearTimeout(timer);
    }, [query]);

    return { query, setQuery, results, hasEnoughLetters: query.trim().length >= MIN_QUERY_LENGTH };
}
