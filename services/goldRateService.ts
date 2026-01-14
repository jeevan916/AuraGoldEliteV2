
import { errorService } from './errorService';
import { storageService } from './storageService';

export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
  source?: string;
}

export const goldRateService = {
  async fetchLiveRate(forceRefresh: boolean = false): Promise<GoldRateResponse> {
    // 1. Check if we have an existing fresh rate in session memory (10 mins)
    const cachedRate = localStorage.getItem('aura_live_rate_active');
    if (!forceRefresh && cachedRate) {
        const parsed = JSON.parse(cachedRate);
        if (Date.now() - parsed.timestamp < 600000) {
            return { ...parsed, success: true, source: "Session Cache" };
        }
    }

    // 2. Production Scraper via Proxy
    try {
        const targetUrl = encodeURIComponent('https://www.goodreturns.in/gold-rates/');
        const proxyUrl = `https://api.allorigins.win/get?url=${targetUrl}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Market data gateway unreachable.");
        
        const data = await response.json();
        
        if (data.contents) {
            const match = data.contents.match(/24\s*Carat\s*Gold.*?>\s*₹\s*([\d,]+)/i);
            
            if (match && match[1]) {
                const rate10g = parseFloat(match[1].replace(/,/g, ''));
                const rate24K = Math.round(rate10g / 10);
                const rate22K = Math.round(rate24K * 0.916);
                
                const result = { rate24K, rate22K, timestamp: Date.now() };
                localStorage.setItem('aura_live_rate_active', JSON.stringify(result));
                
                return { ...result, success: true, source: "Live Market" };
            }
        }
    } catch (e) {
        console.error("Gold rate fetch failed:", (e as Error).message);
    }

    // 3. Fallback to Last Known Price in Settings (No hardcoded demo numbers)
    const settings = storageService.getSettings();
    if (settings.currentGoldRate24K > 0) {
        return { 
            rate24K: settings.currentGoldRate24K, 
            rate22K: settings.currentGoldRate22K, 
            success: true, 
            source: "Stored Business Rate" 
        };
    }

    return { rate24K: 0, rate22K: 0, success: false, error: "Market rate service unavailable." };
  }
};
