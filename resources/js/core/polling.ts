export function startPolling(callback: () => unknown, everyMs: number): number {
    return window.setInterval(() => {
        if (!document.hidden) callback();
    }, everyMs);
}
