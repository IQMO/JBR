/**
 * Aether Signal Generator - Default Parameters
 */

import type { AetherParameters } from "./models"

export const DEFAULT_AETHER_PARAMETERS: AetherParameters = {
  // Fractional PDE parameters
  hurstExponent: 0.65, // Persistence in price process
  fractionalOrder: 0.5, // Order of fractional derivative
  diffusionCoefficient: 2.0, // Scaling factor for diffusion

  // Reflected BSDE parameters
  reflectionBarrier: 0.8, // Reflection barrier for signal
  driftCoefficient: 1.5, // Drift coefficient
  volatilityScaling: 3.0, // Volatility scaling factor

  // Mean-Field Game parameters
  playerInteraction: 0.7, // Strength of player interaction
  socialOptimum: 0.6, // Weight for social optimum
  nashEquilibrium: 0.4, // Weight for Nash equilibrium

  // Malliavin Calculus parameters
  malliavinSensitivity: 0.3, // Sensitivity to market microstructure
  hedgingRatio: 0.5, // Hedging ratio
  riskAversion: 2.0, // Risk aversion coefficient
}

export const CONSERVATIVE_PARAMETERS: AetherParameters = {
  ...DEFAULT_AETHER_PARAMETERS,
  hurstExponent: 0.75, // More persistence
  malliavinSensitivity: 0.2, // Less sensitive
  riskAversion: 4.0, // More risk averse
  volatilityScaling: 2.0, // Less volatile
}

export const AGGRESSIVE_PARAMETERS: AetherParameters = {
  ...DEFAULT_AETHER_PARAMETERS,
  hurstExponent: 0.55, // Less persistence
  malliavinSensitivity: 0.4, // More sensitive
  riskAversion: 1.0, // Less risk averse
  volatilityScaling: 4.0, // More volatile
}
