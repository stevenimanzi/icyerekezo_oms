/** Like setInterval, but skips a round while the browser tab is hidden. Stop it with window.clearInterval. */
export function startPolling(callback: () => unknown, everyMs: number): number {
    return window.setInterval(() => {
        if (!document.hidden) callback();
    }, everyMs);
}
