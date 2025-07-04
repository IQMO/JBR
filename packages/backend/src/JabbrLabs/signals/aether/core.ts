/**
 * Aether Signal Generator - Core Implementation
 *
 * Advanced trading signal generator based on:
 * - Fractional Partial Differential Equations
 * - Reflected Backward Stochastic Differential Equations
 * - Mean-Field Game Theory
 * - Malliavin Calculus
 */

import {
  calculateSMA,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  getMASignals
} from '../../indicators';

import type { AetherParameters, MarketData, SignalOutput, SignalComponents } from "./models"
import { MarketRegime } from "./models"
import { DEFAULT_AETHER_PARAMETERS } from "./parameters"
import {
  sigmoidNormalized,
  tanhNormalized,
  exponentialSmoothing,
  fractionalBrownianMotion,
  malliavinDerivative,
  meanFieldInteraction,
  reflectedBarrier,
  getAetherRandom, // PATCH: deterministic test support
} from "./utils"
// Canonical indicators
// NOTE: Replace with canonical logger import for Jabbr Labs if needed
// import { logger } from "../../logging-utils"
// import { LogCategory } from '../../../types/enums'

export class AetherSignalGenerator {
  private parameters: AetherParameters
  private previousSignal = 0
  private marketHistory: MarketData[] = []

  constructor(parameters: AetherParameters = DEFAULT_AETHER_PARAMETERS) {
    this.parameters = parameters
  }

  /**
   * Calculate trading signal based on market data
   */
  calculateSignal(orderBookImbalance: number, volatility: number, crowdingScore: number, priceHistory: number[]): SignalOutput {
    // Input validation
    if (!Number.isFinite(orderBookImbalance) || !Number.isFinite(volatility) || !Number.isFinite(crowdingScore)) {
      throw new Error('Invalid market data: orderBookImbalance, volatility, and crowdingScore must be finite numbers');
    }
    
    if (!Array.isArray(priceHistory) || priceHistory.length === 0) {
      throw new Error('Invalid price history: must be a non-empty array');
    }
    
    if (!priceHistory.every(price => Number.isFinite(price))) {
      throw new Error('Invalid price history: all prices must be finite numbers');
    }
    
    const marketData: MarketData = {
      orderBookImbalance,
      volatility,
      crowdingScore,
      timestamp: Date.now(),
    }

    // logger.debug('Aether signal input data analysis', LogCategory.TRADING, {
    //   orderBookImbalance,
    //   volatility,
    //   crowdingScore,
    //   previousSignal: this.previousSignal
    // })

    // Add to market history
    this.marketHistory.push(marketData)
    if (this.marketHistory.length > 100) {
      this.marketHistory.shift()
    }

    // Calculate signal components
    const components = this.calculateSignalComponents(marketData, priceHistory)

    // logger.debug('Aether signal component analysis', LogCategory.TRADING, {
    //   fractionalPDE: components.fractionalPDE.toFixed(4),
    //   reflectedBSDE: components.reflectedBSDE.toFixed(4),
    //   meanFieldGame: components.meanFieldGame.toFixed(4),
    //   malliavinDerivative: components.malliavinDerivative.toFixed(4)
    // })

    // Combine components into final signal
    const rawSignal = this.combineSignalComponents(components)

    // Apply smoothing
    const smoothedSignal = exponentialSmoothing(rawSignal, this.previousSignal, 0.3)
    this.previousSignal = smoothedSignal

    // Determine market regime
    const regime = this.determineMarketRegime(marketData, smoothedSignal)

    // Calculate confidence
    const confidence = this.calculateConfidence(components, volatility)

    // const signalDirection = smoothedSignal > 0.6 ? 'STRONG BUY' : 
    //                        smoothedSignal > 0.1 ? 'WEAK BUY' : 
    //                        smoothedSignal < -0.6 ? 'STRONG SELL' : 
    //                        smoothedSignal < -0.1 ? 'WEAK SELL' : 'NEUTRAL'

    // logger.debug('Aether signal final output', LogCategory.TRADING, {
    //   rawSignal: rawSignal.toFixed(4),
    //   smoothedSignal: smoothedSignal.toFixed(4),
    //   signalDirection,
    //   confidence: confidence.toFixed(4),
    //   regime
    // })

    return {
      value: smoothedSignal,
      confidence,
      regime,
      timestamp: Date.now(),
      components,
    }
  }

  /**
   * Calculate individual signal components (now includes canonical indicators)
   */
  private calculateSignalComponents(marketData: MarketData, priceHistory: number[]): SignalComponents & {
    sma: number[];
    ema: number[];
    macd: number[];
    rsi: number[];
    maSignals: number[];
  } {
    // Canonical indicators (require sufficient data)
    const sma = priceHistory.length >= 20 ? calculateSMA(priceHistory, 20) : [];
    const ema = priceHistory.length >= 20 ? calculateEMA(priceHistory, 20) : [];
    // TODO: Fix MACD calculation indexing issue - temporarily disabled
    const macdResult = { macd: [], signal: [], histogram: [] };
    const rsi = priceHistory.length >= 14 ? calculateRSI(priceHistory, 14) : [];
    const maSignals = (sma.length && ema.length && sma.length === ema.length) ? getMASignals(ema, sma) : [];
    // Print indicator values for debugging
    console.log('Aether Indicators:', {
      sma: sma.slice(-3),
      ema: ema.slice(-3),
      macd: macdResult.macd.slice(-3),
      rsi: rsi.slice(-3),
      maSignals: maSignals.slice(-3)
    });
    // Original components
    const fractionalPDE = this.calculateFractionalPDE(marketData)
    const reflectedBSDE = this.calculateReflectedBSDE(marketData)
    const meanFieldGame = this.calculateMeanFieldGame(marketData)
    const malliavinDerivative = this.calculateMalliavinDerivative(marketData)
    return {
      fractionalPDE,
      reflectedBSDE,
      meanFieldGame,
      malliavinDerivative,
      sma,
      ema,
      macd: macdResult.macd,
      rsi,
      maSignals
    }
  }

