import { HealthCard, toneFor } from '../components/HealthCard';
import type { Format } from '../../../core/format';
import type { ownerText } from '../text';
import type { OwnerOverview } from '../types';

type Props = {
    data: NonNullable<OwnerOverview['flow']>;
    text: (typeof ownerText)['en'];
    format: Format;
    locale: 'en' | 'fr';
};

/** Where the pieces are right now, stage by stage, with what needs the owner's attention. */
export function ProductionFlowSection({ data, text, format, locale }: Props) {
    const t = text.flow;
    const inProgress = data.stages.reduce((sum, stage) => sum + stage.here, 0);
    const damaged = data.stages.reduce((sum, stage) => sum + stage.damaged, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <HealthCard
                title={t.title}
                headline={{ value: format.whole(inProgress), label: t.headline }}
                rows={[
                    ...data.stages.map((stage) => ({
                        label: stage.label[locale],
                        value: t.stageLine(stage.done, stage.here),
                    })),
                    { label: t.damaged, value: format.whole(damaged), tone: toneFor(damaged) },
                    { label: t.lots, value: format.whole(data.lots_open) },
                    {
                        label: t.held,
                        value: format.whole(data.lots_held),
                        tone: toneFor(data.lots_held, 'bad'),
                    },
                    {
                        label: t.requests,
                        value: format.whole(data.requests_waiting),
                        tone: toneFor(data.requests_waiting),
                    },
                    {
                        label: t.deliveries,
                        value: format.whole(data.deliveries_waiting),
                        tone: toneFor(data.stuck_deliveries),
                    },
                    { label: t.finalCheck, value: format.whole(data.awaiting_final_check) },
                ]}
            />

            <article className="panel">
                <div className="panel-title">
                    <h2>
                        {locale === 'fr'
                            ? 'Bilan opérationnel des étapes'
                            : 'Stage Operational Overview'}
                    </h2>
                    <span className="ui-chip ok" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                        {locale === 'fr' ? 'Registre actif' : 'Active stages'}
                    </span>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ width: '100%', minWidth: 0, tableLayout: 'auto' }}>
                        <thead>
                            <tr>
                                <th>{locale === 'fr' ? 'Département' : 'Department'}</th>
                                <th className="num">{locale === 'fr' ? '1. Entrants' : '1. Input'}</th>
                                <th className="num">{locale === 'fr' ? '2. Sortie' : '2. Output'}</th>
                                <th className="num">{locale === 'fr' ? '3. Défauts' : '3. Damaged'}</th>
                                <th>{locale === 'fr' ? '4. Qualité' : '4. QC Status'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.stages.map((st) => (
                                <tr key={st.key}>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <b>{st.label[locale]}</b>
                                    </td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        <b>{format.whole(st.here + st.done)}</b>
                                    </td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        <b style={{ color: 'var(--ui-good, #16a34a)' }}>{format.whole(st.done)}</b>
                                    </td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        <b className={st.damaged > 0 ? 'alert' : ''}>{format.whole(st.damaged)}</b>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <span className={`ui-chip ${st.damaged === 0 ? 'ok' : 'warn'}`}>
                                            {st.damaged === 0 ? '✓ PASSED' : (locale === 'fr' ? 'AUDITÉ' : 'AUDITED')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </article>
        </div>
    );
}
