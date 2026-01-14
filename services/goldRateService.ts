
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
    // 1. Check Cache (15 minutes)
    if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('aura_gold_rate_cache');
          if (cached) {
              const { rate24K, rate22K, timestamp } = JSON.parse(cached);
              if (Date.now() - timestamp < 900000) { 
                  return { rate24K, rate22K, success: true, source: "Cache" };
              }
          }
        } catch(e) { console.warn("Cache error", e); }
    }

    // 2. Fetch from Public Web via Proxy
    // We scrape a reliable public source (GoodReturns) using AllOrigins to bypass CORS.
    // This allows the browser to get data without a backend server or environment variables.
    try {
        const targetUrl = encodeURIComponent('https://www.goodreturns.in/gold-rates/');
        const proxyUrl = `https://api.allorigins.win/get?url=${targetUrl}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Proxy response failed");
        
        const data = await response.json();
        
        if (data.contents) {
            // Regex to find 24K Gold Rate in the HTML
            // Matches patterns like: "24 Carat Gold" followed eventually by "₹ 7,250"
            const match = data.contents.match(/24\s*Carat\s*Gold.*?>\s*₹\s*([\d,]+)/i);
            
            if (match && match[1]) {
                const rate10g = parseFloat(match[1].replace(/,/g, ''));
                const rate24K = rate10g / 10; // Convert 10g price to 1g
                const rate22K = Math.round(rate24K * 0.916); // Standard calculation
                
                this.updateCache(rate24K, rate22K);
                errorService.logActivity('STATUS_UPDATE', `Gold Rate Updated: ₹${rate24K}/g`);
                
                return { rate24K, rate22K, success: true, source: "Live Market (Proxy)" };
            }
        }
    } catch (e) {
        console.warn("Gold rate fetch failed, using fallback/cache:", (e as Error).message);
    }

    // 3. Return Stale Cache if available (Offline Mode)
    try {
        const stale = localStorage.getItem('aura_gold_rate_cache');
        if (stale) {
            const { rate24K, rate22K } = JSON.parse(stale);
            return { rate24K, rate22K, success: true, source: "Offline Cache" };
        }
    } catch(err) {}

    // 4. Hardcoded Safety Fallback if all else fails
    return { rate24K: 7500, rate22K: 6875, success: true, source: "System Default" };
  },

  updateCache(rate24K: number, rate22K: number) {
      try {
          localStorage.setItem('aura_gold_rate_cache', JSON.stringify({ 
              rate24K, 
              rate22K, 
              timestamp: Date.now() 
          }));
      } catch (e) { }
  }
};
