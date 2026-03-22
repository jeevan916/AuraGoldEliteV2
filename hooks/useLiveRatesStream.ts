import { useState, useEffect } from 'react';

export interface RateItem {
  id: string;
  name: string;
  bid: number;
  ask: number;
  high: number;
  low: number;
  weight: number;
  type: 'gold' | 'silver';
}

export interface RatesPayload {
  goldRates: RateItem[];
  silverRates: RateItem[];
  timestamp: string;
}

export function useLiveRatesREST() {
  const [rates, setRates] = useState<RatesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. URL of your Server App
    const SERVER_URL = 'https://ais-pre-ice2ajrh2zzfnkdkshrpx3-8038997919.asia-southeast1.run.app'; 
    
    const fetchRates = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/rates`);
        if (!response.ok) throw new Error('Failed to fetch rates');
        
        const data: RatesPayload = await response.json();
        setRates(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchRates();
    
    // Poll every 2 seconds
    const interval = setInterval(fetchRates, 2000);

    return () => clearInterval(interval);
  }, []);

  return { rates, loading, error };
}
