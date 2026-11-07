import type { Format } from '../../../core/format';
import type { ownerText } from '../text';
import type { OwnerOverview } from '../types';

type Props = {
    data: NonNullable<OwnerOverview['flow']>;
    text: (typeof ownerText)['en'];
    format: Format;
    locale: 'en' | 'fr';
};

/** High-level operational flow across stages with real-time status and bottleneck counts */
export function ProductionFlowSection({ data, text, format, locale }: Props) {
    const t = text.flow;
    const inProgress = data.stages.reduce((sum, stage) => sum + stage.here, 0);
    const damaged = data.stages.reduce((sum, stage) => sum + stage.damaged, 0);

    return (
        <article className="panel ow-flow-panel">
            <div className="panel-title">
                <div>
                    <h2>{t.title}</h2>
                    <span className="ow-flow-sub">
                        <b style={{ color: 'var(--brand, #2563eb)' }}>{format.whole(inProgress)}</b> {t.headline}
                    </span>
                </div>
                <span className="ui-chip ok" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                    {locale === 'fr' ? 'Registre actif' : 'Active stages'}
                </span>
            </div>

            <div className="ow-flow-badges">
                <div className="ow-flow-badge">
                    <span className="ow-flow-badge-label">{t.lots}</span>
                    <strong className="ow-flow-badge-val">{format.whole(data.lots_open)}</strong>
                </div>
                <div className="ow-flow-badge">
                    <span className="ow-flow-badge-label">{t.held}</span>
                    <strong className={`ow-flow-badge-val ${data.lots_held > 0 ? 'bad' : ''}`}>
                        {format.whole(data.lots_held)}
                    </strong>
                </div>
                <div className="ow-flow-badge">
                    <span className="ow-flow-badge-label">{t.requests}</span>
                    <strong className={`ow-flow-badge-val ${data.requests_waiting > 0 ? 'warn' : ''}`}>
                        {format.whole(data.requests_waiting)}
                    </strong>
                </div>
                <div className="ow-flow-badge">
                    <span className="ow-flow-badge-label">{t.damaged}</span>
                    <strong className={`ow-flow-badge-val ${damaged > 0 ? 'bad' : ''}`}>
                        {format.whole(damaged)}
                    </strong>
                </div>
            </div>

            <div className="ui-table-wrap ow-flow-table-wrap">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{locale === 'fr' ? 'Étape' : 'Department'}</th>
                            <th className="num">{locale === 'fr' ? '1. Entrants' : '1. Input'}</th>
                            <th className="num">{locale === 'fr' ? '2. Sortie' : '2. Output'}</th>
                            <th className="num">{locale === 'fr' ? 'En cours' : 'In Progress'}</th>
                            <th className="num">{locale === 'fr' ? '3. Défauts' : '3. Damaged'}</th>
                            <th>{locale === 'fr' ? '4. Statut' : '4. Status'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.stages.map((st) => {
                            const totalInput = st.here + st.done;
                            return (
                                <tr key={st.key}>
                                    <td>
                                        <b>{st.label[locale]}</b>
                                    </td>
                                    <td className="num">{format.whole(totalInput)}</td>
                                    <td className="num" style={{ color: 'var(--ui-good, #10b981)', fontWeight: 700 }}>
                                        {format.whole(st.done)}
                                    </td>
                                    <td className="num" style={{ fontWeight: 600 }}>
                                        {format.whole(st.here)}
                                    </td>
                                    <td className="num">
                                        <b className={st.damaged > 0 ? 'bad' : ''}>{format.whole(st.damaged)}</b>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${st.damaged === 0 ? 'success' : 'warning'}`}>
                                            {st.damaged === 0 ? '✓ PASSED' : (locale === 'fr' ? 'AUDITÉ' : 'AUDITED')}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </article>
    );
}
