import type { Sale } from '../types';
import type { salesText } from '../text';

type Props = {
    sale: Pick<Sale, 'status' | 'payment_status'>;
    text: (typeof salesText)['en'];
};

export function StatusChip({ sale, text }: Props) {
    const key = sale.status === 'cancelled' ? 'cancelled' : sale.payment_status;

    return <span className={`ui-chip ${key}`}>{text.status[key]}</span>;
}
