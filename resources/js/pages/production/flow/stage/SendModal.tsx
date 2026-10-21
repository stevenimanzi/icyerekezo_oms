import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Locale } from '../../../../core/types';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { LotRow, StageInfo, StageKey } from '../types';
import { postJson } from '../../../../core/liveData';
import { notify } from '../../../shared/GlobalOperationToasts';

type Props = {
    lot: LotRow;
    stage: StageInfo;
    to: StageKey;
    locale: Locale;
    text: FlowText;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function SendModal({ lot, stage, to, locale, text, onClose, onDone }: Props) {
    const t = text.send;
    const next = stageLabel(to, locale);
    const [quantity, setQuantity] = useState(String(lot.outbox));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const submit = async () => {
        setAttempted(true);
        const qtyNum = Number(quantity);

        if (isNaN(qtyNum) || qtyNum < 1) {
            const msg = locale === 'en'
                ? 'Please enter a valid quantity of pieces to transfer (must be at least 1).'
                : 'Veuillez saisir une quantité valide de pièces à transférer (au moins 1).';
            setError(msg);
            notify.warning('Quantity Required', msg);
            return;
        }

        if (lot.outbox <= 0) {
            let msg = locale === 'en'
                ? `Quality Control inspection required: Items at this stage must be inspected and passed by the Quality Control team before sending to ${next}.`
                : `Contrôle qualité requis : Les pièces doivent être inspectées et validées par l'équipe Contrôle Qualité avant d'être envoyées à ${next}.`;
            if (lot.quality_rejected && lot.quality_rejected > 0) {
                const qcReason = lot.qc_message ? ` ("${lot.qc_message}")` : '';
                msg = locale === 'en'
                    ? `Cannot send items: All ${lot.quality_rejected} inspected items failed in quality control${qcReason}. 0 items passed.`
                    : `Impossible d'envoyer : Les ${lot.quality_rejected} articles inspectés ont échoué au contrôle qualité${qcReason}. 0 article validé.`;
            }
            setError(msg);
            notify.error('Quality Control Required', msg);
            return;
        }

        if (qtyNum > lot.outbox) {
            let msg = locale === 'en'
                ? `Only ${lot.outbox} items passed quality control inspection and are ready to send to ${next}. You typed ${qtyNum}.`
                : `Seuls ${lot.outbox} articles ont réussi le contrôle qualité et sont prêts à être envoyés à ${next}. Vous avez saisi ${qtyNum}.`;
            if (lot.quality_rejected && lot.quality_rejected > 0) {
                const qcReason = lot.qc_message ? ` ("${lot.qc_message}")` : '';
                msg = locale === 'en'
                    ? `Some items failed in quality control: ${lot.quality_rejected} items failed quality control inspection${qcReason}. Only ${lot.outbox} passed items can be sent. You typed ${qtyNum}.`
                    : `Certains articles ont échoué au contrôle qualité : ${lot.quality_rejected} articles ont échoué${qcReason}. Seuls les ${lot.outbox} articles validés peuvent être envoyés. Vous avez saisi ${qtyNum}.`;
            }
            setError(msg);
            notify.error('Quality Control Validation', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            await postJson(`/api/flow/lots/${lot.id}/send`, {
                from_stage: stage.key,
                to_stage: to,
                quantity: qtyNum,
                note: note.trim() || null,
            });
            const successMsg = `Successfully sent ${qtyNum} pieces from ${lot.lot_number} to ${next}.`;
            notify.success('Transfer Sent', successMsg);
            onDone(successMsg);
        } catch (reason: any) {
            const errorMsg = reason instanceof Error ? reason.message : (reason?.message || 'Transfer failed.');
            setError(errorMsg);
            notify.error('Transfer Failed', errorMsg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={`${t.title(next)}: ${lot.lot_number}`}
            narrow
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        {text.cancel}
                    </button>
                    <button
                        className="primary-btn"
                        onClick={submit}
                        disabled={busy || lot.outbox <= 0}
                    >
                        {busy ? text.saving : t.confirm}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error" style={{ marginBottom: 12 }}>{error}</div>}

            {lot.quality_rejected && lot.quality_rejected > 0 && (
                <div
                    style={{
                        background: '#fffbeb',
                        border: '1px solid #fef3c7',
                        color: '#92400e',
                        padding: '10px 12px',
                        borderRadius: 6,
                        marginBottom: 14,
                        fontSize: '0.84rem',
                        lineHeight: 1.4,
                    }}
                >
                    <strong style={{ color: '#b45309' }}>
                        {locale === 'en' ? 'Quality Control Alert:' : 'Alerte Contrôle Qualité :'}
                    </strong>{' '}
                    {locale === 'en'
                        ? `${lot.quality_rejected} ${lot.quality_rejected === 1 ? 'item' : 'items'} failed quality control inspection`
                        : `${lot.quality_rejected} ${lot.quality_rejected === 1 ? 'article a' : 'articles ont'} échoué au contrôle qualité`}
                    {lot.qc_message && (
                        <span style={{ fontStyle: 'italic', display: 'block', marginTop: 4, color: '#78350f' }}>
                            « {lot.qc_message} »
                        </span>
                    )}
                    <div style={{ marginTop: 6, fontWeight: 600 }}>
                        {locale === 'en'
                            ? `Only ${lot.outbox} passed ${lot.outbox === 1 ? 'item is' : 'items are'} approved to be transferred to ${next}.`
                            : `Seuls les ${lot.outbox} articles validés sont autorisés à être transférés vers ${next}.`}
                    </div>
                </div>
            )}

            {lot.outbox <= 0 && (!lot.quality_rejected || lot.quality_rejected === 0) && (
                <div
                    style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1e40af',
                        padding: '10px 12px',
                        borderRadius: 6,
                        marginBottom: 14,
                        fontSize: '0.84rem',
                    }}
                >
                    <strong>{locale === 'en' ? 'Inspection Required:' : 'Inspection Requise :'}</strong>{' '}
                    {locale === 'en'
                        ? `Items at this stage must be inspected and approved by Quality Control before they can be sent to ${next}. (0 items passed yet).`
                        : `Les pièces à cette étape doivent être inspectées et validées par le Contrôle Qualité avant tout envoi vers ${next}. (0 pièce validée pour le moment).`}
                </div>
            )}

            <p className="ui-help" style={{ margin: 0 }}>
                {[lot.product, lot.color, lot.size].filter(Boolean).join(' · ')} —{' '}
                <strong style={{ color: lot.outbox > 0 ? '#15803d' : '#b91c1c' }}>
                    {t.ready(lot.outbox)}
                </strong>
            </p>
            <label className="ui-field">
                {t.quantity}
                <input
                    type="number"
                    min={1}
                    max={lot.outbox > 0 ? lot.outbox : 1}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    autoFocus
                />
            </label>
            <label className="ui-field">
                {t.note}
                <input value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <span className="ui-help">{t.hint}</span>
        </Modal>
    );
}
