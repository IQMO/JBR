/**
 * Strategy utility functions to simplify working with the strategy framework
 */

import type { 
  IStrategy, 
  StrategyContext, 
  StrategyConfig 
} from '../JabbrLabs/target-reacher/interfaces';
import logger from '../services/logging.service';

import type { StrategyType } from './strategy-factory';
import { StrategyFactory, strategyFactory } from './strategy-factory';


/**
 * Create a context for running strategies outside the bot system
 * Useful for testing and backtesting
 */
export function createBasicContext(
  symbol: string,
  marketDataProvider: any,
  config: StrategyConfig,
  botId = 'test-bot'
): StrategyContext {
  return {
    symbol,
    marketData: marketDataProvider,
    tradeExecutor: {
      executeSignal: async () => ({ id: 'test', botId, symbol, type: 'market', side: 'buy', amount: 0, status: 'open', filled: 0, remaining: 0, timestamp: Date.now(), updatedAt: Date.now() }),
      getPosition: async () => null,
      closePosition: async () => {}
    },
    logger: {
      info: (msg: string) => logger.info(`[Strategy] ${msg}`),
      warn: (msg: string) => logger.warn(`[Strategy] ${msg}`),
      error: (msg: string) => logger.error(`[Strategy] ${msg}`),
      debug: (msg: string) => logger.debug(`[Strategy] ${msg}`)
    },
    storage: {
      storeStrategyEvent: async () => {},
      getStrategyState: async () => null,
      saveStrategyState: async () => {}
    },
    eventEmitter: {
      emit: () => {},
      on: () => {},
      off: () => {}
    },
    config,
    botConfig: {
      id: botId,
      name: 'Test Bot',
      symbol,
      tradeType: 'market',
      amount: 100
    }
  };
}

/**
 * Helper to quickly create and initialize a strategy
 */
export async function createAndInitializeStrategy(
  type: StrategyType,
  config: StrategyConfig,
  context: StrategyContext
): Promise<IStrategy> {
  const strategy = await strategyFactory.createStrategy(type, config, context);
  await strategy.initialize(context);
  return strategy;
}

/**
 * Helper to safely run a strategy with proper error handling
 */
export async function runStrategyWithErrorHandling(
  strategy: IStrategy,
  context: StrategyContext
) {
  try {
    return await strategy.execute(context);
  } catch (error) {
    logger.error(`Strategy execution error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      action: 'hold',
      error: error instanceof Error ? error.message : String(error),
      reason: 'Strategy execution failed with error'
    };
  }
}

/**
 * Clean up resources used by a strategy
 */
export async function cleanupStrategy(strategy: IStrategy, context: StrategyContext): Promise<void> {
  try {
    await strategy.cleanup(context);
  } catch (error) {
    logger.error(`Strategy cleanup error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all available strategies (both built-in and plugins)
 */
export function getAllAvailableStrategies(): { builtIn: any[]; plugins: any[] } {
  const builtIn = strategyFactory.getBuiltInStrategies();
  const plugins = strategyFactory.getAvailablePlugins();
  
  return {
    builtIn,
    plugins
  };
}

/**
 * Search for strategies by name
 */
export function findStrategyByName(name: string): any | null {
  const builtIn = strategyFactory.getBuiltInStrategies()
    .find(s => s.name.toLowerCase().includes(name.toLowerCase()));
    
  const plugin = strategyFactory.getAvailablePlugins()
    .find(p => p.name.toLowerCase().includes(name.toLowerCase()));
    
  return builtIn || plugin || null;
}
