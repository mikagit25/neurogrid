// API Configuration for NeuroGrid Web Interface
// Automatically detects production vs development environment

class APIConfig {
    constructor() {
        // Check if we're in browser environment
        if (typeof window !== 'undefined') {
            this.isProduction = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENV === 'production';
            this.isDevelopment = !this.isProduction;

            // Use environment variables if available, otherwise detect from window location
            this.baseURL = this.getBaseURL();
            this.wsURL = this.getWebSocketURL();
            this.appURL = this.getAppURL();
        } else {
            // Server-side defaults
            this.isProduction = process.env.NODE_ENV === 'production';
            this.isDevelopment = !this.isProduction;
            this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            this.wsURL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
            this.appURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        }
    }

    getBaseURL() {
        // First try environment variable
        if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) {
            return process.env.NEXT_PUBLIC_API_URL;
        }

        // In browser, detect from current location
        if (typeof window !== 'undefined') {
            const { protocol, hostname, port } = window.location;

            // Production detection (not localhost)
            if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                // For production, try to use api subdomain or same domain with API port
                if (hostname === 'neurogrid.network' || hostname.endsWith('.neurogrid.network')) {
                    return `${protocol}//api.neurogrid.network`;
                }
                // For other domains, assume API is on same host with port 3001 or 8080
                return `${protocol}//${hostname}:3001`;
            }
        }

        // Development fallback
        return 'http://localhost:3001';
    }

    getWebSocketURL() {
        // First try environment variable
        if (process.env.NEXT_PUBLIC_WS_URL) {
            return process.env.NEXT_PUBLIC_WS_URL;
        }

        // Convert HTTP URL to WebSocket URL
        const baseURL = this.baseURL;
        const wsURL = baseURL.replace(/^http/, 'ws') + '/ws';

        return wsURL;
    }

    getAppURL() {
        // First try environment variable
        if (process.env.NEXT_PUBLIC_APP_URL) {
            return process.env.NEXT_PUBLIC_APP_URL;
        }

        // In browser, use current origin
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }

        // Server-side fallback
        return 'http://localhost:3000';
    }

    // API endpoints
    get endpoints() {
        return {
            health: `${this.baseURL}/health`,
            nodes: `${this.baseURL}/api/nodes`,
            tasks: `${this.baseURL}/api/tasks`,
            wallet: `${this.baseURL}/api/tokens/balance`,
            analytics: `${this.baseURL}/api/v2/analytics`,
            llm: {
                generate: `${this.baseURL}/api/llm/generate`,
                models: `${this.baseURL}/api/llm/models`
            }
        };
    }

    // WebSocket connection
    createWebSocket(path = '') {
        const wsUrl = this.wsURL + path;
        console.log(`[APIConfig] Creating WebSocket connection to: ${wsUrl}`);
        return new WebSocket(wsUrl);
    }

    // Fetch with automatic URL resolution
    async fetch(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        try {
            console.log(`[APIConfig] Fetching: ${url}`);
            const response = await fetch(url, { ...defaultOptions, ...options });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            return response;
        } catch (error) {
            console.error(`[APIConfig] Fetch error for ${url}:`, error);
            throw error;
        }
    }

    // Configuration info for debugging
    getConfig() {
        return {
            environment: this.isProduction ? 'production' : 'development',
            baseURL: this.baseURL,
            wsURL: this.wsURL,
            appURL: this.appURL,
            endpoints: this.endpoints
        };
    }
}

// Create singleton instance
const apiConfig = new APIConfig();

// Export for use in components
export default apiConfig;

// Also export class for custom instances
export { APIConfig };

// Utility functions for backward compatibility
export const getApiUrl = (path = '') => apiConfig.baseURL + path;
export const getWsUrl = (path = '') => apiConfig.wsURL + path;
export const createWs = (path = '') => apiConfig.createWebSocket(path);