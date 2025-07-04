/**
 * Aether Signal Generator - Utility Functions
 */

/**
 * Sigmoid function
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Normalized sigmoid function (range: -1 to 1)
 */
export function sigmoidNormalized(x: number): number {
  return 2 * sigmoid(x) - 1
}

/**
 * Normalized tanh function (range: -1 to 1)
 */
export function tanhNormalized(x: number): number {
  return Math.tanh(x)
}

/**
 * Exponential smoothing
 */
export function exponentialSmoothing(current: number, previous: number, alpha: number): number {
  return alpha * current + (1 - alpha) * previous
}

// --- TESTING HOOK: Deterministic mode for tests ---
let _aetherTestDeterministic = false;
let _aetherTestRandomValue = 0.0;
export function __setAetherDeterministicMode(enabled: boolean, randomValue = 0.0) {
  _aetherTestDeterministic = enabled;
  _aetherTestRandomValue = randomValue;
}

/**
 * Fractional Brownian motion simulation
 */
export function fractionalBrownianMotion(hurstExponent: number, steps: number): number[] {
  const result: number[] = [0]
  let value = 0
  for (let i = 1; i < steps; i++) {
    // Simple approximation of fBm
    const randomIncrement = ((_aetherTestDeterministic ? _aetherTestRandomValue : Math.random()) * 2 - 1) * Math.pow(1 / steps, hurstExponent)
    value += randomIncrement
    result.push(value)
  }
  return result
}

/**
 * Malliavin derivative approximation
 */
export function malliavinDerivative(orderBookImbalance: number, sensitivity: number, volatility: number): number {
  // Simple approximation of Malliavin derivative
  return sensitivity * orderBookImbalance * (1 + volatility)
}

/**
 * Mean-field interaction
 */
export function meanFieldInteraction(playerAction: number, averageAction: number, interactionStrength: number): number {
  // Simple mean-field interaction model
  return interactionStrength * playerAction + (1 - interactionStrength) * averageAction
}

/**
 * Reflected barrier
 */
export function reflectedBarrier(value: number, barrier: number): number {
  if (value < barrier) {
    return barrier + (barrier - value)
  }
  return value
}

// Patch for deterministic volatility term in ReflectedBSDE
export function getAetherRandom() {
  return _aetherTestDeterministic ? _aetherTestRandomValue : Math.random();
}