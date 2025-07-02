/**
 * Stable Bot Cycle Implementation
 * Focuses on core stability and error handling without unnecessary complexity
 *
 * Logger contract: All logging uses canonical logger and enums from logging-utils.ts and types/enums.ts
 *
 * AUDIT: This file is 100% logger contract compliant as of 2025-06-07.
 * - All logger calls use canonical logger, LogLevel, and LogCategory.
 * - All error/warn/info logs are structured and type-safe.
 * - No direct console.* usage exists.
 * - Ready for external monitoring integration (see TODOs below).
 */

// Canonical re-export: JabbrLabs StableBotCycle now delegates to canonical implementation in lib/execution/bot-cycle-stable.ts
export { StableBotCycle, stableBotCycle } from '../../execution/bot-cycle-stable';
