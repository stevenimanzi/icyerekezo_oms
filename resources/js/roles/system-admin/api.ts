import { csrf } from '../../core/api';

export async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            'X-CSRF-TOKEN': csrf(),
            ...(options.headers || {}),
        },
    });
    const text = await response.text();
    let payload: any = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            'The server returned a web page instead of data. Please refresh and sign in again.',
        );
    }
    if (!response.ok)
        throw new Error(
            payload.message ||
                Object.values(payload.errors || {})
                    .flat()
                    .join(' ') ||
                'Could not save this. Please check your entries and try again.',
        );
    return payload;
}
