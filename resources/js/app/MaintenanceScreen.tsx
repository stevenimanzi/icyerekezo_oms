import { Logo } from './Logo';

export function MaintenanceScreen({
    message,
    onRetry,
    onAdmin,
}: {
    message: string;
    onRetry: () => void;
    onAdmin: () => void;
}) {
    return (
        <main className="maintenance-screen">
            <Logo />
            <h1>Scheduled maintenance</h1>
            <p>{message}</p>
            <div>
                <button className="primary-btn" onClick={onRetry}>
                    Check again
                </button>
                <button className="secondary-btn" onClick={onAdmin}>
                    Administrator sign in
                </button>
            </div>
            <small>Platform administrators retain access to manage the system.</small>
        </main>
    );
}
