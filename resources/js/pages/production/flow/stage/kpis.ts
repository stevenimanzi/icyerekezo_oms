import type { FlowText } from '../text';
import type { StageKey, StageOverview } from '../types';

export type Kpi = { label: string; value: number; alert?: boolean };

export function buildKpis(stage: StageKey, data: StageOverview, text: FlowText): Kpi[] {
    const { summary } = data;
    const waitingRequests = data.requests.filter((request) => request.status === 'pending').length;
    const lotsHere = data.lots.length;
    const piecesDone = data.lots.reduce((sum, lot) => sum + lot.good, 0);
    const fabricLeft = data.materials.reduce((sum, material) => sum + material.on_hand, 0);

    if (stage === 'cutting') {
        return [
            { label: text.kpi.cutToday, value: summary.done_today },
            {
                label: text.kpi.damagedToday,
                value: summary.damaged_today,
                alert: summary.damaged_today > 0,
            },
            { label: text.kpi.readyToSend, value: summary.ready_to_send },
            { label: text.kpi.sentToday, value: summary.sent_today },
            { label: text.kpi.requestsWaiting, value: waitingRequests },
            { label: text.work.cutTotal, value: data.lots.reduce((sum, lot) => sum + lot.cut, 0) },
            { label: text.kpi.lots, value: lotsHere },
            { label: text.kpi.fabricLeft, value: fabricLeft },
        ];
    }

    if (stage === 'packing') {
        return [
            { label: text.kpi.arriving, value: summary.incoming },
            { label: text.kpi.inWork, value: summary.in_work },
            { label: text.kpi.packedToday, value: summary.done_today },
            {
                label: text.kpi.damagedToday,
                value: summary.damaged_today,
                alert: summary.damaged_today > 0,
            },
            { label: text.kpi.awaitingQuality, value: summary.awaiting_quality },
            { label: text.kpi.requestsWaiting, value: waitingRequests },
            { label: text.kpi.lots, value: lotsHere },
            { label: text.kpi.packedTotal, value: piecesDone },
        ];
    }

    return [
        { label: text.kpi.arriving, value: summary.incoming },
        { label: text.kpi.inWork, value: summary.in_work },
        { label: text.kpi.doneToday, value: summary.done_today },
        {
            label: text.kpi.damagedToday,
            value: summary.damaged_today,
            alert: summary.damaged_today > 0,
        },
        { label: text.kpi.readyToSend, value: summary.ready_to_send },
        { label: text.kpi.sentToday, value: summary.sent_today },
        { label: text.kpi.lots, value: lotsHere },
        { label: text.kpi.requestsWaiting, value: waitingRequests },
    ];
}
