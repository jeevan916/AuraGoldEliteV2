
export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
  source?: string;
}

export const goldRateService = {
  /**
   * Fetches the live gold rate.
   * The backend (/api/gold-rate) now proxies the request to Augmont UAT 
   * and falls back to the database if the external API is down.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    try {
        const apiUrl = `/api/gold-rate`;
        
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
        
        if (data.source) {
            console.log(`[GoldRateService] Rate Source: ${data.source}`);
        }

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
