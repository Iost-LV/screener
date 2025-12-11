import { useState, useEffect, useCallback } from 'react';

export interface Watchlist {
  id: string;
  name: string;
  coins: string[]; // Array of coin symbols
}

const STORAGE_KEY = 'crypto-terminal-watchlists';

export function useWatchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load watchlists from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setWatchlists(Array.isArray(parsed) ? parsed : []);
      } else {
        // Create a default watchlist
        const defaultWatchlist: Watchlist = {
          id: 'default',
          name: 'My Watchlist',
          coins: [],
        };
        setWatchlists([defaultWatchlist]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([defaultWatchlist]));
      }
    } catch (error) {
      console.error('Error loading watchlists:', error);
      setWatchlists([]);
    }
  }, []);

  // Save watchlists to localStorage whenever they change
  useEffect(() => {
    if (mounted && watchlists.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlists));
      } catch (error) {
        console.error('Error saving watchlists:', error);
      }
    }
  }, [watchlists, mounted]);

  const createWatchlist = useCallback((name: string): string => {
    const newWatchlist: Watchlist = {
      id: `watchlist-${Date.now()}`,
      name,
      coins: [],
    };
    setWatchlists((prev) => [...prev, newWatchlist]);
    return newWatchlist.id;
  }, []);

  const deleteWatchlist = useCallback((id: string) => {
    setWatchlists((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const renameWatchlist = useCallback((id: string, newName: string) => {
    setWatchlists((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name: newName } : w))
    );
  }, []);

  const addCoinToWatchlist = useCallback((watchlistId: string, coinSymbol: string) => {
    setWatchlists((prev) =>
      prev.map((w) => {
        if (w.id === watchlistId) {
          // Don't add if already in the watchlist
          if (w.coins.includes(coinSymbol)) {
            return w;
          }
          return { ...w, coins: [...w.coins, coinSymbol] };
        }
        return w;
      })
    );
  }, []);

  const removeCoinFromWatchlist = useCallback((watchlistId: string, coinSymbol: string) => {
    setWatchlists((prev) =>
      prev.map((w) => {
        if (w.id === watchlistId) {
          return { ...w, coins: w.coins.filter((c) => c !== coinSymbol) };
        }
        return w;
      })
    );
  }, []);

  const isCoinInWatchlist = useCallback((watchlistId: string, coinSymbol: string): boolean => {
    const watchlist = watchlists.find((w) => w.id === watchlistId);
    return watchlist ? watchlist.coins.includes(coinSymbol) : false;
  }, [watchlists]);

  return {
    watchlists,
    mounted,
    createWatchlist,
    deleteWatchlist,
    renameWatchlist,
    addCoinToWatchlist,
    removeCoinFromWatchlist,
    isCoinInWatchlist,
  };
}

