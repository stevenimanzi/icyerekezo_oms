import type { Format } from '../../../../core/format';
import type { Locale } from '../../../../core/types';
import { FlowReportView } from '../report/FlowReportView';
import type { FlowText } from '../text';
import type { StageKey } from '../types';

type Props = { stage: StageKey; locale: Locale; text: FlowText; format: Format };

export function ReportTab({ stage, locale, text, format }: Props) {
    return <FlowReportView highlight={stage} locale={locale} text={text} format={format} />;
}
