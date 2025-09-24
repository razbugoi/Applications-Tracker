'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'md' | 'lg' | 'xl';

const SIZE_WIDTH: Record<ModalSize, number> = {
  md: 560,
  lg: 720,
  xl: 900,
};

interface ModalProps {
  title?: string;
  children: ReactNode;
  onClose: () => void;
  size?: ModalSize;
}

export function Modal({ title, children, onClose, size = 'lg' }: ModalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  // Update the ref without causing re-renders
  onCloseRef.current = onClose;

  useEffect(() => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    setContainer(element);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      element.remove();
    };
  }, []);

  if (!container) {
    return null;
  }

  const width = SIZE_WIDTH[size];

  return createPortal(
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Dialog'}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          {title && <h2>{title}</h2>}
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    container
  );
}
