import { useState, useRef, useEffect } from 'react';
import styles from '../styles/WatchlistHeader.module.css';
import { Watchlist } from '../hooks/useWatchlists';

interface WatchlistHeaderProps {
  watchlists: Watchlist[];
  activeWatchlistId: string | null;
  onSelectWatchlist: (watchlistId: string | null) => void;
  onCreateWatchlist: () => void;
  onDeleteWatchlist: (watchlistId: string) => void;
  onRenameWatchlist: (watchlistId: string, newName: string) => void;
  onWatchlistContextMenu: (e: React.MouseEvent, watchlist: Watchlist) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function WatchlistHeader({
  watchlists,
  activeWatchlistId,
  onSelectWatchlist,
  onCreateWatchlist,
  onDeleteWatchlist,
  onRenameWatchlist,
  onWatchlistContextMenu,
  searchQuery,
  onSearchChange,
}: WatchlistHeaderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = (watchlist: Watchlist) => {
    setEditingId(watchlist.id);
    setEditName(watchlist.name);
  };

  const handleSaveEdit = (watchlistId: string) => {
    if (editName.trim()) {
      onRenameWatchlist(watchlistId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, watchlistId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(watchlistId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className={styles.watchlistContainer}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search coins..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        title="Search for coins by symbol"
      />
      <div className={styles.watchlistLabel}>Watchlists:</div>
      <button
        className={`${styles.watchlistTab} ${activeWatchlistId === null ? styles.active : ''}`}
        onClick={() => onSelectWatchlist(null)}
      >
        All Coins
      </button>
      {watchlists.map((watchlist) => (
        <div key={watchlist.id} className={styles.watchlistTabWrapper}>
          {editingId === watchlist.id ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleSaveEdit(watchlist.id)}
              onKeyDown={(e) => handleKeyDown(e, watchlist.id)}
              className={styles.watchlistEditInput}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              className={`${styles.watchlistTab} ${
                activeWatchlistId === watchlist.id ? styles.active : ''
              }`}
              onClick={() => onSelectWatchlist(watchlist.id)}
              onDoubleClick={() => handleStartEdit(watchlist)}
              onContextMenu={(e) => {
                e.preventDefault();
                onWatchlistContextMenu(e, watchlist);
              }}
              title="Double-click to rename, right-click for options"
            >
              {watchlist.name}
              {watchlist.coins.length > 0 && (
                <span className={styles.watchlistCount}>({watchlist.coins.length})</span>
              )}
            </button>
          )}
        </div>
      ))}
      <button className={styles.watchlistAdd} onClick={onCreateWatchlist} title="Create new watchlist">
        +
      </button>
    </div>
  );
}

