import { useEffect, useRef } from 'react';
import styles from '../styles/ContextMenu.module.css';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  watchlists: Array<{ id: string; name: string; coins: string[] }>;
  coinSymbol: string;
  onAddToWatchlist: (watchlistId: string) => void;
  onRemoveFromWatchlist: (watchlistId: string) => void;
  isCoinInWatchlist: (watchlistId: string) => boolean;
  onCreateNewWatchlist: () => void;
}

export default function ContextMenu({
  x,
  y,
  onClose,
  watchlists,
  coinSymbol,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isCoinInWatchlist,
  onCreateNewWatchlist,
}: ContextMenuProps) {
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
  const adjustedX = Math.min(x, window.innerWidth - 250);
  const adjustedY = Math.min(y, window.innerHeight - 200);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
    >
      <div className={styles.contextMenuHeader}>
        <span className={styles.contextMenuTitle}>{coinSymbol}</span>
      </div>
      <div className={styles.contextMenuDivider} />
      <div className={styles.contextMenuSection}>
        <div className={styles.contextMenuLabel}>Add to Watchlist:</div>
        {watchlists.map((watchlist) => {
          const isInWatchlist = isCoinInWatchlist(watchlist.id);
          return (
            <button
              key={watchlist.id}
              className={styles.contextMenuItem}
              onClick={() => {
                if (isInWatchlist) {
                  onRemoveFromWatchlist(watchlist.id);
                } else {
                  onAddToWatchlist(watchlist.id);
                }
                onClose();
              }}
            >
              <span className={styles.contextMenuCheck}>
                {isInWatchlist ? '✓' : '○'}
              </span>
              {watchlist.name}
              {watchlist.coins.length > 0 && (
                <span className={styles.contextMenuCount}>({watchlist.coins.length})</span>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.contextMenuDivider} />
      <button
        className={styles.contextMenuItem}
        onClick={() => {
          onCreateNewWatchlist();
          onClose();
        }}
      >
        + Create New Watchlist
      </button>
    </div>
  );
}

