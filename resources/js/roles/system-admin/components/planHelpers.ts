export const planTemplates: any = {
    starter: {
        name: 'Starter Plan',
        code: 'STARTER',
        monthly_price: 100000,
        currency_code: 'RWF',
        features: [
            'dashboard',
            'production',
            'inventory',
            'products',
            'team',
            'reports',
            'support',
        ],
    },
    professional: {
        name: 'Professional Plan',
        code: 'PROFESSIONAL',
        monthly_price: 200000,
        currency_code: 'RWF',
        features: [
            'dashboard',
            'production',
            'inventory',
            'products',
            'procurement',
            'quality',
            'sales',
            'team',
            'reports',
            'support',
        ],
    },
    enterprise: {
        name: 'Unlimited Enterprise',
        code: 'UNLIMITED-ENT',
        monthly_price: 300000,
        currency_code: 'RWF',
        features: [
            'dashboard',
            'production',
            'inventory',
            'products',
            'procurement',
            'quality',
            'sales',
            'logistics',
            'team',
            'maintenance',
            'reports',
            'support',
        ],
    },
};
export const localDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const dateAfter = (value: string, months: number, days = 0) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    date.setMonth(date.getMonth() + months);
    date.setDate(date.getDate() + days);
    return localDate(date);
};
