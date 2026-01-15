
export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
}

export const goldRateService = {
  /**
   * Fetches the live gold rate from the unified backend API.
   * Uses an absolute path starting with / to avoid sub-route 404s.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    try {
        const origin = window.location.origin;
        const apiUrl = `${origin}/api/gold-rate`;
        
        console.log("[GoldRateService] Fetching from:", apiUrl);
        
        const response = await fetch(apiUrl, {
          headers: { 
            'Accept': 'application/json',
            'Cache-Control': 'no-cache' 
          }
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText || 'Not Found'}`);
        }
        
        const data = await response.json();
        return {
            rate24K: data.k24 || 0,
            rate22K: data.k22 || 0,
            success: true
        };
    } catch (e: any) {
        console.error("[GoldRateService] Fetch Error:", e.message);
        return { 
            rate24K: 0, 
            rate22K: 0, 
            success: false, 
            error: e.message 
        };
    }
  }
};
