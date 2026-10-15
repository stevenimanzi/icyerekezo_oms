export function Toggle({
    checked,
    onChange,
    disabled = false,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            className={`toggle ${checked ? 'on' : ''}`}
            onClick={() => onChange(!checked)}
        >
            <span />
        </button>
    );
}
