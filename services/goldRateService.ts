
import { errorService } from './errorService';

export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
  source?: string;
}

const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || ((import.meta as any).env.DEV ? 'http://localhost:3000' : '');

export const goldRateService = {
  async fetchLiveRate(forceRefresh: boolean = false): Promise<GoldRateResponse> {
    // 1. Check Cache
    if (!forceRefresh) {
        try {
          const cached = localStorage.getItem('aura_gold_rate_cache');
          if (cached) {
              const { rate24K, rate22K, timestamp } = JSON.parse(cached);
              if (Date.now() - timestamp < 900000) { // 15 mins cache
                  return { rate24K, rate22K, success: true, source: "Local Cache" };
              }
          }
        } catch(e) { console.warn("Cache error", e); }
    }

    // 2. Try Node.js Backend API
    try {
        const response = await fetch(`${API_BASE}/api/rates`);
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.updateCache(result.rate24K, result.rate22K);
                errorService.logActivity('STATUS_UPDATE', `Gold Rate Synced (Backend): ₹${result.rate24K}/g`);
                return { rate24K: result.rate24K, rate22K: result.rate22K, success: true, source: "Backend API" };
            }
        }
    } catch (e) {
        console.warn("Backend rate fetch failed, trying fallback...");
    }

    // 3. Fallback: Client-Side Proxy (AllOrigins)
    // This scrapes a public gold rate site securely if the backend is down
    try {
        // Using a reliable public source via AllOrigins to bypass CORS
        const targetUrl = encodeURIComponent('https://www.goodreturns.in/gold-rates/');
        const proxyRes = await fetch(`https://api.allorigins.win/get?url=${targetUrl}`);
        const proxyData = await proxyRes.json();
        
        if (proxyData.contents) {
            // Simple regex to extract 24k price from HTML (Approximation for fallback)
            // Looking for common patterns like "₹ 7,250"
            const match = proxyData.contents.match(/24\s*Carat\s*Gold.*?>\s*₹\s*([\d,]+)/i);
            if (match && match[1]) {
                const rate24K = parseFloat(match[1].replace(/,/g, '')) / 10; // usually per 10g, convert to 1g
                const rate22K = Math.round(rate24K * 0.916);
                
                this.updateCache(rate24K, rate22K);
                errorService.logActivity('STATUS_UPDATE', `Gold Rate Synced (Web): ₹${rate24K}/g`);
                return { rate24K, rate22K, success: true, source: "Web Proxy Fallback" };
            }
        }
    } catch (e) {
        console.error("All rate fetch methods failed", e);
    }

    // 4. Return Stale Cache or Failure
    try {
        const stale = localStorage.getItem('aura_gold_rate_cache');
        if (stale) {
            const { rate24K, rate22K } = JSON.parse(stale);
            return { rate24K, rate22K, success: true, source: "Stale Cache (Offline)" };
        }
    } catch(err) {}

    return { rate24K: 0, rate22K: 0, success: false, error: "Unable to fetch rates" };
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
