import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Footer.module.css';
import { useTheme } from '../hooks/useTheme';

export default function Footer() {
  const { theme, setTheme, themes } = useTheme();
  const [fps, setFps] = useState<number>(0);
  const [websitePing, setWebsitePing] = useState<number | null>(null);
  const [binancePing, setBinancePing] = useState<number | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animationFrameRef = useRef<number>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const measureFPS = () => {
      const now = performance.now();
      frameCountRef.current++;

      // Calculate FPS every second
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      // Continue the animation loop
      animationFrameRef.current = requestAnimationFrame(measureFPS);
    };

    // Start the FPS measurement loop
    animationFrameRef.current = requestAnimationFrame(measureFPS);

    // Measure ping to website server (or external server if deployed)
    const measureWebsitePing = async () => {
      return new Promise<void>((resolve) => {
        try {
          const timestamp = Date.now();
          // Use the Next.js API endpoint - on localhost this will be ~1-10ms
          // On a deployed server, this will show actual network latency
          const url = `/api/ping?t=${timestamp}`;
          
          const xhr = new XMLHttpRequest();
          const startTime = performance.now();
          
          xhr.open('GET', url, true);
          xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          xhr.setRequestHeader('Pragma', 'no-cache');
          xhr.setRequestHeader('Expires', '0');
          
          xhr.timeout = 5000;
          
          xhr.onload = () => {
            if (xhr.status === 200) {
              const totalTime = performance.now() - startTime;
              setWebsitePing(Math.round(totalTime));
            } else {
              setWebsitePing(null);
            }
            resolve();
          };
          
          xhr.onerror = () => {
            setWebsitePing(null);
            resolve();
          };
          
          xhr.ontimeout = () => {
            setWebsitePing(null);
            resolve();
          };
          
          xhr.send();
        } catch (error) {
          setWebsitePing(null);
          resolve();
        }
      });
    };

    // Measure ping to Binance (via Next.js API to avoid CORS)
    const measureBinancePing = async () => {
      try {
        const timestamp = Date.now();
        const startTime = performance.now();
        
        const response = await fetch(`/api/binance-ping?t=${timestamp}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
        
        const endTime = performance.now();
        
        if (response.ok) {
          const data = await response.json();
          // Use server-reported latency if available, otherwise use client-side measurement
          if (data.latency !== undefined) {
            setBinancePing(data.latency);
          } else {
            // Fallback: measure round-trip time (includes server processing)
            // Subtract estimated server processing time (~10-20ms)
            const rtt = endTime - startTime;
            const estimatedServerOverhead = 15;
            const networkLatency = Math.max(0, rtt - estimatedServerOverhead);
            setBinancePing(Math.round(networkLatency));
          }
        } else {
          setBinancePing(null);
        }
      } catch (error) {
        setBinancePing(null);
      }
    };

    // Measure both pings
    const measurePings = async () => {
      await Promise.all([measureWebsitePing(), measureBinancePing()]);
    };

    // Measure pings immediately, then every 5 seconds
    measurePings();
    pingIntervalRef.current = setInterval(measurePings, 5000);

    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={styles.footerLeft}>
        <span className={styles.fpsLabel}>FPS:</span>
        <span className={styles.fpsValue}>{fps}</span>
        <span className={styles.separator}>|</span>
        <span className={styles.pingLabel}>Website:</span>
        <span className={styles.pingValue}>
          {websitePing !== null ? `${websitePing}ms` : 'N/A'}
        </span>
        <span className={styles.separator}>|</span>
        <span className={styles.pingLabel}>Binance:</span>
        <span className={styles.pingValue}>
          {binancePing !== null ? `${binancePing}ms` : 'N/A'}
        </span>
      </div>
      <div className={styles.footerRight}>
        <div className={styles.themeSelector}>
          {Object.values(themes).map((themeOption) => {
            const isActive = theme === themeOption.name;
            return (
              <button
                key={themeOption.name}
                className={`${styles.themeButton} ${isActive ? styles.themeButtonActive : ''}`}
                onClick={() => {
                  setTheme(themeOption.name);
                }}
                title={themeOption.displayName}
              >
                {themeOption.displayName}
              </button>
            );
          })}
        </div>
      </div>
    </footer>
  );
}

