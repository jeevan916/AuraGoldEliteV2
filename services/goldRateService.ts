
export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
}

export const goldRateService = {
  /**
   * Fetches the live gold rate from the local API.
   * Uses relative pathing to ensure the request is routed through the Hostinger Node proxy correctly.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    try {
        const response = await fetch('/api/gold-rate', {
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            throw new Error(`Rate service returned ${response.status}`);
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
