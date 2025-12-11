import { useMemo } from 'react';
import styles from '../styles/StrengthCharts.module.css';
import { useTheme } from '../hooks/useTheme';

interface MetricData {
  label: string;
  score: number;
  max: number;
  percentage: number;
}

interface CoinData {
  symbol: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
}

interface StrengthChartsProps {
  metrics: {
    daily: { score: number; max: number };
    weekly: { score: number; max: number };
    monthly: { score: number; max: number };
    vwap30: { score: number; max: number };
    ema1d: { score: number; max: number };
    zScore: { score: number; max: number };
    oi: { score: number; max: number };
  };
  coins: Array<{
    symbol: string;
    totalScore: number;
    maxScore: number;
  }>;
}

export default function StrengthCharts({ metrics, coins }: StrengthChartsProps) {
  const { themes, theme } = useTheme();
  const themeColors = themes[theme].colors;

  const metricsData: MetricData[] = useMemo(() => {
    return [
      { label: 'Daily Return', score: metrics.daily.score, max: metrics.daily.max, percentage: metrics.daily.max > 0 ? (metrics.daily.score / metrics.daily.max) * 100 : 0 },
      { label: 'Weekly Return', score: metrics.weekly.score, max: metrics.weekly.max, percentage: metrics.weekly.max > 0 ? (metrics.weekly.score / metrics.weekly.max) * 100 : 0 },
      { label: 'Monthly Return', score: metrics.monthly.score, max: metrics.monthly.max, percentage: metrics.monthly.max > 0 ? (metrics.monthly.score / metrics.monthly.max) * 100 : 0 },
      { label: 'VWAP 30D', score: metrics.vwap30.score, max: metrics.vwap30.max, percentage: metrics.vwap30.max > 0 ? (metrics.vwap30.score / metrics.vwap30.max) * 100 : 0 },
      { label: 'EMA 200 1D', score: metrics.ema1d.score, max: metrics.ema1d.max, percentage: metrics.ema1d.max > 0 ? (metrics.ema1d.score / metrics.ema1d.max) * 100 : 0 },
      { label: 'Z-Score', score: metrics.zScore.score, max: metrics.zScore.max, percentage: metrics.zScore.max > 0 ? (metrics.zScore.score / metrics.zScore.max) * 100 : 0 },
      { label: 'Open Interest', score: metrics.oi.score, max: metrics.oi.max, percentage: metrics.oi.max > 0 ? (metrics.oi.score / metrics.oi.max) * 100 : 0 },
    ];
  }, [metrics]);

  const coinsData: CoinData[] = useMemo(() => {
    return coins
      .map(coin => ({
        symbol: coin.symbol.replace('USDT', ''),
        totalScore: coin.totalScore,
        maxScore: coin.maxScore,
        percentage: coin.maxScore > 0 ? (coin.totalScore / coin.maxScore) * 100 : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [coins]);

  const getColor = (percentage: number): string => {
    if (percentage >= 70) return themeColors.positive;
    if (percentage >= 50) return '#ffff88';
    if (percentage >= 30) return themeColors.negativeLight;
    return themeColors.negative;
  };

  const chartWidth = 500;
  const chartHeight = metricsData.length * 45 + 40;
  const barHeight = 28;
  const spacing = 45;
  const barStartX = 140;
  const barMaxWidth = chartWidth - barStartX - 100;

  return (
    <div className={styles.chartsContainer}>
      <div className={styles.chartSection}>
        <h3 className={styles.chartTitle}>Metrics Performance</h3>
        <svg width={chartWidth} height={chartHeight} className={styles.chart}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const x = barStartX + (percent / 100) * barMaxWidth;
            return (
              <line
                key={percent}
                x1={x}
                y1={10}
                x2={x}
                y2={chartHeight - 10}
                stroke={themeColors.borderSecondary}
                strokeWidth={1}
                strokeDasharray={percent === 50 ? "0" : "2,2"}
              />
            );
          })}
          
          {metricsData.map((metric, index) => {
            const y = index * spacing + 30;
            const barWidth = (metric.percentage / 100) * barMaxWidth;
            const color = getColor(metric.percentage);

            return (
              <g key={metric.label}>
                <text
                  x={0}
                  y={y + barHeight / 2}
                  className={styles.chartLabel}
                  dominantBaseline="middle"
                >
                  {metric.label}
                </text>
                <rect
                  x={barStartX}
                  y={y}
                  width={barMaxWidth}
                  height={barHeight}
                  fill={themeColors.bgPrimary}
                  stroke={themeColors.borderPrimary}
                  strokeWidth={1}
                  rx={3}
                />
                <rect
                  x={barStartX}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={3}
                  className={styles.bar}
                />
                {barWidth > 5 && (
                  <text
                    x={barStartX + barWidth - 6}
                    y={y + barHeight / 2}
                    className={styles.barText}
                    dominantBaseline="middle"
                    textAnchor="end"
                  >
                    {metric.score.toFixed(1)}/{metric.max}
                  </text>
                )}
                <text
                  x={chartWidth - 10}
                  y={y + barHeight / 2}
                  className={styles.chartValue}
                  dominantBaseline="middle"
                  textAnchor="end"
                >
                  {metric.percentage.toFixed(0)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={styles.chartSection}>
        <h3 className={styles.chartTitle}>Coin Contributions</h3>
        <svg width={chartWidth} height={coinsData.length * 35 + 40} className={styles.chart}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const x = barStartX + (percent / 100) * barMaxWidth;
            return (
              <line
                key={percent}
                x1={x}
                y1={10}
                x2={x}
                y2={coinsData.length * 35 + 20}
                stroke={themeColors.borderSecondary}
                strokeWidth={1}
                strokeDasharray={percent === 50 ? "0" : "2,2"}
              />
            );
          })}
          
          {coinsData.map((coin, index) => {
            const y = index * 35 + 30;
            const barWidth = (coin.percentage / 100) * barMaxWidth;
            const color = getColor(coin.percentage);

            return (
              <g key={coin.symbol}>
                <text
                  x={0}
                  y={y + 14}
                  className={styles.coinLabel}
                  dominantBaseline="middle"
                >
                  {coin.symbol}
                </text>
                <rect
                  x={barStartX}
                  y={y}
                  width={barMaxWidth}
                  height={22}
                  fill={themeColors.bgPrimary}
                  stroke={themeColors.borderPrimary}
                  strokeWidth={1}
                  rx={3}
                />
                <rect
                  x={barStartX}
                  y={y}
                  width={barWidth}
                  height={22}
                  fill={color}
                  rx={3}
                  className={styles.bar}
                />
                {barWidth > 5 && (
                  <text
                    x={barStartX + barWidth - 6}
                    y={y + 11}
                    className={styles.barText}
                    dominantBaseline="middle"
                    textAnchor="end"
                  >
                    {coin.totalScore.toFixed(1)}/{coin.maxScore}
                  </text>
                )}
                <text
                  x={chartWidth - 10}
                  y={y + 11}
                  className={styles.chartValue}
                  dominantBaseline="middle"
                  textAnchor="end"
                >
                  {coin.percentage.toFixed(0)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

