
import { errorService } from './errorService';
import { proxyService } from './proxyService';

export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
  source?: string;
}

export const goldRateService = {
  async fetchLiveRate(forceRefresh: boolean = false): Promise<GoldRateResponse> {
    // 1. Check Cache (valid for 4 hours)
    if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('aura_gold_rate_cache');
          if (cached) {
              const { rate24K, rate22K, timestamp } = JSON.parse(cached);
              // 4 hours = 14400000 ms
              if (Date.now() - timestamp < 14400000) {
                  return { rate24K, rate22K, success: true, source: "Cache" };
              }
          }
        } catch(e) { console.warn("Cache error", e); }
    }

    // 2. Define the exact API Target
    const TARGET_URL = "https://uat.batuk.in/augmont/gold";

    try {
        // Use the centralized proxy service
        const result = await proxyService.fetchJson<any>(TARGET_URL);

        if (!result.success || !result.data) {
            throw new Error(result.error || "Proxy fetch failed");
        }

        const data = result.data;

        // 3. Parse Specific JSON Structure for Augmont
        // Expected: { data: [ [ { gSell: "13751.00", ... } ] ] }
        // We traverse data -> index 0 -> index 0 -> gSell
        const rateObj = data?.data?.[0]?.[0];
        
        // Prefer gSell, fallback to gBuy if gSell is missing
        const rawRate = rateObj?.gSell || rateObj?.gBuy;

        if (rawRate) {
            const rate24K = parseFloat(rawRate);
            
            if (isNaN(rate24K) || rate24K === 0) throw new Error("Parsed rate is 0 or NaN");

            // Standard Calculation: 22K is 91.6% of 24K
            const rate22K = Math.round(rate24K * 0.916);

            // Cache Success
            try {
                localStorage.setItem('aura_gold_rate_cache', JSON.stringify({ 
                    rate24K, rate22K, timestamp: Date.now() 
                }));
            } catch (e) { /* Ignore storage errors */ }

            errorService.logActivity('STATUS_UPDATE', `Gold Rate Synced: ₹${rate24K}/g via ${result.source}`);
            return { rate24K, rate22K, success: true, source: `Augmont (${result.source})` };
        } else {
            throw new Error("Data structure mismatch: data[0][0].gSell not found");
        }

    } catch (e: any) {
        console.warn(`Gold Rate Sync Failed:`, e.message);
        
        // 4. Fallback to stale cache if proxy fails (prevents UI white screen)
        try {
            const stale = localStorage.getItem('aura_gold_rate_cache');
            if (stale) {
                const { rate24K, rate22K } = JSON.parse(stale);
                return { rate24K, rate22K, success: true, source: "Offline Cache (Stale)" };
            }
        } catch(err) {}

        return { rate24K: 0, rate22K: 0, success: false, error: `Sync Failed: ${e.message}` };
    }
  }
};
