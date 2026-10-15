type Props = { color: string | null; size: string | null; none?: string };

/** A lot's colour as a small blue label, followed by its size. */
export function ColourSize({ color, size, none = '—' }: Props) {
    if (!color && !size) return <>{none}</>;

    return (
        <>
            {color && <span className="ui-colour">{color}</span>}
            {color && size ? ' ' : ''}
            {size}
        </>
    );
}
