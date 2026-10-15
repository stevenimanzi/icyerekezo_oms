import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function PeopleSection({ data, text, format }: SectionProps<OwnerOverview['people']>) {
    const t = text.people;

    return (
        <HealthCard
            title={t.title}
            headline={{ value: format.whole(data.headcount), label: t.headcount }}
            rows={[
                { label: t.attendance, value: format.percent(data.attendance_rate) },
                { label: t.late, value: format.whole(data.late), tone: toneFor(data.late) },
                { label: t.absent, value: format.whole(data.absent), tone: toneFor(data.absent) },
                { label: t.leaveToday, value: format.whole(data.on_leave_today) },
                {
                    label: t.leavePending,
                    value: format.whole(data.pending_leave),
                    tone: toneFor(data.pending_leave),
                },
            ]}
        />
    );
}
