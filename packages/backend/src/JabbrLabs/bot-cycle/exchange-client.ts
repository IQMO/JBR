// Canonical import: use the main backend exchange client for all core logic
import { getExchangeClient as canonicalGetExchangeClient, BybitTradeType } from '../../utils/exchange-client';

// JabbrLabs wrapper: add any custom logging or enhancements here, but delegate to canonical
export async function getExchangeClient(tradeType: BybitTradeType = 'spot') {
  // Optionally add JabbrLabs-specific logging here
  // e.g., uiLogger.info(`[JabbrLabs] Delegating to canonical exchange-client`, LogCategory.API);
  return canonicalGetExchangeClient(tradeType);
}
