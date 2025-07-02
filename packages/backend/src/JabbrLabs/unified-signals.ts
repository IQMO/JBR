// Unified Order Manager for Signals (Jabbr Labs Modular)
// All order execution for signals must go through this module.
// This file delegates to the canonical trading engine and exposes a type-safe API for signal execution.
//
// DO NOT duplicate or reimplement order logic here. This is a pure delegation layer.
//
// See: DEVELOPER_GUIDE_CRITICAL_SETUP.md, DEV_CRITICAL_GUIDE.md, and CHECKLIST_TARGET_REACHER_REFACTOR.md

import type { SignalData, SignalExecutionResult } from '../types/signals';
import { unifiedTradingEngine } from '../core/unified-trading-engine';
import { logger } from '../utils/logging-utils';
import { LogCategory } from '../types';

/**
 * Execute a signal by delegating to the unified trading engine.
 * @param botId - The bot ID
 * @param signal - The signal data object
 * @returns The result of order execution
 */
export async function executeSignal(
  botId: string,
  signal: SignalData
): Promise<SignalExecutionResult> {
  try {
    // Validate inputs
    if (!botId || typeof botId !== 'string') {
      throw new Error('Invalid botId provided to executeSignal');
    }
    
    if (!signal || typeof signal !== 'object') {
      throw new Error('Invalid signal provided to executeSignal');
    }

    // Only delegate; do not implement order logic here
    return await unifiedTradingEngine.executeSignal(botId, { ...signal });
  } catch (error) {
    logger.error(`Error executing signal for bot ${botId}`, LogCategory.SIGNAL, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw new Error(`Failed to execute signal: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Usage Example:
// import { executeSignal } from './unified-signals';
// const result = await executeSignal(botId, signalData);

// All order/risk/position logic is handled in the trading engine. This file is the only entry point for signal order execution.
// NOTE: This file is self-contained and does NOT import itself. There is no real circular dependency here. If flagged, this is a tool limitation, not a code issue.
