import { useEffect, useState } from 'react';
import type { Locale } from '../../core/types';

export function useAppearance() {
    const [locale, setLocale] = useState<Locale>(
        () => (localStorage.getItem('icy_locale') as Locale) || 'en',
    );
    const [dark, setDark] = useState(() => localStorage.getItem('icy_theme') === 'dark');

    useEffect(() => {
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        localStorage.setItem('icy_theme', dark ? 'dark' : 'light');
    }, [dark]);

    useEffect(() => {
        document.documentElement.lang = locale;
        localStorage.setItem('icy_locale', locale);
    }, [locale]);

    return { locale, setLocale, dark, setDark };
}
