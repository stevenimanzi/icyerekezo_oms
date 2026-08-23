import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'warning' | 'info';
type ToastItem = { id: number; kind: ToastKind; title: string; message: string };

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Login/logout already give their own feedback (inline form error, or an immediate
// redirect) — a generic "Completed" toast on top of that is just noise.
const silentPaths = new Set(['/api/auth/login', '/api/auth/logout']);

function firstMessage(payload: any): string {
    const validation = payload?.errors && Object.values(payload.errors).flat().find(value => typeof value === 'string');
    return String(validation || payload?.message || '').trim();
}

function safeErrorMessage(response: Response, payload: any): string {
    const message = firstMessage(payload);
    if (response.status === 401 || response.status === 419) return 'Your session has expired. Please sign in again.';
    if (response.status === 403) return 'You do not have permission to complete this action.';
    if (response.status === 404) return 'The requested record could not be found.';
    if (response.status === 409) return message || 'This change conflicts with an existing record.';
    if (response.status === 422) return message || 'Please check the highlighted information and try again.';
    if (response.status >= 500 || /SQLSTATE|query exception|stack trace|<!doctype/i.test(message)) {
        return 'The operation could not be completed. No changes were saved. Please try again.';
    }
    return message || 'The operation could not be completed. Please try again.';
}

function successMessage(method: string, payload: any): string {
    const message = firstMessage(payload);
    if (message) return message;
    if (method === 'DELETE') return 'The record was deleted successfully.';
    if (method === 'POST') return 'The new record was saved successfully.';
    return 'Your changes were saved successfully.';
}

// Mounted once near the app root. Rather than have every page wire up its own
// success/error toasts, this patches window.fetch globally so any POST/PUT/PATCH/DELETE
// to /api/* automatically surfaces a toast — pages just need to fetch normally.
export default function GlobalOperationToasts() {
    const [items, setItems] = useState<ToastItem[]>([]);
    const nextId = useRef(1);
    const recent = useRef<{ key: string; at: number }>({ key: '', at: 0 });

    useEffect(() => {
        const originalFetch = window.fetch.bind(window);
        const show = (kind: ToastKind, title: string, message: string) => {
            const now = Date.now();
            const key = `${kind}:${message}`;
            if (recent.current.key === key && now - recent.current.at < 1500) return;
            recent.current = { key, at: now };
            const id = nextId.current++;
            setItems(current => [...current.slice(-3), { id, kind, title, message }]);
            window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), kind === 'error' ? 7500 : 5000);
        };

        const patchedFetch: typeof window.fetch = async (input, init) => {
            const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
            const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            let isApiMutation = false;
            try {
                const path = new URL(rawUrl, window.location.origin).pathname;
                isApiMutation = mutationMethods.has(method) && path.startsWith('/api/') && !silentPaths.has(path);
            } catch {}

            try {
                const response = await originalFetch(input, init);
                if (isApiMutation) {
                    let payload: any = {};
                    try { payload = await response.clone().json(); } catch {}
                    if (response.ok) show('success', 'Completed', successMessage(method, payload));
                    else show('error', 'Could not complete action', safeErrorMessage(response, payload));
                }
                return response;
            } catch (error) {
                if (isApiMutation) show('error', 'Connection problem', 'The server could not be reached. Check your connection and try again.');
                throw error;
            }
        };

        window.fetch = patchedFetch;
        return () => { if (window.fetch === patchedFetch) window.fetch = originalFetch; };
    }, []);

    if (!items.length) return null;

    return createPortal(
        <div className="operation-toast-viewport" aria-live="polite" aria-atomic="false">
            {items.map(item => {
                const Icon = item.kind === 'success' ? CheckCircle2 : item.kind === 'warning' ? AlertTriangle : item.kind === 'info' ? Info : CircleAlert;
                return (
                    <div key={item.id} className={`operation-toast operation-toast-${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}>
                        <span className="operation-toast-icon"><Icon size={22} /></span>
                        <div className="operation-toast-copy"><strong>{item.title}</strong><p>{item.message}</p></div>
                        <button type="button" aria-label="Close message" onClick={() => setItems(current => current.filter(entry => entry.id !== item.id))}><X size={18} /></button>
                    </div>
                );
            })}
        </div>,
        document.body,
    );
}
