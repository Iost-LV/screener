import { useEffect, useRef } from 'react';
import styles from '../styles/ContextMenu.module.css';

interface WatchlistContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  watchlistName: string;
  watchlistId: string;
  onRename: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

export default function WatchlistContextMenu({
  x,
  y,
  onClose,
  watchlistName,
  watchlistId,
  onRename,
  onDelete,
  canDelete,
}: WatchlistContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
    >
      <div className={styles.contextMenuHeader}>
        <span className={styles.contextMenuTitle}>{watchlistName}</span>
      </div>
      <div className={styles.contextMenuDivider} />
      <button
        className={styles.contextMenuItem}
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        Rename Watchlist
      </button>
      {canDelete && (
        <>
          <div className={styles.contextMenuDivider} />
          <button
            className={`${styles.contextMenuItem} ${styles.contextMenuDelete}`}
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete Watchlist
          </button>
        </>
      )}
    </div>
  );
}

