import type { Locale } from '../../../core/types';
import type { StageKey } from './types';

const NAMES: Record<StageKey, { en: string; fr: string }> = {
    cutting: { en: 'Cutting', fr: 'Coupe' },
    sewing: { en: 'Sewing', fr: 'Couture' },
    finishing: { en: 'Finishing', fr: 'Finition' },
    packing: { en: 'Packing', fr: 'Emballage' },
};

export const STAGE_ORDER: StageKey[] = ['cutting', 'sewing', 'finishing', 'packing'];

export const stageLabel = (key: StageKey | null | undefined, locale: Locale) => (key ? NAMES[key][locale] : '');
