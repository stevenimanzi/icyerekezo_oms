import React from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';

export class PageBoundary extends React.Component<
    { resetKey: string; children: React.ReactNode },
    { failed: boolean; attempts: number; error: string }
> {
    state = { failed: false, attempts: 0, error: '' };
    private recoveryTimer?: number;

    static getDerivedStateFromError(error: Error) {
        return { failed: true, error: error?.message || 'Unknown rendering error' };
    }

    componentDidCatch(error: Error) {
        console.error('Page render failed', error);

        // Check if error is due to a stale Vite bundle / missing chunk after deployment
        const msg = String(error?.message || '');
        const isChunkError =
            msg.includes('dynamically imported module') ||
            msg.includes('Loading chunk') ||
            msg.includes('Failed to fetch') ||
            error?.name === 'ChunkLoadError';

        if (isChunkError && !sessionStorage.getItem('chunk_reload_lock')) {
            sessionStorage.setItem('chunk_reload_lock', '1');
            window.location.reload();
            return;
        }

        if (this.state.attempts < 2) {
            this.recoveryTimer = window.setTimeout(
                () => this.setState((state) => ({ failed: false, attempts: state.attempts + 1 })),
                400,
            );
        }
    }

    componentDidUpdate(previous: { resetKey: string }) {
        if (previous.resetKey !== this.props.resetKey) {
            window.clearTimeout(this.recoveryTimer);
            if (this.state.failed || this.state.attempts)
                this.setState({ failed: false, attempts: 0, error: '' });
        }
    }

    componentWillUnmount() {
        window.clearTimeout(this.recoveryTimer);
    }

    retry = () => {
        window.clearTimeout(this.recoveryTimer);
        sessionStorage.removeItem('chunk_reload_lock');

        // If it failed multiple times, do a full browser refresh to ensure fresh assets & auth state
        if (this.state.attempts >= 2) {
            window.location.reload();
            return;
        }

        this.setState({ failed: false, attempts: 0, error: '' });
    };

    render() {
        if (!this.state.failed) return this.props.children;
        if (this.state.attempts < 2) {
            return (
                <div className="panel page-recovery page-reconnecting" role="status">
                    <RefreshCw size={30} className="spin" />
                    <h2>Loading your page</h2>
                    <p>Connecting to the latest factory data…</p>
                </div>
            );
        }
        return (
            <div className="panel page-recovery" role="alert">
                <span className="recovery-warning">
                    <CircleAlert size={30} />
                </span>
                <h2>We could not load this page</h2>
                <p>Please check your connection, then try again. Your data is safe.</p>
                <button className="primary-btn" onClick={this.retry}>
                    <RefreshCw size={17} />
                    Try again
                </button>
            </div>
        );
    }
}
