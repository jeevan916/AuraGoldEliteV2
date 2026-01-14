
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
    // 1. Check Cache (valid for 15 mins for active pricing)
    if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('aura_gold_rate_cache');
          if (cached) {
              const { rate24K, rate22K, timestamp } = JSON.parse(cached);
              if (Date.now() - timestamp < 900000) { // 15 mins
                  return { rate24K, rate22K, success: true, source: "Local Cache" };
              }
          }
        } catch(e) { console.warn("Cache error", e); }
    }

    try {
        // Use our Express proxy endpoint
        const response = await fetch('/api/rates');
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Backend rate fetch failed");
        }

        // Cache Success
        try {
            localStorage.setItem('aura_gold_rate_cache', JSON.stringify({ 
                rate24K: result.rate24K, 
                rate22K: result.rate22K, 
                timestamp: Date.now() 
            }));
        } catch (e) { /* Ignore storage errors */ }

        errorService.logActivity('STATUS_UPDATE', `Gold Rate Synced: ₹${result.rate24K}/g via Node Proxy`);
        return { 
            rate24K: result.rate24K, 
            rate22K: result.rate22K, 
            success: true, 
            source: "Node Proxy" 
        };

    } catch (e: any) {
        console.warn(`Gold Rate Sync Failed:`, e.message);
        
        // Fallback to stale cache
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
