import type { OwnerAlert } from '../types';
import type { ownerText } from '../text';

type Text = (typeof ownerText)['en'];

type Props = {
    alerts: OwnerAlert[];
    openablePages: string[];
    text: Text;
    onNavigate: (page: string) => void;
};

export function AlertsBar({ alerts, openablePages, text, onNavigate }: Props) {
    if (!alerts.length) {
        return (
            <section className="panel ow-alerts clear" role="status">
                <span className="ow-dot good" />
                <p>{text.allClear}</p>
            </section>
        );
    }

    return (
        <section className="panel ow-alerts" aria-label={text.attention}>
            <div className="panel-title">
                <h2>{text.attention}</h2>
            </div>
            <ul>
                {alerts.map((alert) => {
                    const describe = text.alerts[alert.key];
                    const canOpen = openablePages.includes(alert.page);

                    return (
                        <li key={alert.key} className={alert.level}>
                            <span className={`ow-dot ${alert.level}`} />
                            <p>
                                {describe ? describe(alert.count) : `${alert.key}: ${alert.count}`}
                            </p>
                            {canOpen && (
                                <button className="text-btn" onClick={() => onNavigate(alert.page)}>
                                    {text.openPage}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
