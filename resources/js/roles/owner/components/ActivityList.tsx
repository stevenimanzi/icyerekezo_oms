import type { Format } from '../format';
import { humanize } from '../format';
import type { ownerText } from '../text';
import type { ActivityEntry } from '../types';

type Text = (typeof ownerText)['en'];

type Props = {
    entries: ActivityEntry[];
    text: Text;
    format: Format;
    onViewAll?: () => void;
};

export function ActivityList({ entries, text, format, onViewAll }: Props) {
    return (
        <article className="panel ow-card ow-activity">
            <div className="panel-title">
                <h2>{text.activity}</h2>
                {onViewAll && (
                    <button className="text-btn" onClick={onViewAll}>
                        {text.viewAll}
                    </button>
                )}
            </div>
            {entries.length ? (
                <ul>
                    {entries.map((entry) => (
                        <li key={entry.id}>
                            <div>
                                <strong>{entry.description || humanize(entry.event)}</strong>
                                <small>
                                    {entry.who === 'System' ? text.system : entry.who} ·{' '}
                                    {humanize(entry.event.split('.')[0])}
                                </small>
                            </div>
                            <time dateTime={entry.at ?? undefined}>{format.timeAgo(entry.at)}</time>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="ow-empty">{text.noActivity}</p>
            )}
        </article>
    );
}