  /**
   * Fractional PDE calculation
   */
  private calculateFractionalPDE(marketData: MarketData): number {
    const { hurstExponent, fractionalOrder, diffusionCoefficient } = this.parameters

    // Simulate fractional Brownian motion
    const fbm = fractionalBrownianMotion(hurstExponent, 10)
    const lastFbm = fbm.at(-1) ?? 0

    // Apply fractional differential operator
    const fractionalDiff = Math.pow(Math.abs(marketData.orderBookImbalance), fractionalOrder)

    // Combine with diffusion
    const signal = diffusionCoefficient * fractionalDiff * sigmoidNormalized(lastFbm)

    return tanhNormalized(signal)
  }

  /**
   * Reflected BSDE calculation
   */
  private calculateReflectedBSDE(marketData: MarketData): number {
    const { reflectionBarrier, driftCoefficient, volatilityScaling } = this.parameters

    // Calculate drift term
    const drift = driftCoefficient * marketData.orderBookImbalance

    // PATCH: Use deterministic random for tests
    const volatilityTerm = volatilityScaling * marketData.volatility * getAetherRandom()

    // Combine and apply reflection
    const rawValue = drift + volatilityTerm
    const reflected = reflectedBarrier(rawValue, -reflectionBarrier)

    return tanhNormalized(reflected)
  }

  /**
   * Mean-Field Game calculation
   */
  private calculateMeanFieldGame(marketData: MarketData): number {
    const { playerInteraction, socialOptimum, nashEquilibrium } = this.parameters

    // Calculate average market action (crowding score as proxy)
    const averageAction = marketData.crowdingScore

    // Calculate player action based on order book imbalance
    const playerAction = marketData.orderBookImbalance

    // Apply mean-field interaction
    const interaction = meanFieldInteraction(playerAction, averageAction, playerInteraction)

    // Balance between social optimum and Nash equilibrium
    const signal = socialOptimum * interaction + nashEquilibrium * (1 - interaction)

    return tanhNormalized(signal)
  }

  /**
   * Malliavin derivative calculation
   */
  private calculateMalliavinDerivative(marketData: MarketData): number {
    const { malliavinSensitivity, hedgingRatio, riskAversion } = this.parameters

    // Calculate Malliavin derivative
    const derivative = malliavinDerivative(marketData.orderBookImbalance, malliavinSensitivity, marketData.volatility)

    // Apply hedging ratio and risk aversion
    const hedgedSignal = (hedgingRatio * derivative) / riskAversion

    return tanhNormalized(hedgedSignal)
  }

  /**
   * Combine signal components
   */
  private combineSignalComponents(components: SignalComponents): number {
    const weights = {
      fractionalPDE: 0.3,
      reflectedBSDE: 0.25,
      meanFieldGame: 0.25,
      malliavinDerivative: 0.2,
    }

    return (
      weights.fractionalPDE * components.fractionalPDE +
      weights.reflectedBSDE * components.reflectedBSDE +
      weights.meanFieldGame * components.meanFieldGame +
      weights.malliavinDerivative * components.malliavinDerivative
    )
  }

  /**
   * Determine market regime
   */
  private determineMarketRegime(marketData: MarketData, signal: number): MarketRegime {
    const { volatility, orderBookImbalance } = marketData

    if (volatility > 0.03) {
      return MarketRegime.VOLATILE
    } else if (volatility < 0.01) {
      return MarketRegime.CALM
    } else if (signal > 0.3 && orderBookImbalance > 0.1) {
      return MarketRegime.BULLISH
    } else if (signal < -0.3 && orderBookImbalance < -0.1) {
      return MarketRegime.BEARISH
    } 
      return MarketRegime.SIDEWAYS
    
  }

  /**
   * Calculate signal confidence
   */
  private calculateConfidence(components: SignalComponents, volatility: number): number {
    // Calculate component agreement
    const componentValues = Object.values(components).filter(val => Number.isFinite(val))
    
    if (componentValues.length === 0) {
      return 0.1; // Minimum confidence if no valid components
    }
    
    const mean = componentValues.reduce((sum, val) => sum + val, 0) / componentValues.length
    const variance = componentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / componentValues.length

    // Lower variance = higher confidence
    const agreementConfidence = Number.isFinite(variance) ? 1 / (1 + variance) : 0.1

    // Lower volatility = higher confidence
    const volatilityConfidence = Number.isFinite(volatility) ? 1 / (1 + volatility * 10) : 0.1

    // Combine confidences
    const rawConfidence = (agreementConfidence + volatilityConfidence) / 2

    return Math.max(0.1, Math.min(1.0, Number.isFinite(rawConfidence) ? rawConfidence : 0.1))
  }

  /**
   * Update parameters
   */
  updateParameters(newParameters: Partial<AetherParameters>): void {
    this.parameters = { ...this.parameters, ...newParameters }
  }

  /**
   * Get current parameters
   */
  getParameters(): AetherParameters {
    return { ...this.parameters }
  }

  /**
   * Reset signal history
   */
  reset(): void {
    this.previousSignal = 0
    this.marketHistory = []
  }
}
