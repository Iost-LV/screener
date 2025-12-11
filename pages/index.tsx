import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Terminal.module.css';
import { useWatchlists } from '../hooks/useWatchlists';
import { useTheme } from '../hooks/useTheme';
import { useBinanceWebSocket } from '../hooks/useBinanceWebSocket';
import { useColumnProfiles } from '../hooks/useColumnProfiles';
import ContextMenu from '../components/ContextMenu';
import WatchlistHeader from '../components/WatchlistHeader';
import WatchlistContextMenu from '../components/WatchlistContextMenu';
import Modal from '../components/Modal';
import Footer from '../components/Footer';

interface CryptoData {
  symbol: string;
  currentPrice: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  volume: number;
  vwap7d: number;
  vwapDistance7d: number;
  vwap30d: number;
  vwapDistance30d: number;
  vwap90d: number;
  vwapDistance90d: number;
  vwap365d: number;
  vwapDistance365d: number;
  ema2004h: number;
  ema200Distance4h: number;
  ema2001d: number;
  ema200Distance1d: number;
  zScore?: number;
  oiChange24h?: number;
  oiChange7d?: number;
}

type SortState = 'highest' | 'lowest' | 'default';
type SortColumn = 'symbol' | 'price' | 'dailyReturn' | 'weeklyReturn' | 'monthlyReturn' | 'vwapDistance7d' | 'vwapDistance30d' | 'vwapDistance90d' | 'vwapDistance365d' | 'ema200Distance4h' | 'ema200Distance1d' | 'volume' | 'zScore' | 'oiChange24h' | 'oiChange7d' | null;

