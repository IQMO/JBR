/**
 * Error Handling Utilities
 * Centralized error handling for the JBR Trading Platform frontend
 */

import { ApiError } from '../services/api';

export interface ErrorState {
  message: string;
  code?: string;
  status?: number;
  timestamp: Date;
  context?: string;
}

export class ErrorHandler {
  static handleApiError(error: ApiError, context?: string): ErrorState {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      timestamp: new Date(),
      context,
    };
  }

  static handleGenericError(error: Error, context?: string): ErrorState {
    return {
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date(),
      context,
    };
  }

  static handleUnknownError(error: unknown, context?: string): ErrorState {
    if (error instanceof ApiError) {
      return this.handleApiError(error, context);
    }

    if (error instanceof Error) {
      return this.handleGenericError(error, context);
    }

    return {
      message: typeof error === 'string' ? error : 'An unknown error occurred',
      timestamp: new Date(),
      context,
    };
  }

  static getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'An unknown error occurred';
  }

  static isNetworkError(error: unknown): boolean {
    if (error instanceof ApiError) {
      return error.status >= 500 || error.code === 'TIMEOUT';
    }

    if (error instanceof Error) {
      return error.name === 'NetworkError' || error.name === 'AbortError';
    }

    return false;
  }

  static isAuthenticationError(error: unknown): boolean {
    if (error instanceof ApiError) {
      return error.status === 401 || error.status === 403;
    }

    return false;
  }

  static shouldRetry(error: unknown): boolean {
    if (error instanceof ApiError) {
      // Retry on server errors and timeouts, but not on client errors
      return error.status >= 500 || error.code === 'TIMEOUT';
    }

    if (error instanceof Error) {
      return error.name === 'NetworkError';
    }

    return false;
  }
}

export default ErrorHandler;
