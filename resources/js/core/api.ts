import { X } from 'lucide-react';

export const csrf = () =>
  document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-TOKEN": csrf(), ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    const error: any = new Error("The server returned a web page instead of data. Please refresh and sign in again.");
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error: any = new Error(payload.message || "This didn't work. Please try again.");
    error.status = response.status;
    throw error;
  }
  return payload;
}
