
export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  rate18K: number;
  success: boolean;
  error?: string;
  source?: string;
  raw?: any;
}

const API_BASE = process.env.VITE_API_BASE_URL || '';

export const goldRateService = {
  /**
   * Fetches the live gold rate from the backend proxy.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    try {
        const apiUrl = `${API_BASE}/api/gold-rate`;
        
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
        
        return {
            rate24K: data.k24 || 0,
            rate22K: data.k22 || 0,
            rate18K: data.k18 || 0,
            success: data.success,
            source: data.source,
            raw: data.raw
        };
    } catch (e: any) {
        console.error("[GoldRateService] Fetch Error:", e.message);
        return { 
            rate24K: 0, 
            rate22K: 0, 
            rate18K: 0,
            success: false, 
            error: e.message 
        };
    }
  }
};