import { useEffect, useRef } from 'react';
import styles from '../styles/Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  submitLabel?: string;
  cancelLabel?: string;
  confirmationMode?: boolean;
  confirmationMessage?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  placeholder = '',
  initialValue = '',
  onSubmit,
  submitLabel = 'OK',
  cancelLabel = 'Cancel',
  confirmationMode = false,
  confirmationMessage = '',
}: ModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationMode) {
      onSubmit('');
      onClose();
    } else {
      const value = inputRef.current?.value.trim() || '';
      if (value) {
        onSubmit(value);
        onClose();
      }
    }
  };

  const handleConfirmClick = () => {
    if (confirmationMode) {
      onSubmit('');
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div ref={modalRef} className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {confirmationMode ? (
            <div className={styles.modalMessage}>{confirmationMessage}</div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              className={styles.modalInput}
              placeholder={placeholder}
              defaultValue={initialValue}
              autoFocus
            />
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancel} onClick={onClose}>
              {cancelLabel}
            </button>
            <button
              type={confirmationMode ? 'button' : 'submit'}
              className={confirmationMode ? styles.modalDelete : styles.modalSubmit}
              onClick={confirmationMode ? handleConfirmClick : undefined}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

