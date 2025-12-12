import { useEffect, useRef, useState, useCallback } from 'react';

interface BinanceTickerUpdate {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Volume
  q: string; // Quote volume
  P: string; // Price change percent
}

interface PriceUpdate {
  symbol: string;
  currentPrice?: number;
  volume?: number;
  priceChangePercent?: number;
}

export function useBinanceWebSocket(
  symbols: string[],
  onUpdate: (updates: Map<string, PriceUpdate>) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const symbolsRef = useRef<string[]>(symbols);
  const onUpdateRef = useRef(onUpdate);

  // Keep refs updated
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Binance WebSocket stream for all tickers
      // Using the aggregate ticker stream which includes all symbols
      const wsUrl = 'wss://fstream.binance.com/ws/!ticker@arr';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Binance WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        
        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const tickers: BinanceTickerUpdate[] = JSON.parse(event.data);
          
          // Filter to only symbols we care about and create update map
          // Use Set for O(1) lookup performance
          const updates = new Map<string, PriceUpdate>();
          const symbolsSet = new Set(symbolsRef.current.map(s => s.toLowerCase()));
          
          // Optimize: only process tickers we care about
          for (const ticker of tickers) {
            const symbol = ticker.s;
            if (symbolsSet.has(symbol.toLowerCase())) {
              const price = parseFloat(ticker.c);
              const volume = parseFloat(ticker.q);
              
              // Only add if valid numbers
              if (!isNaN(price) && !isNaN(volume)) {
                updates.set(symbol, {
                  symbol,
                  currentPrice: price,
                  volume: volume,
                  priceChangePercent: parseFloat(ticker.P),
                });
              }
            }
          }

          // Only call update if we have valid updates
          if (updates.size > 0) {
            onUpdateRef.current(updates);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed, attempting to reconnect...');
        setIsConnected(false);
        
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to connect to WebSocket');
      setIsConnected(false);
      
      // Retry connection after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, []);

  useEffect(() => {
    if (symbols.length === 0) {
      return;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbols.length, connect]);

  return { isConnected, connectionError };
}

