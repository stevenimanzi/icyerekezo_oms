import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import type { Locale } from '../core/types';

export function UkFlag({ size = 28 }: { size?: number }) {
    return (
        <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}
            aria-hidden="true"
        >
            <clipPath id="circle-clip-uk">
                <circle cx="50" cy="50" r="50" />
            </clipPath>
            <g clipPath="url(#circle-clip-uk)">
                <rect width="100" height="100" fill="#012169" />
                <path d="M0,0 L100,100 M100,0 L0,100" stroke="#ffffff" strokeWidth="16" />
                <path d="M0,0 L100,100 M100,0 L0,100" stroke="#C8102E" strokeWidth="6" />
                <path d="M50,0 v100 M0,50 h100" stroke="#ffffff" strokeWidth="24" />
                <path d="M50,0 v100 M0,50 h100" stroke="#C8102E" strokeWidth="14" />
            </g>
        </svg>
    );
}

export function FranceFlag({ size = 28 }: { size?: number }) {
    return (
        <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}
            aria-hidden="true"
        >
            <clipPath id="circle-clip-fr">
                <circle cx="50" cy="50" r="50" />
            </clipPath>
            <g clipPath="url(#circle-clip-fr)">
                <rect width="33.33" height="100" fill="#002654" />
                <rect x="33.33" width="33.34" height="100" fill="#ffffff" />
                <rect x="66.67" width="33.33" height="100" fill="#CE1126" />
            </g>
        </svg>
    );
}

export function LanguageFlagDropdown({
    locale,
    onChange,
}: {
    locale: Locale;
    onChange: (next: Locale) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="auth-circle-flag-wrapper" ref={ref}>
            <button
                type="button"
                className="circle-flag-trigger"
                onClick={() => setOpen((prev) => !prev)}
                title={locale === 'en' ? 'Language: English' : 'Langue: Français'}
                aria-label="Select Language"
                aria-expanded={open}
            >
                {locale === 'en' ? <UkFlag size={28} /> : <FranceFlag size={28} />}
            </button>

            {open && (
                <div className="circle-flag-dropdown">
                    <button
                        type="button"
                        className={`flag-option-item${locale === 'en' ? ' selected' : ''}`}
                        onClick={() => {
                            onChange('en');
                            setOpen(false);
                        }}
                    >
                        <UkFlag size={22} />
                        <span>English</span>
                        {locale === 'en' && <Check size={14} className="check-icon" />}
                    </button>
                    <button
                        type="button"
                        className={`flag-option-item${locale === 'fr' ? ' selected' : ''}`}
                        onClick={() => {
                            onChange('fr');
                            setOpen(false);
                        }}
                    >
                        <FranceFlag size={22} />
                        <span>Français</span>
                        {locale === 'fr' && <Check size={14} className="check-icon" />}
                    </button>
                </div>
            )}
        </div>
    );
}
