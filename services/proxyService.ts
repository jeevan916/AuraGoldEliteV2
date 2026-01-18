
import { errorService } from './errorService';

export interface ProxyResult<T = string> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
}

/**
 * @deprecated 
 * The Proxy Service has been scrapped to improve stability and security.
 * All external connections are now handled directly via secure server-side routes or direct links.
 */
export const proxyService = {
  async fetchText(targetUrl: string): Promise<ProxyResult<string>> {
    console.error("Proxy Service has been disabled. This call should not happen.");
    return { success: false, error: "Proxy Service Disabled" };
  },

  async fetchJson<T>(targetUrl: string): Promise<ProxyResult<T>> {
    console.error("Proxy Service has been disabled. This call should not happen.");
    return { success: false, error: "Proxy Service Disabled" };
  }
};
