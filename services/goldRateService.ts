
import { errorService } from './errorService';

export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
  source?: string;
}

export const goldRateService = {
  async fetchLiveRate(forceRefresh: boolean = false): Promise<GoldRateResponse> {
    if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('aura_gold_rate_cache');
          if (cached) {
              const { rate24K, rate22K, timestamp } = JSON.parse(cached);
              if (Date.now() - timestamp < 900000) { 
                  return { rate24K, rate22K, success: true, source: "Local Cache" };
              }
          }
        } catch(e) { console.warn("Cache error", e); }
    }

    try {
        // Root-relative path to the backend rate proxy
        const response = await fetch('/api/rates');
        
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Backend rate fetch failed");
        }

        try {
            localStorage.setItem('aura_gold_rate_cache', JSON.stringify({ 
                rate24K: result.rate24K, 
                rate22K: result.rate22K, 
                timestamp: Date.now() 
            }));
        } catch (e) { }

        errorService.logActivity('STATUS_UPDATE', `Gold Rate Synced: ₹${result.rate24K}/g`);
        return { 
            rate24K: result.rate24K, 
            rate22K: result.rate22K, 
            success: true, 
            source: "Backend Proxy" 
        };

    } catch (e: any) {
        console.warn(`Gold Rate Sync Failed:`, e.message);
        
        try {
            const stale = localStorage.getItem('aura_gold_rate_cache');
            if (stale) {
                const { rate24K, rate22K } = JSON.parse(stale);
                return { rate24K, rate22K, success: true, source: "Stale Cache (Offline)" };
            }
        } catch(err) {}

        return { rate24K: 0, rate22K: 0, success: false, error: `Sync Failed: ${e.message}` };
    }
  }
};
