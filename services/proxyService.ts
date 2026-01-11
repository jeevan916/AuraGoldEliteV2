
import { errorService } from './errorService';

export interface ProxyResult<T = string> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
}

/**
 * Service to bypass CORS restrictions using AllOrigins and other proxies.
 * Corresponds to the requested component functionality from https://github.com/gnuns/allOrigins
 */
export const proxyService = {
  /**
   * Fetches raw text/HTML from a URL via proxy.
   * Useful for scraping or displaying external content in WebFrame.
   */
  async fetchText(targetUrl: string): Promise<ProxyResult<string>> {
    const strategies = [
      {
        name: 'AllOrigins',
        url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        transform: (json: any) => json.contents
      },
      {
        name: 'CorsProxy.io',
        url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        transform: (text: string) => text
      }
    ];

    for (const strategy of strategies) {
      try {
        const res = await fetch(strategy.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        let data;
        if (strategy.name === 'AllOrigins') {
           const json = await res.json();
           data = strategy.transform(json);
        } else {
           const text = await res.text();
           data = strategy.transform(text);
        }

        return { success: true, data, source: strategy.name };
      } catch (e: any) {
        console.warn(`Proxy strategy ${strategy.name} failed for ${targetUrl}:`, e.message);
      }
    }

    return { success: false, error: "All proxy strategies failed." };
  },

  /**
   * Fetches JSON data from an API via proxy.
   */
  async fetchJson<T>(targetUrl: string): Promise<ProxyResult<T>> {
    const result = await this.fetchText(targetUrl);
    if (!result.success || !result.data) {
        return { success: false, error: result.error };
    }

    try {
        // Try parsing the text data as JSON
        const json = JSON.parse(result.data);
        return { success: true, data: json as T, source: result.source };
    } catch (e) {
        return { success: false, error: "Failed to parse JSON response." };
    }
  }
};
