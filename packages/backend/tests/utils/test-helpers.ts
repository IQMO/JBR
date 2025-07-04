/**
 * Test Helper Utilities
 * 
 * This file re-exports shared test utilities and adds any backend-specific
 * test helpers. Most data generation functions have been moved to the
 * shared package to eliminate duplication.
 */

// Re-export all shared test utilities for backward compatibility
export {
  generateBullishCandles,
  generateBearishCandles,
  generateMixedTrendCandles,
  generateSyntheticCandles,
  timeframeToMs,
  type Candle,
  type CandleGenerationOptions
} from '../../../shared/src/test-utils/data-generators';

export {
  createMockContext,
  createMockContextWithPosition,
  createBacktestContext,
  type StrategyContext,
  type TradingContext
} from '../../../shared/src/test-utils/context-generators';
