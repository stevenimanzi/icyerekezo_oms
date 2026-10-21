import { X } from 'lucide-react';

export const csrf = () =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrf(),
            ...(options.headers ?? {}),
        },
    });
    const text = await response.text();
    let payload: any = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        const error: any = new Error(
            'The server returned a web page instead of data. Please refresh and sign in again.',
        );
        error.status = response.status;
        throw error;
    }
    if (!response.ok) {
        let msg = payload.message || "This didn't work. Please try again.";
        if (payload.errors && typeof payload.errors === 'object') {
            const errorList = Object.values(payload.errors)
                .flat()
                .filter((v) => typeof v === 'string');
            if (errorList.length > 0) {
                msg = errorList.join(' ');
            }
        }
        const error: any = new Error(msg);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
}
