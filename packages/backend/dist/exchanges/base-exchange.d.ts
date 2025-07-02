import { EventEmitter } from 'events';
import type { Exchange, TradeSide, TradeType, TradeStatus, ExchangeApiKey } from '@jabbr/shared';
export declare enum MarketType {
    SPOT = "spot",
    FUTURES = "futures",
    OPTIONS = "options"
}
export interface OrderRequest {
    symbol: string;
    side: TradeSide;
    type: TradeType;
    amount: number;
    price?: number;
    leverage?: number;
    reduceOnly?: boolean;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    clientOrderId?: string;
    stopPrice?: number;
    marketType: MarketType;
}
export interface OrderResponse {
    orderId: string;
    clientOrderId?: string;
    symbol: string;
    side: TradeSide;
    type: TradeType;
    amount: number;
    price?: number;
    filled: number;
    remaining: number;
    status: TradeStatus;
    fee: number;
    timestamp: Date;
    marketType: MarketType;
}
export interface MarketData {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    volume: number;
    change24h: number;
    high24h: number;
    low24h: number;
    timestamp: Date;
    marketType: MarketType;
}
export interface PositionInfo {
    symbol: string;
    side: TradeSide;
    size: number;
    entryPrice: number;
    markPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    leverage: number;
    margin: number;
    marginMode: 'isolated' | 'cross';
    liquidationPrice?: number;
    timestamp: Date;
    marketType: MarketType;
}
export interface AccountBalance {
    currency: string;
    total: number;
    available: number;
    locked: number;
    marketType: MarketType;
}
export interface ExchangeCapabilities {
    spot: boolean;
    futures: boolean;
    options: boolean;
    margin: boolean;
    maxLeverage: {
        spot: number;
        futures: number;
    };
    supportedOrderTypes: TradeType[];
    supportedTimeframes: string[];
    rateLimits: {
        requests: number;
        window: number;
    };
}
export declare abstract class BaseExchange extends EventEmitter {
    protected apiKey: ExchangeApiKey;
    protected isTestnet: boolean;
    protected isConnected: boolean;
    protected rateLimitCounter: Map<string, number>;
    constructor(apiKey: ExchangeApiKey, isTestnet?: boolean);
    abstract getName(): Exchange;
    abstract getCapabilities(): ExchangeCapabilities;
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract testConnection(): Promise<boolean>;
    abstract getMarketData(symbol: string, marketType: MarketType): Promise<MarketData>;
    abstract getOrderBook(symbol: string, marketType: MarketType, depth?: number): Promise<{
        bids: [number, number][];
        asks: [number, number][];
        timestamp: Date;
    }>;
    abstract getRecentTrades(symbol: string, marketType: MarketType, limit?: number): Promise<{
        id: string;
        price: number;
        amount: number;
        side: TradeSide;
        timestamp: Date;
    }[]>;
    abstract getKlines(symbol: string, interval: string, marketType: MarketType, startTime?: Date, endTime?: Date, limit?: number): Promise<{
        timestamp: Date;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }[]>;
    abstract placeOrder(orderRequest: OrderRequest): Promise<OrderResponse>;
    abstract cancelOrder(orderId: string, symbol: string, marketType: MarketType): Promise<boolean>;
    abstract cancelAllOrders(symbol?: string, marketType?: MarketType): Promise<boolean>;
    abstract getOrder(orderId: string, symbol: string, marketType: MarketType): Promise<OrderResponse>;
    abstract getOpenOrders(symbol?: string, marketType?: MarketType): Promise<OrderResponse[]>;
    abstract getOrderHistory(symbol?: string, marketType?: MarketType, startTime?: Date, endTime?: Date, limit?: number): Promise<OrderResponse[]>;
    abstract getPositions(symbol?: string): Promise<PositionInfo[]>;
    abstract setLeverage(symbol: string, leverage: number): Promise<boolean>;
    abstract setMarginMode(symbol: string, mode: 'isolated' | 'cross'): Promise<boolean>;
    abstract setPositionMode(mode: 'one-way' | 'hedge'): Promise<boolean>;
    abstract getBalance(marketType?: MarketType): Promise<AccountBalance[]>;
    abstract getTradingFees(symbol?: string, marketType?: MarketType): Promise<{
        maker: number;
        taker: number;
    }>;
    isConnectedToExchange(): boolean;
    isTestnetMode(): boolean;
    protected checkRateLimit(endpoint: string): boolean;
    protected validateOrderRequest(orderRequest: OrderRequest): void;
    protected abstract formatSymbol(symbol: string, marketType: MarketType): string;
    protected abstract parseSymbol(exchangeSymbol: string, marketType: MarketType): string;
    abstract getServerTime(): Promise<Date>;
    abstract subscribeToMarketData(symbol: string, marketType: MarketType): Promise<void>;
    abstract unsubscribeFromMarketData(symbol: string, marketType: MarketType): Promise<void>;
    abstract subscribeToOrderUpdates(): Promise<void>;
    abstract subscribeToPositionUpdates(): Promise<void>;
}
export default BaseExchange;
//# sourceMappingURL=base-exchange.d.ts.map