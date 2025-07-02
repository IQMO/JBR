/**
 * Aether Signal Generator - Type Definitions
 */

export interface MarketData {
  orderBookImbalance: number // Range: -1 to 1
  volatility: number // Range: 0 to 1
  crowdingScore: number // Range: -1 to 1
  timestamp: number
}

export interface SignalComponents {
  fractionalPDE: number // Range: -1 to 1
  reflectedBSDE: number // Range: -1 to 1
  meanFieldGame: number // Range: -1 to 1
  malliavinDerivative: number // Range: -1 to 1
}

export enum MarketRegime {
  BULLISH = "BULLISH",
  BEARISH = "BEARISH",
  VOLATILE = "VOLATILE",
  SIDEWAYS = "SIDEWAYS",
  CALM = "CALM",
}

export interface SignalOutput {
  value: number // Range: -1 to 1
  confidence: number // Range: 0 to 1
  regime: MarketRegime
  timestamp: number
  components: SignalComponents
}

export interface AetherParameters {
  // Fractional PDE parameters
  hurstExponent: number // Range: 0 to 1
  fractionalOrder: number // Range: 0 to 2
  diffusionCoefficient: number // Range: 0 to 10

  // Reflected BSDE parameters
  reflectionBarrier: number // Range: 0 to 1
  driftCoefficient: number // Range: 0 to 10
  volatilityScaling: number // Range: 0 to 10

  // Mean-Field Game parameters
  playerInteraction: number // Range: 0 to 1
  socialOptimum: number // Range: 0 to 1
  nashEquilibrium: number // Range: 0 to 1

  // Malliavin Calculus parameters
  malliavinSensitivity: number // Range: 0 to 1
  hedgingRatio: number // Range: 0 to 1
  riskAversion: number // Range: 0.1 to 10
}
