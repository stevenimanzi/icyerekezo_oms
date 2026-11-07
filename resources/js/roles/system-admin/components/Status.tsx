export function Status({ value }: { value?: string }) {
    const safeValue = value ? String(value) : 'unknown';
    return <span className={`admin-status ${safeValue.replaceAll(' ', '-')}`}>{safeValue}</span>;
}
