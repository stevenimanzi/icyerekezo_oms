import type { ReactNode } from 'react';

export type Tone = 'good' | 'warn' | 'bad';

export type HealthRow = { label: string; value: string; tone?: Tone };

type Props = {
    title: string;
    headline?: { value: string; label: string; tone?: Tone };
    rows: HealthRow[];
    children?: ReactNode;
};

export function HealthCard({ title, headline, rows, children }: Props) {
    return (
        <article className="panel ow-card">
            <div className="panel-title">
                <h2>{title}</h2>
            </div>
            {headline && (
                <div className="ow-headline">
                    <strong className={headline.tone}>{headline.value}</strong>
                    <span>{headline.label}</span>
                </div>
            )}
            <dl className="ow-rows">
                {rows.map((row) => (
                    <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd className={row.tone}>{row.value}</dd>
                    </div>
                ))}
            </dl>
            {children}
        </article>
    );
}

/** Colours a count red or amber only when something needs attention. */
export function toneFor(count: number, level: Exclude<Tone, 'good'> = 'warn'): Tone | undefined {
    return count > 0 ? level : undefined;
}
