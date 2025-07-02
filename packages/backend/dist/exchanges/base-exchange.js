"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseExchange = exports.MarketType = void 0;
const events_1 = require("events");
var MarketType;
(function (MarketType) {
    MarketType["SPOT"] = "spot";
    MarketType["FUTURES"] = "futures";
    MarketType["OPTIONS"] = "options";
})(MarketType || (exports.MarketType = MarketType = {}));
class BaseExchange extends events_1.EventEmitter {
    apiKey;
    isTestnet;
    isConnected = false;
    rateLimitCounter = new Map();
    constructor(apiKey, isTestnet = true) {
        super();
        this.apiKey = apiKey;
        this.isTestnet = isTestnet;
    }
    isConnectedToExchange() {
        return this.isConnected;
    }
    isTestnetMode() {
        return this.isTestnet;
    }
    checkRateLimit(endpoint) {
        const now = Date.now();
        const windowStart = now - this.getCapabilities().rateLimits.window;
        const key = `${endpoint}_${Math.floor(now / this.getCapabilities().rateLimits.window)}`;
        const count = this.rateLimitCounter.get(key) || 0;
        if (count >= this.getCapabilities().rateLimits.requests) {
            return false;
        }
        this.rateLimitCounter.set(key, count + 1);
        for (const [k] of this.rateLimitCounter.entries()) {
            const keyParts = k.split('_');
            const timestampStr = keyParts[1];
            if (timestampStr && parseInt(timestampStr) < windowStart) {
                this.rateLimitCounter.delete(k);
            }
        }
        return true;
    }
    validateOrderRequest(orderRequest) {
        if (!orderRequest.symbol) {
            throw new Error('Symbol is required');
        }
        if (!orderRequest.side) {
            throw new Error('Side is required');
        }
        if (!orderRequest.type) {
            throw new Error('Order type is required');
        }
        if (!orderRequest.amount || orderRequest.amount <= 0) {
            throw new Error('Amount must be positive');
        }
        if (orderRequest.type === 'limit' && (!orderRequest.price || orderRequest.price <= 0)) {
            throw new Error('Price is required for limit orders');
        }
        const capabilities = this.getCapabilities();
        if (orderRequest.marketType === MarketType.SPOT && !capabilities.spot) {
            throw new Error('Spot trading not supported');
        }
        if (orderRequest.marketType === MarketType.FUTURES && !capabilities.futures) {
            throw new Error('Futures trading not supported');
        }
        if (orderRequest.leverage) {
            const maxLeverage = orderRequest.marketType === MarketType.SPOT
                ? capabilities.maxLeverage.spot
                : capabilities.maxLeverage.futures;
            if (orderRequest.leverage > maxLeverage) {
                throw new Error(`Leverage cannot exceed ${maxLeverage}x for ${orderRequest.marketType}`);
            }
        }
        if (!capabilities.supportedOrderTypes.includes(orderRequest.type)) {
            throw new Error(`Order type ${orderRequest.type} not supported`);
        }
    }
}
exports.BaseExchange = BaseExchange;
exports.default = BaseExchange;
//# sourceMappingURL=base-exchange.js.map