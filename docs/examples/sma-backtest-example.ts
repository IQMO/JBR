/**
 * Example backtesting script for the SMA crossover strategy
 * This demonstrates how to use the strategy backtesting framework
 */

import { downloadHistoricalData } from '../services/data-service';
import logger from '../services/logging.service';
import { StrategyBacktester, quickBacktest } from '../strategies/strategy-backtest';
import { strategyFactory } from '../strategies/strategy-factory';

/**
 * Run a backtest of the SMA crossover strategy with configurable parameters
 */
async function runSmaBacktest() {
  logger.info('Starting SMA Strategy Backtesting');
  
  try {
    // First, load or download historical data
    const startDate = new Date('2023-01-01').getTime();
    const endDate = new Date('2023-12-31').getTime();
    const symbol = 'BTC/USDT';
    const timeframe = '1h';
    
    logger.info(`Downloading historical data for ${symbol} (${timeframe}) from ${new Date(startDate).toISOString()} to ${new Date(endDate).toISOString()}`);
    
    const candles = await downloadHistoricalData(symbol, timeframe, startDate, endDate);
    
    if (!candles || candles.length === 0) {
      throw new Error('Failed to download historical data or no data available for the specified period');
    }
    
    logger.info(`Downloaded ${candles.length} candles`);
    
    // Configure the strategy parameters
    const strategyConfig = {
      type: 'sma-crossover',
      parameters: {
        symbol: 'BTC/USDT',
        fastPeriod: 20,
        slowPeriod: 50,
        signalThreshold: 0
      },
      riskManagement: {
        stopLossPercentage: 0.05, // 5% stop loss
        takeProfitPercentage: 0.15 // 15% take profit
      },
      execution: {
        timeframe: '1h',
        minimumConfidence: 0.6
      }
    };
    
    // Ensure the strategy is available
    const availableStrategies = await strategyFactory.getAvailablePlugins();
    const isSmaAvailable = availableStrategies.some(s => s.name.toLowerCase().includes('sma'));
    
    if (!isSmaAvailable) {
      logger.warn('SMA Crossover strategy not found in available plugins');
    }
    
    // Option 1: Quick backtest
    logger.info('Running quick backtest...');
    const quickResults = await quickBacktest(
      'sma-crossover',
      strategyConfig,
      candles,
      {
        initialCapital: 10000,
        fees: 0.001,
        slippage: 0.001
      }
    );
    
    logger.info('Quick backtest results:', {
      totalTrades: quickResults.totalTrades,
      winRate: `${(quickResults.winRate * 100).toFixed(2)  }%`,
      totalPnl: quickResults.totalPnl.toFixed(2),
      maxDrawdown: `${(quickResults.maxDrawdown * 100).toFixed(2)  }%`
    });
    
    // Option 2: Full control with StrategyBacktester
    logger.info('Running detailed backtest with multiple configurations...');
    
    // Test multiple parameter combinations
    const fastPeriods = [10, 20, 30];
    const slowPeriods = [40, 50, 60];
    
    const results = [];
    
    for (const fastPeriod of fastPeriods) {
      for (const slowPeriod of slowPeriods) {
        // Skip invalid combinations
        if (fastPeriod >= slowPeriod) {continue;}
        
        const config = {
          ...strategyConfig,
          parameters: {
            ...strategyConfig.parameters,
            fastPeriod,
            slowPeriod
          }
        };
        
        const backtester = new StrategyBacktester(candles, {
          initialCapital: 10000,
          fees: 0.001,
          slippage: 0.001,
          enableLogs: false // Disable detailed logs for parameter scanning
        });
        
        await backtester.loadStrategy('sma-crossover', config);
        const result = await backtester.runBacktest();
        
        results.push({
          fastPeriod,
          slowPeriod,
          totalPnl: result.totalPnl,
          winRate: result.winRate,
          profitFactor: result.profitFactor,
          maxDrawdown: result.maxDrawdown
        });
        
        logger.info(`Tested SMA(${fastPeriod},${slowPeriod}): PnL=${result.totalPnl.toFixed(2)}, Win=${(result.winRate * 100).toFixed(2)}%`);
      }
    }
    
    // Find best parameters
    results.sort((a, b) => b.totalPnl - a.totalPnl);
    const bestResult = results[0] || {
      fastPeriod: 0,
      slowPeriod: 0,
      totalPnl: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0
    };
    
    logger.info('Best parameters found:', {
      fastPeriod: bestResult.fastPeriod,
      slowPeriod: bestResult.slowPeriod,
      totalPnl: bestResult.totalPnl.toFixed(2),
      winRate: `${(bestResult.winRate * 100).toFixed(2)  }%`,
      profitFactor: bestResult.profitFactor.toFixed(2),
      maxDrawdown: `${(bestResult.maxDrawdown * 100).toFixed(2)  }%`
    });
    
    return {
      quickResults,
      parameterResults: results,
      bestParameters: {
        fastPeriod: bestResult.fastPeriod,
        slowPeriod: bestResult.slowPeriod
      }
    };
    
  } catch (error) {
    logger.error(`Backtest failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Execute the backtest if this file is run directly
if (require.main === module) {
  runSmaBacktest()
    .then(results => {
      logger.info('Backtest completed successfully');
    })
    .catch(error => {
      logger.error('Backtest failed with error:', { error });
      process.exit(1);
    });
}

export { runSmaBacktest };
