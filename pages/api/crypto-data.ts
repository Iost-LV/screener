import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: CryptoData[];
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  openInterest?: string; // Some tickers might include OI
}

interface BinanceExchangeInfo {
  symbols: Array<{
    symbol: string;
    status: string;
    contractType: string;
  }>;
}

interface BinanceKline {
  [index: number]: string | number;
  0: number; // Open time
  1: string; // Open price
  2: string; // High price
  3: string; // Low price
  4: string; // Close price
  5: string; // Volume
  6: number; // Close time
}

interface BinanceOpenInterest {
  openInterest: string;
  symbol: string;
}

interface BinanceOpenInterestHist {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CryptoData[] | { error: string }>
) {
  try {
    // Check cache first
    const cacheKey = 'crypto-data';
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Return cached data with appropriate headers
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      res.status(200).json(cached.data);
      return;
    }
    
    // Set cache headers for fresh data
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    // Fetch exchange info to get only active/trading symbols
    // Note: This API is now called less frequently (every 10 minutes) since
    // live price updates are handled via WebSocket to avoid rate limits
    let exchangeInfoResponse;
    try {
      exchangeInfoResponse = await axios.get<BinanceExchangeInfo>(
        'https://fapi.binance.com/fapi/v1/exchangeInfo',
        {
          timeout: 10000,
        }
      );
    } catch (error: any) {
      if (error?.response?.status === 429) {
        res.status(429).json({ 
          error: 'Too many requests. Please wait a moment and try again. The app uses WebSocket for live updates to minimize API calls.' 
        });
        return;
      }
      throw error;
    }

    // Get active perpetual futures symbols
    const activeSymbols = new Set(
      exchangeInfoResponse.data.symbols
        .filter(
          (symbol) =>
            symbol.status === 'TRADING' &&
            symbol.contractType === 'PERPETUAL' &&
            symbol.symbol.endsWith('USDT')
        )
        .map((symbol) => symbol.symbol)
    );

    // Fetch all perpetual futures tickers
    let tickersResponse;
    try {
      tickersResponse = await axios.get<BinanceTicker[]>(
        'https://fapi.binance.com/fapi/v1/ticker/24hr',
        {
          timeout: 10000,
        }
      );
    } catch (error: any) {
      if (error?.response?.status === 429) {
        res.status(429).json({ 
          error: 'Too many requests. Please wait a moment and try again. The app uses WebSocket for live updates to minimize API calls.' 
        });
        return;
      }
      throw error;
    }

    // Filter for active USDT pairs with valid volume and price, then sort by volume
    const usdtPairs = tickersResponse.data
      .filter((ticker) => {
        const isActive = activeSymbols.has(ticker.symbol);
        const hasVolume = parseFloat(ticker.quoteVolume) > 0;
        const hasPrice = parseFloat(ticker.lastPrice) > 0;
        const isValidPrice = !isNaN(parseFloat(ticker.lastPrice));
        return isActive && hasVolume && hasPrice && isValidPrice;
      })
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 100);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Helper function to add delay between requests (rate limiting)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper function to retry with exponential backoff
    const retryWithBackoff = async <T>(
      fn: () => Promise<T>,
      maxRetries: number = 3,
      baseDelay: number = 1000
    ): Promise<T | null> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error: any) {
          if (error?.response?.status === 429 && attempt < maxRetries - 1) {
            const retryAfter = error?.response?.headers?.['retry-after'] 
              ? parseInt(error.response.headers['retry-after']) * 1000 
              : baseDelay * Math.pow(2, attempt);
            console.warn(`Rate limited, retrying after ${retryAfter}ms (attempt ${attempt + 1}/${maxRetries})`);
            await delay(retryAfter);
            continue;
          }
          throw error;
        }
      }
      return null;
    };

    // Fetch historical data for each pair with optimized parallel processing
    // Process in larger batches with minimal delays for maximum throughput
    const BATCH_SIZE = 25; // Increased from 10 to 25 for better parallelization
    const BATCH_DELAY = 100; // Reduced from 200ms to 100ms
    
    const cryptoDataResults: (CryptoData | null)[] = [];
    
    // Process batches with controlled concurrency
    for (let i = 0; i < usdtPairs.length; i += BATCH_SIZE) {
      const batch = usdtPairs.slice(i, i + BATCH_SIZE);
      
      // Process all symbols in batch in parallel - fetch 1d and 4h klines in parallel for each symbol
      const batchPromises = batch.map(async (ticker) => {
        try {
          const symbol = ticker.symbol;
          const currentPrice = parseFloat(ticker.lastPrice);
          const volume = parseFloat(ticker.quoteVolume);

          // Validate current price
          if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
            return null;
          }

          // Fetch 1d and 4h klines in parallel for each symbol (major optimization)
          const [klinesResponse, klines4hResponse] = await Promise.allSettled([
            retryWithBackoff(async () => {
              return await axios.get<BinanceKline[]>(
                `https://fapi.binance.com/fapi/v1/klines`,
                {
                  params: {
                    symbol: symbol,
                    interval: '1d',
                    limit: 500,
                  },
                  timeout: 10000,
                }
              );
            }),
            retryWithBackoff(async () => {
              return await axios.get<BinanceKline[]>(
                `https://fapi.binance.com/fapi/v1/klines`,
                {
                  params: {
                    symbol: symbol,
                    interval: '4h',
                    limit: 500,
                  },
                  timeout: 10000,
                }
              );
            }),
          ]);

          // Handle 1d klines response
          let klines: BinanceKline[] = [];
          if (klinesResponse.status === 'fulfilled' && klinesResponse.value) {
            klines = klinesResponse.value.data || [];
          } else {
            const error = klinesResponse.status === 'rejected' ? klinesResponse.reason : null;
            if (error?.response?.status === 429) {
              console.warn(`Rate limited while fetching klines for ${symbol}, skipping...`);
            }
            return null;
          }

          // Handle 4h klines response
          let klines4h: BinanceKline[] = [];
          if (klines4hResponse.status === 'fulfilled' && klines4hResponse.value) {
            klines4h = klines4hResponse.value.data || [];
          } else {
            // 4h data is optional, continue without it
            const error = klines4hResponse.status === 'rejected' ? klines4hResponse.reason : null;
            if (error?.response?.status !== 429) {
              console.warn(`Failed to fetch 4H klines for ${symbol}, continuing without 4H data...`);
            }
          }

        if (klines.length === 0) {
          return null;
        }

        // Validate klines data - check if we have valid price data
        const hasValidKlines = klines.some((kline) => {
          const close = parseFloat(kline[4] as string);
          return close > 0 && !isNaN(close);
        });

        if (!hasValidKlines) {
          return null;
        }

        // Validate 4H klines data
        const hasValidKlines4h = klines4h.length > 0 && klines4h.some((kline) => {
          const close = parseFloat(kline[4] as string);
          return close > 0 && !isNaN(close);
        });

        // Calculate returns - rolling period returns
        // Daily return: (current price - yesterday's close) / yesterday's close
        // Weekly return: (current price - 7 days ago close) / 7 days ago close  
        // Monthly return: (current price - 30 days ago close) / 30 days ago close
        // 
        // Note: Using CLOSE prices (index 4) from historical candles
        // This calculates: "What's the return from X days ago to right now?"
        
        const dailyReturn =
          klines.length >= 2
            ? ((currentPrice - parseFloat(klines[klines.length - 2][4])) /
                parseFloat(klines[klines.length - 2][4])) *
              100
            : 0;

        const weeklyReturn =
          klines.length >= 8
            ? ((currentPrice - parseFloat(klines[klines.length - 8][4])) /
                parseFloat(klines[klines.length - 8][4])) *
              100
            : 0;

        const monthlyReturn =
          klines.length >= 30
            ? ((currentPrice - parseFloat(klines[klines.length - 30][4])) /
                parseFloat(klines[klines.length - 30][4])) *
              100
            : 0;

        // Helper function to calculate VWAP for a specific period
        // VWAP = Sum(Typical Price * Volume) / Sum(Volume)
        // Typical Price = (High + Low + Close) / 3
        const calculateVWAP = (days: number): { vwap: number; distance: number } => {
          const periodKlines = klines.slice(-days);
          let totalPriceVolume = 0;
          let totalVolume = 0;

          for (const kline of periodKlines) {
            const high = parseFloat(kline[2] as string);
            const low = parseFloat(kline[3] as string);
            const close = parseFloat(kline[4] as string);
            const volume = parseFloat(kline[5] as string);
            
            const typicalPrice = (high + low + close) / 3;
            totalPriceVolume += typicalPrice * volume;
            totalVolume += volume;
          }

          const vwap = totalVolume > 0 ? totalPriceVolume / totalVolume : currentPrice;
          const distance = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;
          
          return { vwap, distance };
        };

        // Calculate VWAP for different periods
        const vwap7d = calculateVWAP(7);
        const vwap30d = calculateVWAP(30);
        const vwap90d = calculateVWAP(90);
        const vwap365d = calculateVWAP(365);

        // Helper function to calculate EMA directly
        // EMA = (Price(t) * k) + (EMA(y) * (1 - k))
        // k = 2 / (N + 1), where N is the period
        // Direct EMA calculation: Use all available historical data for accurate EMA
        const calculateEMA = (klines: BinanceKline[], period: number): number => {
          if (!klines || klines.length < period) {
            return currentPrice; // Not enough data, return current price
          }

          // Filter out invalid data points first
          const validKlines = klines.filter((kline) => {
            const close = parseFloat(kline[4] as string);
            return !isNaN(close) && close > 0 && isFinite(close);
          });

          if (validKlines.length < period) {
            return currentPrice; // Not enough valid data
          }

          // Start with the first close price as initial EMA value
          let ema = parseFloat(validKlines[0][4] as string);

          // Calculate EMA directly for all remaining periods
          // Using all available historical data provides more accurate EMA calculation
          const k = 2 / (period + 1);
          for (let i = 1; i < validKlines.length; i++) {
            const close = parseFloat(validKlines[i][4] as string);
            ema = (close * k) + (ema * (1 - k));
          }

          // Validate the final EMA value
          if (isNaN(ema) || ema <= 0 || !isFinite(ema)) {
            return currentPrice;
          }

          return ema;
        };

        // Calculate EMA 200 for 4H and 1D timeframes
        // Use valid 4H klines if available, otherwise fall back to currentPrice
        let ema2004h = currentPrice;
        let priceFor4hDistance = currentPrice; // Use current price as default
        
        if (hasValidKlines4h && klines4h.length >= 200) {
          try {
            ema2004h = calculateEMA(klines4h, 200);
            // Use the most recent 4H close price for distance calculation (more accurate for 4H timeframe)
            const last4hClose = parseFloat(klines4h[klines4h.length - 1][4] as string);
            if (!isNaN(last4hClose) && last4hClose > 0) {
              priceFor4hDistance = last4hClose;
            }
          } catch (error) {
            console.warn(`Error calculating 4H EMA for ${symbol}:`, error);
            ema2004h = currentPrice;
          }
        }
        
        let ema2001d = currentPrice;
        let priceFor1dDistance = currentPrice; // Use current price as default
        try {
          ema2001d = calculateEMA(klines, 200);
          // Use the most recent daily close price for distance calculation (more accurate for 1D timeframe)
          const last1dClose = parseFloat(klines[klines.length - 1][4] as string);
          if (!isNaN(last1dClose) && last1dClose > 0) {
            priceFor1dDistance = last1dClose;
          }
        } catch (error) {
          console.warn(`Error calculating 1D EMA for ${symbol}:`, error);
          ema2001d = currentPrice;
        }

        // Calculate distance from the appropriate price (4H close for 4H EMA, 1D close for 1D EMA)
        const ema200Distance4h = ema2004h > 0 ? ((priceFor4hDistance - ema2004h) / ema2004h) * 100 : 0;
        const ema200Distance1d = ema2001d > 0 ? ((priceFor1dDistance - ema2001d) / ema2001d) * 100 : 0;

        // Calculate z-score based on historical daily returns (last 30 days)
        // Z = (current return - mean of historical returns) / standard deviation of historical returns
        let zScore: number | undefined = undefined;
        if (klines.length >= 31) {
          // Calculate daily returns for the last 30 days from historical candles
          // Daily return = (close[today] - close[yesterday]) / close[yesterday] * 100
          const historicalReturns: number[] = [];
          
          // Get the last 31 candles (need 31 to calculate 30 daily returns)
          const recentKlines = klines.slice(-31);
          
          // Calculate 30 historical daily returns (day-to-day changes)
          for (let i = 1; i < recentKlines.length; i++) {
            const prevClose = parseFloat(recentKlines[i - 1][4] as string);
            const currClose = parseFloat(recentKlines[i][4] as string);
            
            if (prevClose > 0 && currClose > 0 && !isNaN(prevClose) && !isNaN(currClose)) {
              const dailyReturn = ((currClose - prevClose) / prevClose) * 100;
              historicalReturns.push(dailyReturn);
            }
          }
          
          // Need at least 30 days of historical data to calculate meaningful z-score
          if (historicalReturns.length >= 30) {
            // Calculate mean (μ) of historical returns
            const mean = historicalReturns.reduce((sum, val) => sum + val, 0) / historicalReturns.length;
            
            // Calculate standard deviation (σ) of historical returns
            const variance = historicalReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalReturns.length;
            const stdDev = Math.sqrt(variance);
            
            // Calculate today's return using currentPrice vs last candle's close
            const lastCandleClose = parseFloat(klines[klines.length - 1][4] as string);
            const todayReturn = lastCandleClose > 0 ? ((currentPrice - lastCandleClose) / lastCandleClose) * 100 : dailyReturn;
            
            // Calculate z-score: Z = (mean - today's return) / stdDev
            // Inverted so high z-score = underperforming (downtrend, potential buy opportunity)
            // and low z-score = overperforming (uptrend, potentially overbought)
            if (stdDev > 0 && !isNaN(mean) && !isNaN(stdDev) && !isNaN(todayReturn)) {
              zScore = (mean - todayReturn) / stdDev;
            }
          }
        }

        // Fetch Open Interest data (non-blocking - fetch in parallel with other operations)
        // OI data is optional, so we don't block the main data flow
        let oiChange24h: number | undefined = undefined;
        let oiChange7d: number | undefined = undefined;

        // Fetch OI data with shorter timeout and less aggressive retries since it's optional
        try {
          let currentOIResponse: any = null;
          try {
            currentOIResponse = await retryWithBackoff(
              async () => {
                return await axios.get<BinanceOpenInterest>(
                  `https://fapi.binance.com/fapi/v1/openInterest`,
                  {
                    params: { symbol },
                    timeout: 3000, // Reduced timeout since it's optional
                  }
                );
              },
              2, // Only 2 retries for optional data
              500 // Shorter base delay
            );
            
            if (!currentOIResponse) {
              oiChange24h = undefined;
              oiChange7d = undefined;
              currentOIResponse = null;
            }
          } catch (error: any) {
            // Silently skip OI data if it fails - it's optional
            if (error?.response?.status === 429) {
              // Don't log every rate limit for OI to reduce console noise
            }
            oiChange24h = undefined;
            oiChange7d = undefined;
            currentOIResponse = null;
          }
          
          // Only process OI if we successfully fetched currentOI
          if (currentOIResponse) {
            const currentOI = parseFloat(currentOIResponse.data.openInterest);

            if (currentOI > 0 && !isNaN(currentOI)) {
            // Calculate timestamps for 24h and 7d ago
            const now = Date.now();
            const timestamp24hAgo = now - 24 * 60 * 60 * 1000;
            const timestamp7dAgo = now - 7 * 24 * 60 * 60 * 1000;

            // Fetch historical Open Interest data
            // Try multiple endpoint formats and periods to find what works
            try {
              let oiHistory: BinanceOpenInterestHist[] | null = null;
            
            // Try to fetch historical OI data
            // The endpoint format: https://fapi.binance.com/futures/data/openInterestHist
            // Note: This endpoint might require specific parameters or might not be publicly accessible
            const endpoints = [
              { period: '1h', limit: 200 },
              { period: '5m', limit: 300 },
              { period: '1d', limit: 10 },
            ];

            for (const endpoint of endpoints) {
              try {
                const oiHistResponse = await retryWithBackoff(async () => {
                  return await axios.get<any>(
                    `https://fapi.binance.com/futures/data/openInterestHist`,
                    {
                      params: {
                        symbol,
                        period: endpoint.period,
                        limit: endpoint.limit,
                      },
                      timeout: 5000,
                      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
                    }
                  );
                });
                
                if (!oiHistResponse) {
                  continue; // Try next endpoint
                }
                
                // Check if response is valid
                if (oiHistResponse && oiHistResponse.status === 200 && oiHistResponse.data) {
                  // Handle both array and object responses
                  const data = Array.isArray(oiHistResponse.data) 
                    ? oiHistResponse.data 
                    : (oiHistResponse.data.data || oiHistResponse.data.result || []);
                  
                  if (Array.isArray(data) && data.length > 0) {
                    oiHistory = data as BinanceOpenInterestHist[];
                    break; // Success, use this data
                  }
                }
              } catch (err: any) {
                // Log error for first symbol only to avoid spam
                if (symbol === 'BTCUSDT' && endpoint.period === '1h') {
                  const errorMsg = err?.response?.data?.msg || err?.response?.data || err?.message;
                  console.warn(`OI history endpoint test for ${symbol} (${endpoint.period}):`, errorMsg);
                }
                // Try next endpoint
                continue;
              }
            }

            if (oiHistory && Array.isArray(oiHistory) && oiHistory.length > 0) {
                // Data is returned in reverse chronological order (newest first, index 0 is most recent)
                // For 5m intervals: 24h = 288 intervals, 7d = 2016 intervals
                const intervals24h = Math.floor((24 * 60) / 5); // 288
                const intervals7d = Math.floor((7 * 24 * 60) / 5); // 2016

                let oi24hAgo: number | null = null;
                let oi7dAgo: number | null = null;

                // Get OI from 24h ago
                if (oiHistory.length > intervals24h && oiHistory[intervals24h]) {
                  const oiValue = parseFloat(oiHistory[intervals24h].sumOpenInterest);
                  if (!isNaN(oiValue) && oiValue > 0) {
                    oi24hAgo = oiValue;
                  }
                }

                // Get OI from 7d ago
                if (oiHistory.length > intervals7d && oiHistory[intervals7d]) {
                  const oiValue = parseFloat(oiHistory[intervals7d].sumOpenInterest);
                  if (!isNaN(oiValue) && oiValue > 0) {
                    oi7dAgo = oiValue;
                  }
                }

                // If we don't have enough 5m data, try to find closest timestamps
                if ((oi24hAgo === null || oi7dAgo === null) && oiHistory.length > 0) {
                  for (let i = 0; i < oiHistory.length; i++) {
                    const entry = oiHistory[i];
                    if (entry && entry.timestamp) {
                      const entryTime = entry.timestamp;
                      const diff24h = Math.abs(entryTime - timestamp24hAgo);
                      const diff7d = Math.abs(entryTime - timestamp7dAgo);

                      // Find closest to 24h ago (within 2 hours)
                      if (oi24hAgo === null && diff24h < 2 * 60 * 60 * 1000) {
                        const oiValue = parseFloat(entry.sumOpenInterest);
                        if (!isNaN(oiValue) && oiValue > 0) {
                          oi24hAgo = oiValue;
                        }
                      }

                      // Find closest to 7d ago (within 12 hours)
                      if (oi7dAgo === null && diff7d < 12 * 60 * 60 * 1000) {
                        const oiValue = parseFloat(entry.sumOpenInterest);
                        if (!isNaN(oiValue) && oiValue > 0) {
                          oi7dAgo = oiValue;
                        }
                      }
                    }
                  }
                }

                // Calculate percentage changes
                if (oi24hAgo !== null && oi24hAgo > 0) {
                  oiChange24h = ((currentOI - oi24hAgo) / oi24hAgo) * 100;
                }

                if (oi7dAgo !== null && oi7dAgo > 0) {
                  oiChange7d = ((currentOI - oi7dAgo) / oi7dAgo) * 100;
                }
              }
            } catch (histError: any) {
              // Log the actual error for debugging
              const errorMsg = histError?.response?.data?.msg || histError?.response?.data || histError?.message || 'Unknown error';
              if (symbol === 'BTCUSDT') {
                // Only log for BTCUSDT to avoid spam, but this helps debug
                console.warn(`Failed to fetch OI history for ${symbol}:`, errorMsg);
                if (histError?.response?.status) {
                  console.warn(`HTTP Status: ${histError.response.status}`);
                }
              }
              
              // The endpoint might not be available or might require different parameters
              // We'll leave the values as undefined (N/A will be shown)
            }
          }
        }
        } catch (error: any) {
          // If current OI fetch fails, log it but don't fail the entire request
          const errorMsg = error?.response?.data?.msg || error?.message || 'Unknown error';
          console.warn(`Failed to fetch current OI for ${symbol}:`, errorMsg);
        }

        // Filter out coins with suspicious data (likely delisted)
        // Check if we have meaningful volume (at least $10,000 in 24h volume)
        // This helps filter out delisted coins that may still appear in ticker but have no real trading
        const hasMinVolume = volume >= 10000;

        // Also validate that we have recent price data (check if yesterday's close exists and is valid)
        const yesterdayClose = klines.length >= 2 ? parseFloat(klines[klines.length - 2][4] as string) : null;
        const hasRecentData = yesterdayClose !== null && yesterdayClose > 0 && !isNaN(yesterdayClose);

        if (!hasMinVolume || !hasRecentData) {
          return null;
        }

        return {
          symbol,
          currentPrice,
          dailyReturn,
          weeklyReturn,
          monthlyReturn,
          volume,
          vwap7d: vwap7d.vwap,
          vwapDistance7d: vwap7d.distance,
          vwap30d: vwap30d.vwap,
          vwapDistance30d: vwap30d.distance,
          vwap90d: vwap90d.vwap,
          vwapDistance90d: vwap90d.distance,
          vwap365d: vwap365d.vwap,
          vwapDistance365d: vwap365d.distance,
          ema2004h,
          ema200Distance4h,
          ema2001d,
          ema200Distance1d,
          zScore,
          oiChange24h,
          oiChange7d,
        };
      } catch (error) {
        console.error(`Error fetching data for ${ticker.symbol}:`, error);
        return null;
      }
      });
      
      // Wait for batch to complete - use allSettled to handle individual failures gracefully
      const batchResults = await Promise.allSettled(batchPromises);
      const successfulResults = batchResults
        .filter((result): result is PromiseFulfilledResult<CryptoData | null> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);
      
      cryptoDataResults.push(...successfulResults);
      
      // Minimal delay between batches to avoid overwhelming the API
      if (i + BATCH_SIZE < usdtPairs.length) {
        await delay(BATCH_DELAY);
      }
    }

    const cryptoData = cryptoDataResults.filter(
      (data): data is CryptoData => data !== null
    );

    // Sort by volume (already sorted, but ensure it)
    cryptoData.sort((a, b) => b.volume - a.volume);

    if (cryptoData.length === 0) {
      console.error('No crypto data returned after processing');
      res.status(500).json({ error: 'No data available after processing. This may be due to API rate limits or data validation issues.' });
      return;
    }

    // Update cache
    cache.set(cacheKey, {
      data: cryptoData,
      timestamp: Date.now(),
    });

    res.status(200).json(cryptoData);
  } catch (error: any) {
    console.error('Error fetching crypto data:', error);
    
    // Handle rate limit errors specifically
    if (error?.response?.status === 429) {
      const rateLimitMsg = error?.response?.data?.msg || 'Too many requests';
      res.status(429).json({ 
        error: `${rateLimitMsg}. The app uses WebSocket for live price updates to minimize API calls. Please wait a moment before refreshing.` 
      });
      return;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch crypto data: ${errorMessage}` });
  }
}