export default function Home() {
  const [data, setData] = useState<CryptoData[]>([]);
  const [originalData, setOriginalData] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortState, setSortState] = useState<SortState>('default');
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    coinSymbol: string;
  } | null>(null);
  const [watchlistContextMenu, setWatchlistContextMenu] = useState<{
    x: number;
    y: number;
    watchlistId: string;
    watchlistName: string;
  } | null>(null);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const isUserToggleRef = useRef(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'create' | 'rename' | 'delete';
    watchlistId?: string;
    watchlistName?: string;
  }>({
    isOpen: false,
    type: 'create',
  });
  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    type: 'create' | 'rename' | 'delete';
    profileId?: string;
    profileName?: string;
  }>({
    isOpen: false,
    type: 'create',
  });
  const [showHiddenColumnsMenu, setShowHiddenColumnsMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    watchlists,
    mounted: watchlistsMounted,
    createWatchlist,
    deleteWatchlist,
    renameWatchlist,
    addCoinToWatchlist,
    removeCoinFromWatchlist,
    isCoinInWatchlist,
  } = useWatchlists();

  const {
    profiles: columnProfiles,
    activeProfileId,
    mounted: profilesMounted,
    createProfile,
    deleteProfile,
    renameProfile,
    updateProfileColumns,
    switchProfile,
    getActiveProfile,
  } = useColumnProfiles();

  const { themeColors, theme } = useTheme();


  const fetchData = async (resetSort: boolean = false) => {
    try {
      setLoading(true);
      const response = await fetch('/api/crypto-data');
      const result = await response.json();
      
      if (!response.ok) {
        // If response has an error message, use it
        const errorMessage = result.error || 'Failed to fetch data';
        throw new Error(errorMessage);
      }
      
      // Check if result is an array (valid data) or error object
      if (!Array.isArray(result)) {
        const errorMessage = result.error || 'Invalid data format received';
        throw new Error(errorMessage);
      }
      
      // Z-scores are now calculated in the API based on historical daily returns
      setOriginalData(result);
      setData(result);
      setLastUpdate(new Date());
      setError(null);
      // Only reset sort on initial load or manual refresh
      if (resetSort) {
        setSortColumn(null);
        setSortState('default');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle WebSocket price updates
  const handlePriceUpdate = useCallback((updates: Map<string, { symbol: string; currentPrice?: number; volume?: number; priceChangePercent?: number }>) => {
    setOriginalData((prevData) => {
      const updated = prevData.map((coin) => {
        const update = updates.get(coin.symbol);
        if (update) {
          // Only update fields that are provided (merge update with existing data)
          return {
            ...coin,
            ...(update.currentPrice !== undefined && { currentPrice: update.currentPrice }),
            ...(update.volume !== undefined && { volume: update.volume }),
            // Note: Returns are based on historical data, so they'll be updated on next full refresh
            // This is a trade-off to avoid making API calls for each price update
          };
        }
        return coin;
      });
      return updated;
    });

    // Update displayed data without resetting sort
    setData((prevData) => {
      const updated = prevData.map((coin) => {
        const update = updates.get(coin.symbol);
        if (update) {
          // Only update fields that are provided (merge update with existing data)
          return {
            ...coin,
            ...(update.currentPrice !== undefined && { currentPrice: update.currentPrice }),
            ...(update.volume !== undefined && { volume: update.volume }),
          };
        }
        return coin;
      });
      return updated;
    });

    setLastUpdate(new Date());
  }, []);

  // Get symbols for WebSocket subscription
  const symbols = useMemo(() => {
    return originalData.map((coin) => coin.symbol);
  }, [originalData]);

  // Connect to WebSocket for live price updates
  const { isConnected: wsConnected, connectionError: wsError } = useBinanceWebSocket(
    symbols,
    handlePriceUpdate
  );

  useEffect(() => {
    setMounted(true);
    // Initial data fetch with sort reset
    fetchData(true);
    // Refresh historical data every 30 minutes (increased from 10 minutes to reduce API calls)
    // This reduces API calls significantly while keeping historical metrics updated
    // Live price updates are handled via WebSocket to avoid rate limits
    const interval = setInterval(() => fetchData(false), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);


  // Filter data based on active watchlist and search query
  useEffect(() => {
    if (!watchlistsMounted || originalData.length === 0) return;

    let filteredData: CryptoData[];
    if (activeWatchlistId === null) {
      // Show all coins
      filteredData = [...originalData];
    } else {
      // Filter by active watchlist
      const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId);
      if (activeWatchlist) {
        filteredData = originalData.filter((coin) =>
          activeWatchlist.coins.includes(coin.symbol)
        );
      } else {
        filteredData = [...originalData];
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filteredData = filteredData.filter((coin) =>
        coin.symbol.toLowerCase().includes(query)
      );
    }

    // Apply current sort state to filtered data
    if (sortState === 'default' || sortColumn === null) {
      setData(filteredData);
    } else {
      // Re-apply sorting to filtered data
      const sortMultiplier = sortState === 'highest' ? -1 : 1;
      const sorted = [...filteredData].sort((a, b) => {
        if (sortColumn === 'symbol') {
          const aValue = a.symbol.toLowerCase();
          const bValue = b.symbol.toLowerCase();
          if (aValue < bValue) return -1 * sortMultiplier;
          if (aValue > bValue) return 1 * sortMultiplier;
          return 0;
        }

        let aValue: number;
        let bValue: number;

        switch (sortColumn) {
          case 'price':
            aValue = a.currentPrice;
            bValue = b.currentPrice;
            break;
          case 'dailyReturn':
            aValue = a.dailyReturn;
            bValue = b.dailyReturn;
            break;
          case 'weeklyReturn':
            aValue = a.weeklyReturn;
            bValue = b.weeklyReturn;
            break;
          case 'monthlyReturn':
            aValue = a.monthlyReturn;
            bValue = b.monthlyReturn;
            break;
          case 'vwapDistance7d':
            aValue = a.vwapDistance7d;
            bValue = b.vwapDistance7d;
            break;
          case 'vwapDistance30d':
            aValue = a.vwapDistance30d;
            bValue = b.vwapDistance30d;
            break;
          case 'vwapDistance90d':
            aValue = a.vwapDistance90d;
            bValue = b.vwapDistance90d;
            break;
          case 'vwapDistance365d':
            aValue = a.vwapDistance365d;
            bValue = b.vwapDistance365d;
            break;
          case 'ema200Distance4h':
            aValue = a.ema200Distance4h;
            bValue = b.ema200Distance4h;
            break;
          case 'ema200Distance1d':
            aValue = a.ema200Distance1d;
            bValue = b.ema200Distance1d;
            break;
          case 'volume':
            aValue = a.volume;
            bValue = b.volume;
            break;
          case 'zScore':
            aValue = a.zScore ?? 0;
            bValue = b.zScore ?? 0;
            break;
          case 'oiChange24h':
            aValue = a.oiChange24h ?? 0;
            bValue = b.oiChange24h ?? 0;
            break;
          case 'oiChange7d':
            aValue = a.oiChange7d ?? 0;
            bValue = b.oiChange7d ?? 0;
            break;
          default:
            return 0;
        }

        return (aValue - bValue) * sortMultiplier;
      });
      setData(sorted);
    }
  }, [activeWatchlistId, watchlists, originalData, watchlistsMounted, sortColumn, sortState, searchQuery]);

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toFixed(decimals);
  };

  const formatReturn = (returnValue: number): JSX.Element => {
    const sign = returnValue >= 0 ? '+' : '';
    const color = returnValue >= 0 ? themeColors.positive : themeColors.negative;
    return (
      <span style={{ color }}>
        {sign}
        {formatNumber(returnValue)}%
      </span>
    );
  };

  const formatVWAPDistance = (distance: number): JSX.Element => {
    const sign = distance >= 0 ? '+' : '';
    const color = distance >= 0 ? themeColors.positive : themeColors.negative;
    return (
      <span style={{ color }}>
        {sign}
        {formatNumber(distance)}%
      </span>
    );
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(2)}K`;
    }
    return `$${formatNumber(volume)}`;
  };

  const formatZScore = (zScore: number | undefined): JSX.Element => {
    if (zScore === undefined || isNaN(zScore)) {
      return <span style={{ color: themeColors.textTertiary }}>N/A</span>;
    }
    
    // Color coding: positive z-score (above average) = green, negative = red
    // Intensity based on magnitude
    const absZ = Math.abs(zScore);
    let color: string;
    
    if (zScore >= 2) {
      color = themeColors.positive; // Very strong positive (bright green)
    } else if (zScore >= 1) {
      color = themeColors.positiveLight; // Strong positive (light green)
    } else if (zScore >= 0) {
      color = themeColors.positiveLight; // Mild positive (pale green)
    } else if (zScore >= -1) {
      color = themeColors.negativeLight; // Mild negative (pale red)
    } else if (zScore >= -2) {
      color = themeColors.negativeLight; // Strong negative (light red)
    } else {
      color = themeColors.negative; // Very strong negative (bright red)
    }
    
    return (
      <span style={{ color }}>
        {zScore >= 0 ? '+' : ''}
        {formatNumber(zScore, 2)}
      </span>
    );
  };

  const formatOIChange = (oiChange: number | undefined): JSX.Element => {
    if (oiChange === undefined || isNaN(oiChange)) {
      return <span style={{ color: themeColors.textTertiary }}>N/A</span>;
    }
    const sign = oiChange >= 0 ? '+' : '';
    const color = oiChange >= 0 ? themeColors.positive : themeColors.negative;
    return (
      <span style={{ color }}>
        {sign}
        {formatNumber(oiChange)}%
      </span>
    );
  };

  const handleHeaderClick = (column: SortColumn) => {
    let newSortState: SortState;
    let newSortColumn: SortColumn;

    if (sortColumn === column) {
      // Cycle through states: highest -> lowest -> default
      if (sortState === 'highest') {
        newSortState = 'lowest';
        newSortColumn = column;
      } else if (sortState === 'lowest') {
        newSortState = 'default';
        newSortColumn = null;
      } else {
        newSortState = 'highest';
        newSortColumn = column;
      }
    } else {
      // New column clicked, start with highest
      newSortState = 'highest';
      newSortColumn = column;
    }

    setSortColumn(newSortColumn);
    setSortState(newSortState);

    // Get the base data to sort (either filtered by watchlist or all data)
    let baseData: CryptoData[];
    if (activeWatchlistId === null) {
      baseData = [...originalData];
    } else {
      const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId);
      if (activeWatchlist) {
        baseData = originalData.filter((coin) =>
          activeWatchlist.coins.includes(coin.symbol)
        );
      } else {
        baseData = [...originalData];
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      baseData = baseData.filter((coin) =>
        coin.symbol.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    let sortedData = [...baseData];
    
    if (newSortState === 'default') {
      // Restore original order (sorted by volume) - use baseData which is already filtered
      sortedData = [...baseData];
    } else {
      const sortMultiplier = newSortState === 'highest' ? -1 : 1;
      
      sortedData.sort((a, b) => {
        if (newSortColumn === 'symbol') {
          const aValue = a.symbol.toLowerCase();
          const bValue = b.symbol.toLowerCase();
          if (aValue < bValue) return -1 * sortMultiplier;
          if (aValue > bValue) return 1 * sortMultiplier;
          return 0;
        }

        let aValue: number;
        let bValue: number;

        switch (newSortColumn) {
          case 'price':
            aValue = a.currentPrice;
            bValue = b.currentPrice;
            break;
          case 'dailyReturn':
            aValue = a.dailyReturn;
            bValue = b.dailyReturn;
            break;
          case 'weeklyReturn':
            aValue = a.weeklyReturn;
            bValue = b.weeklyReturn;
            break;
          case 'monthlyReturn':
            aValue = a.monthlyReturn;
            bValue = b.monthlyReturn;
            break;
          case 'vwapDistance7d':
            aValue = a.vwapDistance7d;
            bValue = b.vwapDistance7d;
            break;
          case 'vwapDistance30d':
            aValue = a.vwapDistance30d;
            bValue = b.vwapDistance30d;
            break;
          case 'vwapDistance90d':
            aValue = a.vwapDistance90d;
            bValue = b.vwapDistance90d;
            break;
          case 'vwapDistance365d':
            aValue = a.vwapDistance365d;
            bValue = b.vwapDistance365d;
            break;
          case 'ema200Distance4h':
            aValue = a.ema200Distance4h;
            bValue = b.ema200Distance4h;
            break;
          case 'ema200Distance1d':
            aValue = a.ema200Distance1d;
            bValue = b.ema200Distance1d;
            break;
          case 'volume':
            aValue = a.volume;
            bValue = b.volume;
            break;
          case 'zScore':
            aValue = a.zScore ?? 0;
            bValue = b.zScore ?? 0;
            break;
          case 'oiChange24h':
            aValue = a.oiChange24h ?? 0;
            bValue = b.oiChange24h ?? 0;
            break;
          case 'oiChange7d':
            aValue = a.oiChange7d ?? 0;
            bValue = b.oiChange7d ?? 0;
            break;
          default:
            return 0;
        }

        return (aValue - bValue) * sortMultiplier;
      });
    }

    setData(sortedData);
  };

  const getSortIndicator = (column: SortColumn): string => {
    if (sortColumn !== column) return '';
    if (sortState === 'highest') return ' ↓';
    if (sortState === 'lowest') return ' ↑';
    return '';
  };

  // Track previous profile ID to only load on actual profile switch
  const prevProfileIdRef = useRef<string | null>(null);

  // Load column visibility from active profile on mount or profile change
  useEffect(() => {
    // Only load if profile actually changed (not just data update)
    const profileChanged = prevProfileIdRef.current !== activeProfileId;
    prevProfileIdRef.current = activeProfileId;

    if (profilesMounted && activeProfileId && (profileChanged || !isUserToggleRef.current)) {
      const activeProfile = getActiveProfile();
      if (activeProfile) {
        const profileHidden = new Set(activeProfile.hiddenColumns);
        // Only update if different to avoid unnecessary re-renders
        const currentHidden = Array.from(hiddenColumns).sort().join(',');
        const profileHiddenStr = Array.from(profileHidden).sort().join(',');
        if (currentHidden !== profileHiddenStr) {
          isUserToggleRef.current = false; // Reset flag when loading from profile
          setHiddenColumns(profileHidden);
        }
      }
    }
    // Reset the flag after a short delay
    if (isUserToggleRef.current) {
      const timeoutId = setTimeout(() => {
        isUserToggleRef.current = false;
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [profilesMounted, activeProfileId, getActiveProfile]);

  // Save column visibility to active profile whenever it changes (debounced)
  useEffect(() => {
    if (!profilesMounted || !activeProfileId) return;
    
    const hiddenArray = Array.from(hiddenColumns);
    const activeProfile = getActiveProfile();
    
    // Only save if different from what's in the profile
    if (activeProfile) {
      const profileHidden = activeProfile.hiddenColumns.sort().join(',');
      const currentHidden = hiddenArray.sort().join(',');
      if (profileHidden !== currentHidden) {
        // Use a small timeout to debounce rapid changes
        const timeoutId = setTimeout(() => {
          updateProfileColumns(activeProfileId, hiddenArray);
        }, 100);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [hiddenColumns, profilesMounted, activeProfileId, updateProfileColumns, getActiveProfile]);

  const toggleColumn = useCallback((columnKey: string) => {
    isUserToggleRef.current = true;
    setHiddenColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey);
      } else {
        newSet.add(columnKey);
      }
      return newSet;
    });
  }, []);

  const isColumnHidden = (columnKey: string) => hiddenColumns.has(columnKey);

  const handleRowContextMenu = (e: React.MouseEvent, coinSymbol: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      coinSymbol,
    });
  };

  const handleCreateNewWatchlist = () => {
    setModal({
      isOpen: true,
      type: 'create',
    });
  };

  const handleWatchlistContextMenu = (e: React.MouseEvent, watchlist: { id: string; name: string }) => {
    e.preventDefault();
    setWatchlistContextMenu({
      x: e.clientX,
      y: e.clientY,
      watchlistId: watchlist.id,
      watchlistName: watchlist.name,
    });
  };

  const handleRenameWatchlist = (watchlistId: string) => {
    const watchlist = watchlists.find((w) => w.id === watchlistId);
    if (watchlist) {
      setModal({
        isOpen: true,
        type: 'rename',
        watchlistId,
        watchlistName: watchlist.name,
      });
    }
  };

  const handleDeleteWatchlist = (watchlistId: string) => {
    const watchlist = watchlists.find((w) => w.id === watchlistId);
    if (watchlist) {
      setModal({
        isOpen: true,
        type: 'delete',
        watchlistId,
        watchlistName: watchlist.name,
      });
    }
  };

  const handleModalSubmit = (value: string) => {
    if (modal.type === 'create') {
      const newId = createWatchlist(value);
      setActiveWatchlistId(newId);
    } else if (modal.type === 'rename' && modal.watchlistId) {
      renameWatchlist(modal.watchlistId, value);
    } else if (modal.type === 'delete' && modal.watchlistId) {
      deleteWatchlist(modal.watchlistId);
      if (activeWatchlistId === modal.watchlistId) {
        setActiveWatchlistId(null);
      }
    }
  };

  const handleCreateNewProfile = () => {
    setProfileModal({
      isOpen: true,
      type: 'create',
    });
  };

  const handleRenameProfile = (profileId: string) => {
    const profile = columnProfiles.find((p) => p.id === profileId);
    if (profile) {
      setProfileModal({
        isOpen: true,
        type: 'rename',
        profileId,
        profileName: profile.name,
      });
    }
  };

  const handleDeleteProfile = (profileId: string) => {
    const profile = columnProfiles.find((p) => p.id === profileId);
    if (profile) {
      setProfileModal({
        isOpen: true,
        type: 'delete',
        profileId,
        profileName: profile.name,
      });
    }
  };

  const handleProfileModalSubmit = (value: string) => {
    if (profileModal.type === 'create') {
      const currentHidden = Array.from(hiddenColumns);
      createProfile(value, currentHidden);
    } else if (profileModal.type === 'rename' && profileModal.profileId) {
      renameProfile(profileModal.profileId, value);
    } else if (profileModal.type === 'delete' && profileModal.profileId) {
      deleteProfile(profileModal.profileId);
    }
  };

  return (
    <>
      <Head>
        <title>Crypto Terminal - Binance Perpetual Futures</title>
        <meta name="description" content="Crypto terminal with top 100 Binance perpetual futures" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.terminal}>
        <div className={styles.scrollableContent}>
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <div className={styles.headerLeft}>
                <div className={styles.japaneseSign}>lost</div>
              </div>
              <div className={styles.headerRight}>
                <span className={styles.updateTime}>
                  {mounted && lastUpdate ? `Last Update: ${lastUpdate.toLocaleTimeString()}` : 'Last Update: --:--:-- --'}
                </span>
                <button className={styles.refreshButton} onClick={() => fetchData(true)}>
                  Refresh
                </button>
                {profilesMounted && (
                  <div className={styles.columnProfilesMenu}>
                    <div className={styles.profileSelector}>
                      <select
                        className={styles.profileSelect}
                        value={activeProfileId || ''}
                        onChange={(e) => switchProfile(e.target.value)}
                        title="Switch column profile"
                      >
                        {columnProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className={styles.profileButton}
                        onClick={handleCreateNewProfile}
                        title="Create new profile"
                      >
                        +
                      </button>
                      {activeProfileId && columnProfiles.length > 1 && (
                        <>
                          <button
                            className={styles.profileButton}
                            onClick={() => handleRenameProfile(activeProfileId)}
                            title="Rename profile"
                          >
                            ✎
                          </button>
                          <button
                            className={styles.profileButton}
                            onClick={() => handleDeleteProfile(activeProfileId)}
                            title="Delete profile"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                    {hiddenColumns.size > 0 && (
                      <div className={styles.hiddenColumnsMenu}>
                        <button 
                          className={styles.showColumnsButton}
                          onClick={() => setShowHiddenColumnsMenu(!showHiddenColumnsMenu)}
                          title={`${hiddenColumns.size} column(s) hidden - Click to restore`}
                        >
                          Show ({hiddenColumns.size}) {showHiddenColumnsMenu ? '▼' : '▶'}
                        </button>
                        {showHiddenColumnsMenu && (
                          <div className={styles.hiddenColumnsList}>
                            {Array.from(hiddenColumns).map((col) => (
                              <button
                                key={col}
                                className={styles.restoreColumnButton}
                                onClick={() => {
                                  toggleColumn(col);
                                  if (hiddenColumns.size === 1) {
                                    setShowHiddenColumnsMenu(false);
                                  }
                                }}
                              >
                                {col === 'dailyReturn' && 'Daily Return'}
                                {col === 'weeklyReturn' && 'Weekly Return'}
                                {col === 'monthlyReturn' && 'Monthly Return'}
                                {col === 'vwapDistance7d' && '7D VWAP Dist'}
                                {col === 'vwapDistance30d' && '30D VWAP Dist'}
                                {col === 'vwapDistance90d' && '90D VWAP Dist'}
                                {col === 'vwapDistance365d' && '365D VWAP Dist'}
                                {col === 'ema200Distance4h' && '4H EMA200 Dist'}
                                {col === 'ema200Distance1d' && '1D EMA200 Dist'}
                                {col === 'oiChange24h' && '24h OI Change'}
                                {col === 'oiChange7d' && '7d OI Change'}
                                {col === 'zScore' && 'Z-Score'}
                                {col === 'volume' && '24h Volume'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {watchlistsMounted && (
              <WatchlistHeader
                watchlists={watchlists}
                activeWatchlistId={activeWatchlistId}
                onSelectWatchlist={setActiveWatchlistId}
                onCreateWatchlist={handleCreateNewWatchlist}
                onDeleteWatchlist={deleteWatchlist}
                onRenameWatchlist={renameWatchlist}
                onWatchlistContextMenu={handleWatchlistContextMenu}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
          </div>


          {error && !loading && (
            <div className={styles.errorMessage}>
              Error: {error}. Please try refreshing.
            </div>
          )}

          {loading && data.length === 0 ? (
            <div className={styles.loading}>Loading crypto data...</div>
          ) : (
            <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th 
                    className={`${styles.colSymbol} ${styles.sortableHeader}`}
                    onClick={() => handleHeaderClick('symbol')}
                  >
                    Symbol{getSortIndicator('symbol')}
                  </th>
                  <th 
                    className={`${styles.colPrice} ${styles.sortableHeader}`}
                    onClick={() => handleHeaderClick('price')}
                  >
                    Price (USDT){getSortIndicator('price')}
                  </th>
                  {!isColumnHidden('dailyReturn') && (
                  <th 
                    className={`${styles.colReturn} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('dailyReturn')}
                  >
                    Daily Return{getSortIndicator('dailyReturn')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('dailyReturn');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('weeklyReturn') && (
                  <th 
                    className={`${styles.colReturn} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('weeklyReturn')}
                  >
                    Weekly Return{getSortIndicator('weeklyReturn')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('weeklyReturn');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('monthlyReturn') && (
                  <th 
                    className={`${styles.colReturn} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('monthlyReturn')}
                  >
                    Monthly Return{getSortIndicator('monthlyReturn')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('monthlyReturn');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('vwapDistance7d') && (
                  <th 
                    className={`${styles.colVWAP} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('vwapDistance7d')}
                  >
                    7D VWAP Dist{getSortIndicator('vwapDistance7d')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('vwapDistance7d');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('vwapDistance30d') && (
                  <th 
                    className={`${styles.colVWAP} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('vwapDistance30d')}
                  >
                    30D VWAP Dist{getSortIndicator('vwapDistance30d')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('vwapDistance30d');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('vwapDistance90d') && (
                  <th 
                    className={`${styles.colVWAP} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('vwapDistance90d')}
                  >
                    90D VWAP Dist{getSortIndicator('vwapDistance90d')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('vwapDistance90d');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('vwapDistance365d') && (
                  <th 
                    className={`${styles.colVWAP} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('vwapDistance365d')}
                  >
                    365D VWAP Dist{getSortIndicator('vwapDistance365d')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('vwapDistance365d');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('ema200Distance4h') && (
                  <th 
                    className={`${styles.colVWAP} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('ema200Distance4h')}
                  >
                    4H EMA200 Dist{getSortIndicator('ema200Distance4h')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('ema200Distance4h');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('ema200Distance1d') && (
                  <th 
                    className={`${styles.colVWAP} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('ema200Distance1d')}
                  >
                    1D EMA200 Dist{getSortIndicator('ema200Distance1d')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('ema200Distance1d');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('oiChange24h') && (
                  <th 
                    className={`${styles.colReturn} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('oiChange24h')}
                  >
                    24h OI Change{getSortIndicator('oiChange24h')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('oiChange24h');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('oiChange7d') && (
                  <th 
                    className={`${styles.colReturn} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('oiChange7d')}
                  >
                    7d OI Change{getSortIndicator('oiChange7d')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('oiChange7d');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                  {!isColumnHidden('zScore') && (
                  <th 
                    className={`${styles.colZScore} ${styles.sortableHeader} ${styles.tooltipContainer} ${styles.columnHeader}`}
                    onMouseEnter={() => setHoveredTooltip('zScore')}
                    onMouseLeave={() => setHoveredTooltip(null)}
                    onClick={() => handleHeaderClick('zScore')}
                  >
                    Z-Score{getSortIndicator('zScore')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('zScore');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                    {hoveredTooltip === 'zScore' && (
                      <div className={styles.tooltip}>
                        <strong>Z-Score Formula:</strong><br />
                        Z = (X - μ) / σ<br />
                        <br />
                        <strong>Where:</strong><br />
                        • X = current daily return<br />
                        • μ = mean of last 30 days of daily returns<br />
                        • σ = standard deviation of last 30 days of daily returns<br />
                        <br />
                        <strong>Calculation Steps:</strong><br />
                        1. Collect last 30 days of daily returns<br />
                        2. Calculate mean (μ): Sum all returns ÷ 30<br />
                        3. Calculate σ: √(Σ(Xi - μ)² / 30)<br />
                        4. Calculate today's return: (currentPrice - yesterday's close) / yesterday's close<br />
                        5. Z = (today's return - μ) / σ<br />
                        <br />
                        <strong>Interpretation:</strong><br />
                        • +2.0 or higher: Exceptionally strong (top ~2.5%)<br />
                        • +1.0 to +2.0: Strong (top ~16%)<br />
                        • 0 to +1.0: Above average<br />
                        • -1.0 to 0: Below average<br />
                        • -1.0 to -2.0: Weak (bottom ~16%)<br />
                        • -2.0 or lower: Exceptionally weak (bottom ~2.5%)
                      </div>
                    )}
                  </th>
                  )}
                  {!isColumnHidden('volume') && (
                  <th 
                    className={`${styles.colVolume} ${styles.sortableHeader} ${styles.columnHeader}`}
                    onClick={() => handleHeaderClick('volume')}
                  >
                    24h Volume{getSortIndicator('volume')}
                    <button 
                      className={styles.columnToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleColumn('volume');
                      }}
                      title="Hide column"
                    >
                      ×
                    </button>
                  </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={`${item.symbol}-${theme}`}
                    className={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                    onContextMenu={(e) => handleRowContextMenu(e, item.symbol)}
                  >
                    <td className={styles.colSymbol}>{item.symbol}</td>
                    <td className={styles.colPrice}>
                      {formatNumber(item.currentPrice, item.currentPrice < 1 ? 6 : 2)}
                    </td>
                    {!isColumnHidden('dailyReturn') && (
                      <td className={styles.colReturn}>{formatReturn(item.dailyReturn)}</td>
                    )}
                    {!isColumnHidden('weeklyReturn') && (
                      <td className={styles.colReturn}>{formatReturn(item.weeklyReturn)}</td>
                    )}
                    {!isColumnHidden('monthlyReturn') && (
                      <td className={styles.colReturn}>{formatReturn(item.monthlyReturn)}</td>
                    )}
                    {!isColumnHidden('vwapDistance7d') && (
                      <td className={styles.colVWAP}>{formatVWAPDistance(item.vwapDistance7d)}</td>
                    )}
                    {!isColumnHidden('vwapDistance30d') && (
                      <td className={styles.colVWAP}>{formatVWAPDistance(item.vwapDistance30d)}</td>
                    )}
                    {!isColumnHidden('vwapDistance90d') && (
                      <td className={styles.colVWAP}>{formatVWAPDistance(item.vwapDistance90d)}</td>
                    )}
                    {!isColumnHidden('vwapDistance365d') && (
                      <td className={styles.colVWAP}>{formatVWAPDistance(item.vwapDistance365d)}</td>
                    )}
                    {!isColumnHidden('ema200Distance4h') && (
                      <td className={styles.colVWAP}>{formatVWAPDistance(item.ema200Distance4h)}</td>
                    )}
                    {!isColumnHidden('ema200Distance1d') && (
                      <td className={styles.colVWAP}>{formatVWAPDistance(item.ema200Distance1d)}</td>
                    )}
                    {!isColumnHidden('oiChange24h') && (
                      <td className={styles.colReturn}>{formatOIChange(item.oiChange24h)}</td>
                    )}
                    {!isColumnHidden('oiChange7d') && (
                      <td className={styles.colReturn}>{formatOIChange(item.oiChange7d)}</td>
                    )}
                    {!isColumnHidden('zScore') && (
                      <td 
                        className={`${styles.colZScore} ${styles.tooltipContainer}`}
                        onMouseEnter={() => setHoveredTooltip(`zScore-${item.symbol}`)}
                        onMouseLeave={() => setHoveredTooltip(null)}
                      >
                        {formatZScore(item.zScore)}
                        {hoveredTooltip === `zScore-${item.symbol}` && (
                          <div className={styles.tooltip}>
                            <strong>Z-Score Formula:</strong><br />
                            Z = (X - μ) / σ<br />
                            <br />
                            <strong>Where:</strong><br />
                            • X = current daily return<br />
                            • μ = mean of last 30 days of daily returns<br />
                            • σ = standard deviation of last 30 days of daily returns<br />
                            <br />
                            <strong>Calculation Steps:</strong><br />
                            1. Collect last 30 days of daily returns<br />
                            2. Calculate mean (μ): Sum all returns ÷ 30<br />
                            3. Calculate σ: √(Σ(Xi - μ)² / 30)<br />
                            4. Calculate today's return: (currentPrice - yesterday's close) / yesterday's close<br />
                            5. Z = (today's return - μ) / σ<br />
                            <br />
                            <strong>Interpretation:</strong><br />
                            • +2.0 or higher: Exceptionally strong (top ~2.5%)<br />
                            • +1.0 to +2.0: Strong (top ~16%)<br />
                            • 0 to +1.0: Above average<br />
                            • -1.0 to 0: Below average<br />
                            • -1.0 to -2.0: Weak (bottom ~16%)<br />
                            • -2.0 or lower: Exceptionally weak (bottom ~2.5%)
                          </div>
                        )}
                      </td>
                    )}
                    {!isColumnHidden('volume') && (
                      <td className={styles.colVolume}>{formatVolume(item.volume)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            coinSymbol={contextMenu.coinSymbol}
            watchlists={watchlists}
            onClose={() => setContextMenu(null)}
            onAddToWatchlist={(watchlistId) => addCoinToWatchlist(watchlistId, contextMenu.coinSymbol)}
            onRemoveFromWatchlist={(watchlistId) => removeCoinFromWatchlist(watchlistId, contextMenu.coinSymbol)}
            isCoinInWatchlist={(watchlistId) => isCoinInWatchlist(watchlistId, contextMenu.coinSymbol)}
            onCreateNewWatchlist={handleCreateNewWatchlist}
          />
        )}
        {watchlistContextMenu && (
          <WatchlistContextMenu
            x={watchlistContextMenu.x}
            y={watchlistContextMenu.y}
            watchlistName={watchlistContextMenu.watchlistName}
            watchlistId={watchlistContextMenu.watchlistId}
            onClose={() => setWatchlistContextMenu(null)}
            onRename={() => {
              handleRenameWatchlist(watchlistContextMenu.watchlistId);
              setWatchlistContextMenu(null);
            }}
            onDelete={() => {
              handleDeleteWatchlist(watchlistContextMenu.watchlistId);
              setWatchlistContextMenu(null);
            }}
            canDelete={watchlists.length > 1}
          />
        )}
        {modal.isOpen && (
          <Modal
            isOpen={modal.isOpen}
            onClose={() => setModal({ isOpen: false, type: 'create' })}
            title={
              modal.type === 'create'
                ? 'Create New Watchlist'
                : modal.type === 'rename'
                ? 'Rename Watchlist'
                : `Delete "${modal.watchlistName}"?`
            }
            placeholder={modal.type === 'create' ? 'Enter watchlist name' : modal.type === 'rename' ? 'Enter new watchlist name' : ''}
            initialValue={modal.type === 'rename' ? modal.watchlistName : ''}
            onSubmit={
              modal.type === 'delete'
                ? () => {
                    if (modal.watchlistId) {
                      deleteWatchlist(modal.watchlistId);
                      if (activeWatchlistId === modal.watchlistId) {
                        setActiveWatchlistId(null);
                      }
                    }
                  }
                : handleModalSubmit
            }
            submitLabel={modal.type === 'create' ? 'Create' : modal.type === 'rename' ? 'Rename' : 'Delete'}
            cancelLabel="Cancel"
            confirmationMode={modal.type === 'delete'}
            confirmationMessage={modal.type === 'delete' ? `Are you sure you want to delete "${modal.watchlistName}"? This action cannot be undone.` : ''}
          />
        )}
        {profileModal.isOpen && (
          <Modal
            isOpen={profileModal.isOpen}
            onClose={() => setProfileModal({ isOpen: false, type: 'create' })}
            title={
              profileModal.type === 'create'
                ? 'Create New Column Profile'
                : profileModal.type === 'rename'
                ? 'Rename Column Profile'
                : `Delete "${profileModal.profileName}"?`
            }
            placeholder={profileModal.type === 'create' ? 'Enter profile name' : profileModal.type === 'rename' ? 'Enter new profile name' : ''}
            initialValue={profileModal.type === 'rename' ? profileModal.profileName : ''}
            onSubmit={
              profileModal.type === 'delete'
                ? () => {
                    if (profileModal.profileId) {
                      deleteProfile(profileModal.profileId);
                    }
                  }
                : handleProfileModalSubmit
            }
            submitLabel={profileModal.type === 'create' ? 'Create' : profileModal.type === 'rename' ? 'Rename' : 'Delete'}
            cancelLabel="Cancel"
            confirmationMode={profileModal.type === 'delete'}
            confirmationMessage={profileModal.type === 'delete' ? `Are you sure you want to delete "${profileModal.profileName}"? This action cannot be undone.` : ''}
          />
        )}
        {showHiddenColumnsMenu && (
          <div 
            className={styles.dropdownOverlay}
            onClick={() => setShowHiddenColumnsMenu(false)}
          />
        )}
        <Footer />
      </main>
    </>
  );
}

