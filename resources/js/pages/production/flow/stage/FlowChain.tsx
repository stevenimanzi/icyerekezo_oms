import type { Locale } from '../../../../core/types';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { StageInfo } from '../types';

type Props = { stage: StageInfo; locale: Locale; text: FlowText };

export function FlowChain({ stage, locale, text }: Props) {
    const steps = [
        {
            key: 'from',
            label: stage.previous ? stageLabel(stage.previous, locale) : text.flowStart,
            active: false,
        },
        { key: 'here', label: stage.label[locale], active: true },
        {
            key: 'to',
            label: stage.next ? stageLabel(stage.next, locale) : text.flowEnd,
            active: false,
        },
    ];

    return (
        <div className="ui-chain" aria-label="Flow">
            {steps.map((step, index) => (
                <span key={step.key} className="ui-chain-step">
                    <span className={`ui-step ${step.active ? 'active' : ''}`}>{step.label}</span>
                    {index < steps.length - 1 && <span className="ui-arrow">→</span>}
                </span>
            ))}
        </div>
    );
}
