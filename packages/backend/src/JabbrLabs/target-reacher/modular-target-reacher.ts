/**
 * Modular Target Reacher
 * 
 * This module provides modular components for target reaching strategies.
 * It works in conjunction with the main target-reacher implementation.
 */

// Re-export the main target reacher for compatibility
export { ModularTargetReacherStrategy as TargetReacher } from './target-reacher'

// Modular components for target reaching
export interface ModularTargetConfig {
  // Target configuration
  targetPrice?: number
  targetPercentage?: number
  timeframe?: string
  
  // Risk management
  maxDrawdown?: number
  stopLoss?: number
  
  // Strategy parameters
  aggressiveness?: 'conservative' | 'moderate' | 'aggressive'
}

/**
 * Modular Target Reacher Component
 * Provides configurable target reaching functionality
 */
export class ModularTargetReacher {
  private readonly config: ModularTargetConfig
  
  constructor(config: ModularTargetConfig = {}) {
    this.config = {
      aggressiveness: 'moderate',
      maxDrawdown: 5,
      ...config
    }
  }
    /**
   * Calculate target metrics based on current market conditions and configuration
   */
  calculateTargets(currentPrice?: number, marketData?: any): ModularTargetConfig {
    const baseConfig = { ...this.config };
    
    if (currentPrice && !baseConfig.targetPrice && baseConfig.targetPercentage) {
      // Calculate target price from percentage
      baseConfig.targetPrice = currentPrice * (1 + (baseConfig.targetPercentage / 100));
    }
    
    // Adjust targets based on aggressiveness
    switch (baseConfig.aggressiveness) {
      case 'conservative':
        baseConfig.maxDrawdown = Math.min(baseConfig.maxDrawdown ?? 5, 3);
        baseConfig.stopLoss = baseConfig.stopLoss ?? 2;
        break;
      case 'aggressive':
        baseConfig.maxDrawdown = Math.max(baseConfig.maxDrawdown ?? 5, 10);
        baseConfig.stopLoss = baseConfig.stopLoss ?? 8;
        break;
      default: // moderate
        baseConfig.maxDrawdown = baseConfig.maxDrawdown ?? 5;
        baseConfig.stopLoss = baseConfig.stopLoss ?? 5;
    }
    
    // Adjust for market volatility if available
    if (marketData?.volatility) {
      const volatilityMultiplier = Math.min(1.5, 1 + marketData.volatility);
      baseConfig.stopLoss = (baseConfig.stopLoss ?? 5) * volatilityMultiplier;
    }
    
    return baseConfig;
  }
  
  /**
   * Apply modular strategy based on current position and market conditions
   */
  async applyStrategy(position?: any, marketData?: any): Promise<{ action: string; confidence: number; reason: string }> {
    const targets = this.calculateTargets(position?.currentPrice, marketData);
    
    if (!position || !targets.targetPrice) {
      return { 
        action: 'hold', 
        confidence: 0.5, 
        reason: 'Insufficient data for strategy application' 
      };
    }
    
    const currentPrice = position.currentPrice ?? position.markPrice ?? 0;
    const entryPrice = position.entryPrice ?? currentPrice;
    
    // Calculate current performance
    const currentReturn = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Check if target is reached
    if (targets.targetPrice && currentPrice >= targets.targetPrice) {
      return { 
        action: 'close', 
        confidence: 0.9, 
        reason: `Target price ${targets.targetPrice} reached at ${currentPrice}` 
      };
    }
    
    // Check stop loss
    if (targets.stopLoss && currentReturn <= -(targets.stopLoss)) {
      return { 
        action: 'close', 
        confidence: 0.8, 
        reason: `Stop loss triggered at ${currentReturn.toFixed(2)}%` 
      };
    }
    
    // Check max drawdown
    if (targets.maxDrawdown && currentReturn <= -(targets.maxDrawdown)) {
      return { 
        action: 'reduce', 
        confidence: 0.7, 
        reason: `Max drawdown reached at ${currentReturn.toFixed(2)}%` 
      };
    }
    
    // Continue holding if within acceptable range
    return { 
      action: 'hold', 
      confidence: 0.6, 
      reason: `Position performing within parameters (${currentReturn.toFixed(2)}%)` 
    };
  }
}