import type { Format } from '../format';
import type { ownerText } from '../text';

export type SectionProps<T> = {
    data: T;
    text: (typeof ownerText)['en'];
    format: Format;
};
