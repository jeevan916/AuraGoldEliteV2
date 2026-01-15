export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
}

export const goldRateService = {
  /**
   * Fetches the live gold rate from the unified backend API.
   * Uses a relative path to ensure origin-matching on Hostinger Node.js proxy.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    try {
        console.log("[GoldRateService] Fetching from /api/gold-rate");
        // Using a strictly relative URL to ensure it hits the current domain/port
        const response = await fetch('/api/gold-rate', {
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
