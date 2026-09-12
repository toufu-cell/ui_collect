import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Modal({
    titleId,
    onClose,
    children,
    className = '',
}: {
    titleId: string;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current!;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, []);
    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            className={`modal ${className}`}
            onCancel={onClose}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    if (
                        event.clientX < rect.left ||
                        event.clientX > rect.right ||
                        event.clientY < rect.top ||
                        event.clientY > rect.bottom
                    )
                        onClose();
                }
            }}
        >
            <button
                className="icon-button modal-close"
                onClick={onClose}
                aria-label="閉じる"
                autoFocus
            >
                <Icon name="close" size={20} />
            </button>
            {children}
        </dialog>
    );
}
