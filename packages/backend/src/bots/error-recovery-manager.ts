/**
 * Error Recovery Manager
 * 
 * Comprehensive error handling and recovery system for bot operations.
 * Provides intelligent error classification, recovery strategies, and
 * automated recovery mechanisms.
 */

import { EventEmitter } from 'events';

import logger from '../services/logging.service';

interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

class LoggerWrapper implements Logger {
  constructor(private context: string) {}

  info(message: string, meta?: any): void {
    logger.info(`[${this.context}] ${message}`, meta);
  }

  warn(message: string, meta?: any): void {
    logger.warn(`[${this.context}] ${message}`, meta);
  }

  error(message: string, meta?: any): void {
    logger.error(`[${this.context}] ${message}`, meta);
  }
}

export type ErrorType = 
  | 'NETWORK_ERROR'
  | 'EXCHANGE_ERROR' 
  | 'STRATEGY_ERROR'
  | 'DATABASE_ERROR'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'SYSTEM_ERROR'
  | 'UNKNOWN_ERROR';

export type RecoveryStrategy = 
  | 'RETRY'
  | 'EXPONENTIAL_BACKOFF'
  | 'CIRCUIT_BREAKER'
  | 'FALLBACK'
  | 'RESTART'
  | 'ALERT_ADMIN'
  | 'GRACEFUL_SHUTDOWN'
  | 'NO_ACTION';

export interface ErrorContext {
  botId: string;
  operation: string;
  timestamp: Date;
  errorMessage: string;
  errorStack?: string;
  metadata?: Record<string, unknown>;
}

export interface RecoveryConfig {
  maxRetries: number;
  baseRetryDelay: number; // milliseconds
  maxRetryDelay: number; // milliseconds
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number; // milliseconds
  enableAutoRestart: boolean;
  enableFallbackMode: boolean;
  alertThreshold: number; // error count before alerting admin
}

export interface ErrorClassification {
  type: ErrorType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recoveryStrategy: RecoveryStrategy;
  retryable: boolean;
  requiresImmedateAction: boolean;
}

