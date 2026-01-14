
export interface GoldRateResponse {
  rate24K: number;
  rate22K: number;
  success: boolean;
  error?: string;
}

export const goldRateService = {
  /**
   * Fetches the live gold rate from the application's own backend.
   * This is the authoritative source for real-world transactions.
   */
  async fetchLiveRate(): Promise<GoldRateResponse> {
    try {
        const response = await fetch('/api/gold-rate');
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Rate service unavailable");
        }
        
        const data = await response.json();
        return {
            rate24K: data.k24,
            rate22K: data.k22,
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
