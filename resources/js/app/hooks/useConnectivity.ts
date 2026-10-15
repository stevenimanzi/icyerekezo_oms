import { useEffect, useRef, useState } from 'react';

/** Tracks the connection and the changes waiting to sync, and passes service-worker "open this page" messages on. */
export function useConnectivity(onOpenUrl: (url: string) => void) {
    const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const openUrl = useRef(onOpenUrl);
    openUrl.current = onOpenUrl;

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            navigator.serviceWorker?.controller?.postMessage('flush-outbox');
        };
        const goOffline = () => setIsOnline(false);
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === 'navigate') openUrl.current(event.data.url);
            if (event.data?.type === 'outbox-queued') setPendingSyncCount((count) => count + 1);
            if (event.data?.type === 'outbox-synced') setPendingSyncCount((count) => Math.max(0, count - 1));
        };

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        navigator.serviceWorker?.addEventListener('message', onMessage);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
            navigator.serviceWorker?.removeEventListener('message', onMessage);
        };
    }, []);

    return { isOnline, pendingSyncCount };
}
