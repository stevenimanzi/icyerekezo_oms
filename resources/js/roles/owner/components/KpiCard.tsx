import type { Comparison } from '../types';
import type { Format } from '../format';
import type { ownerText } from '../text';

type Text = (typeof ownerText)['en'];

type Props = {
    label: string;
    value: string;
    comparison: Comparison;
    days: number;
    text: Text;
    format: Format;
};

export function KpiCard({ label, value, comparison, days, text, format }: Props) {
    const { change } = comparison;
    const tone = change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';

    return (
        <article className="panel ow-kpi">
            <small>{label}</small>
            <strong>{value}</strong>
            {change === null ? (
                <p className="ow-kpi-note">{text.noEarlierData}</p>
            ) : (
                <p className="ow-kpi-note">
                    <b className={`ow-change ${tone}`}>{change === 0 ? text.noChange : format.signedPercent(change)}</b>{' '}
                    {text.comparedWith(days)}
                </p>
            )}
        </article>
    );
}
