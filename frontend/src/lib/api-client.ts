/**
 * API Client
 * Core HTTP client with token injection, automatic refresh, and error handling
 */

import type { ApiError } from '@/types/api';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

export interface ApiClientConfig {
  baseURL: string;
  getAccessToken: () => string | null;
  onTokenRefresh: () => Promise<void>;
  onUnauthorized: () => void;
}

export class ApiClient {
  private baseURL: string;
  private getAccessToken: () => string | null;
  private onTokenRefresh: () => Promise<void>;
  private onUnauthorized: () => void;
  private isRefreshing = false;
  private refreshQueue: Array<() => void> = [];

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.getAccessToken = config.getAccessToken;
    this.onTokenRefresh = config.onTokenRefresh;
    this.onUnauthorized = config.onUnauthorized;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseURL}${endpoint}`;
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
      credentials: options.credentials || 'include', // Important for httpOnly cookies
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    try {
      let response = await fetch(url, fetchOptions);

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401 && token) {
        // If already refreshing, queue this request
        if (this.isRefreshing) {
          return new Promise((resolve, reject) => {
            this.refreshQueue.push(async () => {
              try {
                const retryResponse = await fetch(url, {
                  ...fetchOptions,
                  headers: {
                    ...headers,
                    Authorization: `Bearer ${this.getAccessToken()}`,
                  },
                });
                const result = await this.handleResponse<T>(retryResponse);
                resolve(result);
              } catch (error) {
                reject(error);
              }
            });
          });
        }

        // Attempt token refresh
        this.isRefreshing = true;
        try {
          await this.onTokenRefresh();

          // Retry the original request with new token
          const newToken = this.getAccessToken();
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
          }
          response = await fetch(url, { ...fetchOptions, headers });

          // Process queued requests
          this.refreshQueue.forEach((callback) => callback());
          this.refreshQueue = [];
        } catch (refreshError) {
          // Refresh failed, clear queue and logout
          this.refreshQueue = [];
          this.onUnauthorized();
          throw new Error('Session expired. Please login again.');
        } finally {
          this.isRefreshing = false;
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle 401 after refresh attempt
    if (response.status === 401) {
      this.onUnauthorized();
      throw new Error('Session expired. Please login again.');
    }

    // Handle other error status codes
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData: ApiError = await response.json();
        errorMessage = errorData.error.message || errorMessage;
      } catch {
        // If error response is not JSON, use default message
      }
      throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    // Parse JSON response
    try {
      return await response.json();
    } catch {
      throw new Error('Invalid response format');
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Singleton instance (will be initialized in auth context)
let apiClientInstance: ApiClient | null = null;

export function initializeApiClient(config: ApiClientConfig): ApiClient {
  apiClientInstance = new ApiClient(config);
  return apiClientInstance;
}

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Call initializeApiClient first.');
  }
  return apiClientInstance;
}
