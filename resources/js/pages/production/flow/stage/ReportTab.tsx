import type { Format } from '../../../../core/format';
import type { AuthUser, Locale } from '../../../../core/types';
import { FlowReportView } from '../report/FlowReportView';
import type { FlowText } from '../text';
import type { StageKey } from '../types';
import CuttingReportPage from '../../textile/cutting/CuttingReportPage';
import SewingReportPage from '../../textile/sewing/SewingReportPage';
import FinishingReportPage from '../../textile/finishing/FinishingReportPage';
import PackingReportPage from '../../textile/packing/PackingReportPage';

type Props = {
    stage: StageKey;
    locale: Locale;
    text: FlowText;
    format: Format;
    user?: AuthUser;
};

export function ReportTab({ stage, locale, text, format, user }: Props) {
    if (user) {
        if (stage === 'cutting') return <CuttingReportPage user={user} locale={locale} />;
        if (stage === 'sewing') return <SewingReportPage user={user} locale={locale} />;
        if (stage === 'finishing') return <FinishingReportPage user={user} locale={locale} />;
        if (stage === 'packing') return <PackingReportPage user={user} locale={locale} />;
    }
    return <FlowReportView highlight={stage} locale={locale} text={text} format={format} />;
}
