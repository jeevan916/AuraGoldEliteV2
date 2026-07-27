
export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  rate18K: number;
  silver: number;
  success: boolean;
  error?: string;
  source?: string;
  raw?: any;
}

const getApiBase = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
      return (import.meta as any).env.VITE_API_BASE_URL;
    }
    if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
      return process.env.VITE_API_BASE_URL;
    }
  } catch (e) {}
  return '';
};

export const goldRateService = {
  /**
   * Fetches the live gold rate from the backend proxy with automatic local fallback.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    const apiBase = getApiBase();
    try {
        const apiUrl = `${apiBase}/api/gold-rate`;
        
        const response = await fetch(apiUrl, {
          headers: { 
            'Accept': 'application/json',
            'Cache-Control': 'no-cache' 
          }
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText || 'Service Unavailable'}`);
        }
        
        const data = await response.json();
        
        if (data && (data.k24 || data.k22)) {
            return {
                rate24K: data.k24 || 0,
                rate22K: data.k22 || 0,
                rate18K: data.k18 || 0,
                silver: data.silver || 0,
                success: data.success ?? true,
                source: data.source || 'Live Feed',
                raw: data.raw
            };
        }
        throw new Error('Invalid rate payload from server');
    } catch (e: any) {
        console.warn("[GoldRateService] Fetch Warning (Using Fallback):", e.message);

        // Fallback: Read cached settings from local storage or app state
        try {
            const savedState = localStorage.getItem('aura_gold_app_state');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                if (parsed.settings && (parsed.settings.currentGoldRate24K || parsed.settings.currentGoldRate22K)) {
                    return {
                        rate24K: parsed.settings.currentGoldRate24K || 7200,
                        rate22K: parsed.settings.currentGoldRate22K || 6600,
                        rate18K: parsed.settings.currentGoldRate18K || 5400,
                        silver: parsed.settings.currentSilverRate || 90,
                        success: true,
                        source: 'Local Cache (Fallback)',
                        error: e.message
                    };
                }
            }
        } catch (err) {}

        // Ultimate Default Fallback
        return { 
            rate24K: 7200, 
            rate22K: 6600, 
            rate18K: 5400,
            silver: 90,
            success: true, 
            source: 'System Default (Fallback)',
            error: e.message 
        };
    }
  }
};
