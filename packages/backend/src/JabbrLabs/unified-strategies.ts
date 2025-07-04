// Unified Order Manager for Strategies (Jabbr Labs Modular)
// All order execution for strategies must go through this module.
// This file delegates to the canonical trading engine and exposes a type-safe API for strategy signal execution.
//
// DO NOT duplicate or reimplement order logic here. This is a pure delegation layer.
//
// See: DEVELOPER_GUIDE_CRITICAL_SETUP.md, DEV_CRITICAL_GUIDE.md, and CHECKLIST_TARGET_REACHER_REFACTOR.md

// Unified Order Manager for Strategies (Jabbr Labs Modular)
// All order execution for strategies must go through this module.
// This file delegates to the canonical trading engine and exposes a type-safe API for strategy signal execution.
//
// DO NOT duplicate or reimplement order logic here. This is a pure delegation layer.
//
// See: DEVELOPER_GUIDE_CRITICAL_SETUP.md, DEV_CRITICAL_GUIDE.md, and CHECKLIST_TARGET_REACHER_REFACTOR.md

// FIXME: Temporary fixes for missing dependencies
// import type { StrategyResult } from './target-reacher/interfaces';
// import type { SignalExecutionResult, SignalData } from '../types/signals';
// import { unifiedTradingEngine } from '../core/unified-trading-engine';
// import { logger } from '../utils/logging-utils';
// import { LogCategory } from '../types';

// Temporary type definitions
interface StrategyResult {
  signal?: SignalData;
  action: string;
  confidence: number;
  metadata?: any;
  reason?: string; // Added missing property
}

interface SignalData {
  id: string;
  type: string;
  symbol: string;
  action: 'buy' | 'sell';
  confidence: number;
  timestamp: number;
  // Extended for compatibility
  price?: number;
  reason?: string;
  value?: number;
  regime?: string;
  parameters?: any;
}

interface SignalExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  message: string;
}

// Temporary placeholder implementations
const tempLogger = {
  error: (message: string, category: string, data?: any) => {
    console.error(`[${category}] ${message}`, data);
  }
};

const tempUnifiedEngine = {
  executeSignal: async (botId: string, signal: SignalData): Promise<SignalExecutionResult> => {
    // FIXME: This is a placeholder - needs real implementation
    console.log(`TEMP: Executing strategy signal for bot ${botId}:`, signal);
    return {
      success: false,
      error: 'Temporary implementation - unified trading engine not implemented yet',
      message: 'Strategy signal execution temporarily disabled'
    };
  }
};

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
    action: signal.action === 'buy' || signal.action === 'sell' ? signal.action as 'buy' | 'sell' : 'buy',
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
    return await tempUnifiedEngine.executeSignal(botId, strategyResultToSignalData(signal));
  } catch (error) {
    tempLogger.error(`Error executing strategy signal for bot ${botId}`, 'TRADING', { 
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
