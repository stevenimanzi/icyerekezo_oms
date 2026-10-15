import { useEffect, type ReactNode } from 'react';

type Props = {
    title: string;
    onClose: () => void;
    footer?: ReactNode;
    narrow?: boolean;
    children: ReactNode;
};

export function Modal({ title, onClose, footer, narrow, children }: Props) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', closeOnEscape);

        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    return (
        <div className="ms-overlay" onMouseDown={onClose}>
            <section
                className={`ms-dialog ${narrow ? 'narrow' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header>
                    <h2>{title}</h2>
                    <button type="button" aria-label="Close" onClick={onClose}>
                        ×
                    </button>
                </header>
                <div className="ms-dialog-body">{children}</div>
                {footer && <footer>{footer}</footer>}
            </section>
        </div>
    );
}
