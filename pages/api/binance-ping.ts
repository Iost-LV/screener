import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ timestamp: number; latency?: number }>
) {
  try {
    const startTime = Date.now();
    
    // Ping Binance API
    await axios.get('https://fapi.binance.com/fapi/v1/ping', {
      timeout: 5000,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    res.status(200).json({ timestamp: Date.now(), latency });
  } catch (error) {
    res.status(500).json({ timestamp: Date.now() });
  }
}

