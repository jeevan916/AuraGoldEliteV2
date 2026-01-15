
export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
  source?: string;
}

export const goldRateService = {
  /**
   * Fetches the live gold rate from the backend database.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    try {
        const origin = window.location.origin;
        // Use relative path to work in both dev (proxy) and prod
        const apiUrl = `/api/gold-rate`;
        
        console.log("[GoldRateService] Fetching from DB:", apiUrl);
        
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
            success: true,
            source: data.source
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
