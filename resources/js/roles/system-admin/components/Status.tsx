export function Status({ value }: { value: string }) {
    return <span className={`admin-status ${String(value).replaceAll(' ', '-')}`}>{value}</span>;
}
