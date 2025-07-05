/**
 * API Service Layer
 * Centralized API calls for the JBR Trading Platform frontend
 */

import config from '../config/app';

// Type definitions
interface Trade {
  id: string;
  botId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: number;
  price: number;
  timestamp: string;
  status: string;
}

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  percentage: number;
}

interface BotStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  strategy: string;
  pnl: number;
  trades: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  services: Record<string, { status: string; latency?: number }>;
  uptime: number;
}

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high24h: number;
  low24h: number;
}

interface PnLEntry {
  timestamp: string;
  pnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

// Custom error class for API errors
export class ApiError extends Error {
  public status: number;
  public code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

class ApiService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = config.api.baseUrl;
    this.timeout = config.api.timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getAuthToken();

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      return {
        data,
        success: true,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', 408, 'TIMEOUT');
        }

        throw new ApiError(
          error.message || 'Unknown error occurred',
          500,
          'UNKNOWN_ERROR'
        );
      }

      throw new ApiError('Unknown error occurred', 500, 'UNKNOWN_ERROR');
    }
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem('auth_token');
  }

  // Trading API endpoints
  async getTrades(params?: {
    limit?: number;
    offset?: number;
    symbol?: string;
    status?: string;
    timeframe?: string;
  }): Promise<ApiResponse<Trade[]>> {
    const searchParams = new URLSearchParams();
    if (params?.limit) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params?.offset) {
      searchParams.set('offset', params.offset.toString());
    }
    if (params?.symbol) {
      searchParams.set('symbol', params.symbol);
    }
    if (params?.status) {
      searchParams.set('status', params.status);
    }
    if (params?.timeframe) {
      searchParams.set('timeframe', params.timeframe);
    }

    const query = searchParams.toString();
    return this.request(`/api/trades${query ? `?${query}` : ''}`);
  }

  async getPositions(): Promise<ApiResponse<Position[]>> {
    return this.request('/api/positions');
  }

  async getBotStatus(): Promise<ApiResponse<BotStatus[]>> {
    return this.request('/api/bots/status');
  }

  async getSystemHealth(): Promise<ApiResponse<SystemHealth>> {
    return this.request('/api/system/health');
  }

  async getMarketData(symbols?: string[]): Promise<ApiResponse<MarketData[]>> {
    const params = symbols ? `?symbols=${symbols.join(',')}` : '';
    return this.request(`/api/market/data${params}`);
  }

  async getPnLHistory(params?: {
    timeframe?: string;
    symbol?: string;
  }): Promise<ApiResponse<PnLEntry[]>> {
    const searchParams = new URLSearchParams();
    if (params?.timeframe) {
      searchParams.set('timeframe', params.timeframe);
    }
    if (params?.symbol) {
      searchParams.set('symbol', params.symbol);
    }

    const query = searchParams.toString();
    return this.request(`/api/portfolio/pnl${query ? `?${query}` : ''}`);
  }

  // Bot control endpoints
  async startBot(botId: string): Promise<ApiResponse<{ status: string }>> {
    return this.request(`/api/bots/${botId}/start`, {
      method: 'POST',
    });
  }

  async stopBot(botId: string): Promise<ApiResponse<{ status: string }>> {
    return this.request(`/api/bots/${botId}/stop`, {
      method: 'POST',
    });
  }

  async pauseBot(botId: string): Promise<ApiResponse<{ status: string }>> {
    return this.request(`/api/bots/${botId}/pause`, {
      method: 'POST',
    });
  }

  // Authentication endpoints
  async login(credentials: { email: string; password: string }): Promise<ApiResponse<{ token: string; user: User }>> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    const response = await this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    
    return response;
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return this.request('/api/auth/refresh', {
      method: 'POST',
    });
  }

  // Utility methods
  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }
}

// Singleton instance
export const apiService = new ApiService();

export default apiService;
