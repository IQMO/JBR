// Unified Order Manager for Strategies (Jabbr Labs Modular)
// All order execution for strategies must go through this module.
// This file delegates to the canonical trading engine and exposes a type-safe API for strategy signal execution.
//
// DO NOT duplicate or reimplement order logic here. This is a pure delegation layer.
//
// See: DEVELOPER_GUIDE_CRITICAL_SETUP.md, DEV_CRITICAL_GUIDE.md, and CHECKLIST_TARGET_REACHER_REFACTOR.md

import type { StrategyResult } from './target-reacher/interfaces';
import type { SignalExecutionResult, SignalData } from '../types/signals';
import { unifiedTradingEngine } from '../core/unified-trading-engine';
import { logger } from '../utils/logging-utils';
import { LogCategory } from '../types';

/**
 * Execute a strategy signal by delegating to the unified trading engine.
 * @param botId - The bot ID
 * @param signal - The strategy result (signal) object
 * @returns The result of order execution
 */
function strategyResultToSignalData(signal: StrategyResult): SignalData {
  return {
    id: `signal_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    symbol: signal.metadata?.symbol as string || '',
    type: signal.action === 'buy' || signal.action === 'sell' || signal.action === 'hold' ? signal.action : 'hold',
    confidence: typeof signal.confidence === 'number' ? signal.confidence : 0,
    price: typeof signal.metadata?.price === 'number' ? signal.metadata.price : 0,
    timestamp: Date.now(),
    reason: signal.reason || '',
    value: 0,
    regime: '',
    parameters: {},
  };
}

export async function executeStrategySignal(
  botId: string,
  signal: StrategyResult
): Promise<SignalExecutionResult> {
  try {
    // Validate inputs
    if (!botId || typeof botId !== 'string') {
      throw new Error('Invalid botId provided to executeStrategySignal');
    }
    if (!signal || typeof signal !== 'object') {
      throw new Error('Invalid signal provided to executeStrategySignal');
    }
    // Only delegate; do not implement order logic here
    return await unifiedTradingEngine.executeSignal(botId, strategyResultToSignalData(signal));
  } catch (error) {
    logger.error(`Error executing strategy signal for bot ${botId}`, LogCategory.TRADING, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw new Error(`Failed to execute strategy signal: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// NOTE: This file is self-contained and does NOT import itself. There is no real circular dependency here. If flagged, this is a tool limitation, not a code issue.

// Usage Example:
// import { executeStrategySignal } from './unified-strategies';
// const result = await executeStrategySignal(botId, strategySignal);

// All order/risk/position logic is handled in the trading engine. This file is the only entry point for strategy order execution.