export interface RecoveryAttempt {
  attemptNumber: number;
  strategy: RecoveryStrategy;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface ErrorRecord {
  id: string;
  context: ErrorContext;
  classification: ErrorClassification;
  recoveryAttempts: RecoveryAttempt[];
  resolved: boolean;
  resolvedAt?: Date;
  finalOutcome: 'RECOVERED' | 'FAILED' | 'ESCALATED' | 'PENDING';
}

export class ErrorRecoveryManager extends EventEmitter {
  private config: RecoveryConfig;
  private errorHistory: Map<string, ErrorRecord[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private recoveryCallbacks: Map<RecoveryStrategy, Function> = new Map();
  private logger: Logger;

  constructor(config: Partial<RecoveryConfig> = {}) {
    super();
    
    this.config = {
      maxRetries: 3,
      baseRetryDelay: 1000,
      maxRetryDelay: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      enableAutoRestart: true,
      enableFallbackMode: true,
      alertThreshold: 10,
      ...config
    };

    this.logger = new LoggerWrapper('ErrorRecoveryManager');
    this.initializeRecoveryCallbacks();
  }

  /**
   * Handle an error with intelligent recovery
   */
  async handleError(
    error: Error, 
    context: Omit<ErrorContext, 'timestamp' | 'errorMessage' | 'errorStack'>
  ): Promise<boolean> {
    const fullContext: ErrorContext = {
      ...context,
      timestamp: new Date(),
      errorMessage: error.message,
      errorStack: error.stack
    };

    const classification = this.classifyError(error, fullContext);
    const errorRecord = this.createErrorRecord(fullContext, classification);

    // Store error in history
    this.addToErrorHistory(context.botId, errorRecord);

    // Check circuit breaker
    const circuitBreaker = this.getCircuitBreaker(context.botId);
    if (circuitBreaker.isOpen()) {
      this.logger.warn('Circuit breaker is open, skipping recovery attempt', {
        botId: context.botId,
        operation: context.operation
      });
      return false;
    }

    // Attempt recovery
    const recovered = await this.attemptRecovery(errorRecord);

    // Update circuit breaker
    if (recovered) {
      circuitBreaker.recordSuccess();
    } else {
      circuitBreaker.recordFailure();
    }

    // Check if we should alert admin
    this.checkAlertThreshold(context.botId);

    // Emit events
    this.emit('error', errorRecord);
    if (recovered) {
      this.emit('recovery', errorRecord);
    } else {
      this.emit('recovery-failed', errorRecord);
    }

    return recovered;
  }

  /**
   * Classify error and determine recovery strategy
   */
  private classifyError(error: Error, context: ErrorContext): ErrorClassification {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Network errors
    if (message.includes('network') || message.includes('timeout') || 
        message.includes('connection') || message.includes('enotfound')) {
      return {
        type: 'NETWORK_ERROR',
        severity: 'MEDIUM',
        recoveryStrategy: 'EXPONENTIAL_BACKOFF',
        retryable: true,
        requiresImmedateAction: false
      };
    }

    // Exchange API errors
    if (message.includes('api') || message.includes('rate limit') || 
        message.includes('exchange') || message.includes('order')) {
      const severity = message.includes('rate limit') ? 'LOW' : 'MEDIUM';
      const strategy = message.includes('rate limit') ? 'EXPONENTIAL_BACKOFF' : 'RETRY';
      
      return {
        type: message.includes('rate limit') ? 'RATE_LIMIT_ERROR' : 'EXCHANGE_ERROR',
        severity,
        recoveryStrategy: strategy,
        retryable: true,
        requiresImmedateAction: false
      };
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('unauthorized') || 
        message.includes('forbidden') || message.includes('token')) {
      return {
        type: 'AUTHENTICATION_ERROR',
        severity: 'HIGH',
        recoveryStrategy: 'ALERT_ADMIN',
        retryable: false,
        requiresImmedateAction: true
      };
    }

    // Database errors
    if (message.includes('database') || message.includes('sql') || 
        message.includes('connection pool') || stack.includes('pg')) {
      return {
        type: 'DATABASE_ERROR',
        severity: 'HIGH',
        recoveryStrategy: 'EXPONENTIAL_BACKOFF',
        retryable: true,
        requiresImmedateAction: false
      };
    }

    // Strategy errors
    if (context.operation.includes('strategy') || message.includes('strategy')) {
      return {
        type: 'STRATEGY_ERROR',
        severity: 'MEDIUM',
        recoveryStrategy: 'FALLBACK',
        retryable: true,
        requiresImmedateAction: false
      };
    }

    // Configuration errors
    if (message.includes('config') || message.includes('missing') || 
        message.includes('invalid') || message.includes('required')) {
      return {
        type: 'CONFIGURATION_ERROR',
        severity: 'HIGH',
        recoveryStrategy: 'ALERT_ADMIN',
        retryable: false,
        requiresImmedateAction: true
      };
    }

    // System errors
    if (message.includes('memory') || message.includes('cpu') || 
        message.includes('disk') || message.includes('system')) {
      return {
        type: 'SYSTEM_ERROR',
        severity: 'CRITICAL',
        recoveryStrategy: 'RESTART',
        retryable: false,
        requiresImmedateAction: true
      };
    }

    // Default classification
    return {
      type: 'UNKNOWN_ERROR',
      severity: 'MEDIUM',
      recoveryStrategy: 'RETRY',
      retryable: true,
      requiresImmedateAction: false
    };
  }

  /**
   * Attempt recovery based on classification
   */
  private async attemptRecovery(errorRecord: ErrorRecord): Promise<boolean> {
    const { classification, context } = errorRecord;
    const callback = this.recoveryCallbacks.get(classification.recoveryStrategy);

    if (!callback) {
      this.logger.error('No recovery callback found for strategy', {
        strategy: classification.recoveryStrategy,
        botId: context.botId
      });
      return false;
    }

    const attempt: RecoveryAttempt = {
      attemptNumber: errorRecord.recoveryAttempts.length + 1,
      strategy: classification.recoveryStrategy,
      timestamp: new Date(),
      success: false
    };

    try {
      this.logger.info('Attempting recovery', {
        botId: context.botId,
        strategy: classification.recoveryStrategy,
        attempt: attempt.attemptNumber
      });

      const success = await callback(errorRecord, attempt);
      attempt.success = success;

      if (success) {
        errorRecord.resolved = true;
        errorRecord.resolvedAt = new Date();
        errorRecord.finalOutcome = 'RECOVERED';
      }

      return success;
    } catch (recoveryError) {
      const errorMessage = recoveryError instanceof Error ? 
        recoveryError.message : String(recoveryError);
      
      attempt.errorMessage = errorMessage;
      
      this.logger.error('Recovery attempt failed', {
        botId: context.botId,
        strategy: classification.recoveryStrategy,
        attempt: attempt.attemptNumber,
        error: errorMessage
      });

      return false;
    } finally {
      errorRecord.recoveryAttempts.push(attempt);
    }
  }

  /**
   * Initialize recovery strategy callbacks
   */
  private initializeRecoveryCallbacks(): void {
    this.recoveryCallbacks.set('RETRY', this.handleRetry.bind(this));
    this.recoveryCallbacks.set('EXPONENTIAL_BACKOFF', this.handleExponentialBackoff.bind(this));
    this.recoveryCallbacks.set('CIRCUIT_BREAKER', this.handleCircuitBreaker.bind(this));
    this.recoveryCallbacks.set('FALLBACK', this.handleFallback.bind(this));
    this.recoveryCallbacks.set('RESTART', this.handleRestart.bind(this));
    this.recoveryCallbacks.set('ALERT_ADMIN', this.handleAlertAdmin.bind(this));
    this.recoveryCallbacks.set('GRACEFUL_SHUTDOWN', this.handleGracefulShutdown.bind(this));
    this.recoveryCallbacks.set('NO_ACTION', this.handleNoAction.bind(this));
  }

  /**
   * Recovery strategy implementations
   */
  private async handleRetry(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    if (attempt.attemptNumber > this.config.maxRetries) {
      this.logger.warn('Max retries exceeded', {
        botId: errorRecord.context.botId,
        attempts: attempt.attemptNumber
      });
      return false;
    }

    await this.delay(this.config.baseRetryDelay);
    this.emit('retry', errorRecord, attempt);
    return true; // Caller should retry the operation
  }

  private async handleExponentialBackoff(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    if (attempt.attemptNumber > this.config.maxRetries) {
      return false;
    }

    const delay = Math.min(
      this.config.baseRetryDelay * Math.pow(2, attempt.attemptNumber - 1),
      this.config.maxRetryDelay
    );

    await this.delay(delay);
    this.emit('retry', errorRecord, attempt);
    return true;
  }

  private async handleCircuitBreaker(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    const circuitBreaker = this.getCircuitBreaker(errorRecord.context.botId);
    
    if (circuitBreaker.isOpen()) {
      this.logger.info('Circuit breaker is open, waiting for cooldown', {
        botId: errorRecord.context.botId
      });
      return false;
    }

    return true;
  }

  private async handleFallback(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    if (!this.config.enableFallbackMode) {
      return false;
    }

    this.emit('fallback', errorRecord, attempt);
    this.logger.info('Activating fallback mode', {
      botId: errorRecord.context.botId
    });

    return true;
  }

  private async handleRestart(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    if (!this.config.enableAutoRestart) {
      this.logger.warn('Auto-restart is disabled', {
        botId: errorRecord.context.botId
      });
      return false;
    }

    this.emit('restart-required', errorRecord, attempt);
    this.logger.info('Requesting bot restart', {
      botId: errorRecord.context.botId
    });

    return true;
  }

  private async handleAlertAdmin(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    this.emit('admin-alert', errorRecord, attempt);
    this.logger.error('Admin intervention required', {
      botId: errorRecord.context.botId,
      errorType: errorRecord.classification.type,
      severity: errorRecord.classification.severity
    });

    return false; // Requires manual intervention
  }

  private async handleGracefulShutdown(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    this.emit('shutdown-required', errorRecord, attempt);
    this.logger.warn('Graceful shutdown required', {
      botId: errorRecord.context.botId
    });

    return false;
  }

  private async handleNoAction(errorRecord: ErrorRecord, attempt: RecoveryAttempt): Promise<boolean> {
    this.logger.info('No recovery action required', {
      botId: errorRecord.context.botId
    });

    return true;
  }

  /**
   * Helper methods
   */
  private createErrorRecord(context: ErrorContext, classification: ErrorClassification): ErrorRecord {
    return {
      id: `${context.botId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      context,
      classification,
      recoveryAttempts: [],
      resolved: false,
      finalOutcome: 'PENDING'
    };
  }

  private addToErrorHistory(botId: string, errorRecord: ErrorRecord): void {
    if (!this.errorHistory.has(botId)) {
      this.errorHistory.set(botId, []);
    }

    const history = this.errorHistory.get(botId)!;
    history.push(errorRecord);

    // Keep only recent errors (last 100)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private getCircuitBreaker(botId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(botId)) {
      this.circuitBreakers.set(botId, new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerTimeout
      ));
    }

    return this.circuitBreakers.get(botId)!;
  }

  private checkAlertThreshold(botId: string): void {
    const history = this.errorHistory.get(botId) || [];
    const recentErrors = history.filter(
      record => Date.now() - record.context.timestamp.getTime() < 3600000 // Last hour
    );

    if (recentErrors.length >= this.config.alertThreshold) {
      this.emit('alert-threshold-exceeded', {
        botId,
        errorCount: recentErrors.length,
        threshold: this.config.alertThreshold
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public methods for monitoring and management
   */
  getErrorHistory(botId: string): ErrorRecord[] {
    return this.errorHistory.get(botId) || [];
  }

  getCircuitBreakerStatus(botId: string): { isOpen: boolean; failureCount: number; lastFailureTime?: Date } {
    const circuitBreaker = this.circuitBreakers.get(botId);
    if (!circuitBreaker) {
      return { isOpen: false, failureCount: 0 };
    }

    return {
      isOpen: circuitBreaker.isOpen(),
      failureCount: circuitBreaker.getFailureCount(),
      lastFailureTime: circuitBreaker.getLastFailureTime()
    };
  }

  clearErrorHistory(botId: string): void {
    this.errorHistory.delete(botId);
  }

  resetCircuitBreaker(botId: string): void {
    const circuitBreaker = this.circuitBreakers.get(botId);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  getStats(): {
    totalErrors: number;
    resolvedErrors: number;
    activeCircuitBreakers: number;
    errorsByType: Record<ErrorType, number>;
  } {
    let totalErrors = 0;
    let resolvedErrors = 0;
    const errorsByType: Record<ErrorType, number> = {} as Record<ErrorType, number>;

    for (const history of this.errorHistory.values()) {
      totalErrors += history.length;
      resolvedErrors += history.filter(record => record.resolved).length;
      
      for (const record of history) {
        errorsByType[record.classification.type] = 
          (errorsByType[record.classification.type] || 0) + 1;
      }
    }

    const activeCircuitBreakers = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.isOpen()).length;

    return {
      totalErrors,
      resolvedErrors,
      activeCircuitBreakers,
      errorsByType
    };
  }
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  isOpen(): boolean {
    if (this.state === 'CLOSED') {
      return false;
    }

    if (this.state === 'OPEN') {
      if (this.lastFailureTime && 
          Date.now() - this.lastFailureTime.getTime() > this.timeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }

    // HALF_OPEN state
    return false;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): Date | undefined {
    return this.lastFailureTime;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.state = 'CLOSED';
  }
}

export default ErrorRecoveryManager;
