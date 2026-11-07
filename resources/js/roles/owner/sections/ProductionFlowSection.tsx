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

            <div className="ui-table-wrap ow-flow-table-wrap" style={{ marginTop: 12 }}>
                <table className="ui-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>{locale === 'fr' ? 'Atelier / Département' : 'Department Stage'}</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>{locale === 'fr' ? '1. Pièces entrantes' : '1. Input Pieces'}</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>{locale === 'fr' ? '2. Sortie terminée' : '2. Output Produced'}</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>{locale === 'fr' ? 'En cours (WIP)' : 'In Progress (WIP)'}</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>{locale === 'fr' ? '3. Défauts / Rebuts' : '3. Damaged Pieces'}</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>{locale === 'fr' ? '4. Statut Qualité' : '4. Quality Status'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.stages.map((st) => {
                            const totalInput = st.here + st.done;
                            return (
                                <tr key={st.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                        <b style={{ color: '#0f172a' }}>{st.label[locale]}</b>
                                    </td>
                                    <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, color: '#334155' }}>
                                        {format.whole(totalInput)} pcs
                                    </td>
                                    <td style={{ textAlign: 'left', padding: '12px 14px', color: '#16a34a', fontWeight: 700 }}>
                                        {format.whole(st.done)} pcs
                                    </td>
                                    <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, color: '#2563eb' }}>
                                        {format.whole(st.here)} pcs
                                    </td>
                                    <td style={{ textAlign: 'left', padding: '12px 14px', color: st.damaged > 0 ? '#dc2626' : '#64748b', fontWeight: st.damaged > 0 ? 700 : 500 }}>
                                        {format.whole(st.damaged)} pcs
                                    </td>
                                    <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                        <span
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: st.damaged === 0 ? '#dcfce7' : '#fef3c7',
                                                color: st.damaged === 0 ? '#15803d' : '#b45309',
                                                border: `1px solid ${st.damaged === 0 ? '#86efac' : '#fde68a'}`,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}
                                        >
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
