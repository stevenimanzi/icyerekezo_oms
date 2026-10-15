import { Database } from 'lucide-react';

export function BackupAction({ open, busy, submit }: any) {
    if (!open) return null;
    return (
        <div className="admin-form panel">
            <h2>Create database backup</h2>
            <p>
                This creates a protected, compressed database recovery point now. Credentials are
                never included in the backup history.
            </p>
            <button className="primary-btn" disabled={busy} onClick={submit}>
                <Database size={16} />
                Create backup now
            </button>
        </div>
    );
}
