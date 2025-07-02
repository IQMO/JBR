/**
 * Target Reacher Parameters
 * 
 * This module defines parameter interfaces and types for target reaching strategies.
 */

// Parameter configuration interfaces
export interface TargetReacherParameters {
  // Basic target parameters
  targetPrice?: number
  targetPercentage?: number
  maxTargets?: number
  
  // Timing parameters
  timeframe?: string
  duration?: number
  
  // Risk parameters
  maxRisk?: number
  riskTolerance?: 'low' | 'medium' | 'high'
  
  // Strategy parameters
  approach?: 'conservative' | 'aggressive' | 'balanced'
  rebalanceFrequency?: number
}

// Default parameter values
export const DEFAULT_TARGET_PARAMETERS: TargetReacherParameters = {
  targetPercentage: 5,
  maxTargets: 3,
  timeframe: '1h',
  duration: 24,
  maxRisk: 2,
  riskTolerance: 'medium',
  approach: 'balanced',
  rebalanceFrequency: 4
}

/**
 * Validate target reacher parameters
 * @param params Parameters to validate
 * @returns Validated parameters with defaults
 */
export function validateTargetParameters(params: Partial<TargetReacherParameters>): TargetReacherParameters {
  return {
    ...DEFAULT_TARGET_PARAMETERS,
    ...params
  }
}

/**
 * Calculate risk-adjusted parameters
 * @param baseParams Base parameters
 * @param riskLevel Risk adjustment level
 * @returns Risk-adjusted parameters
 */
export function adjustParametersForRisk(
  baseParams: TargetReacherParameters,
  riskLevel: number
): TargetReacherParameters {
  const riskMultiplier = Math.max(0.1, Math.min(2.0, riskLevel))
  
  return {
    ...baseParams,
    targetPercentage: (baseParams.targetPercentage || 5) * riskMultiplier,
    maxRisk: (baseParams.maxRisk || 2) / riskMultiplier
  }
}