import { BaseExchange, MarketType, OrderRequest, OrderResponse, MarketData, PositionInfo, AccountBalance, ExchangeCapabilities } from './base-exchange';
import type { Exchange, TradeSide, ExchangeApiKey } from '@jabbr/shared';
export declare class BybitExchange extends BaseExchange {
    private client;
    private wsConnections;
    private subscriptions;
    constructor(apiKey: ExchangeApiKey, isTestnet?: boolean);
    getName(): Exchange;
    getCapabilities(): ExchangeCapabilities;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    testConnection(): Promise<boolean>;
    getMarketData(symbol: string, marketType: MarketType): Promise<MarketData>;
    getOrderBook(symbol: string, marketType: MarketType, depth?: number): Promise<{
        bids: [number, number][];
        asks: [number, number][];
        timestamp: Date;
    }>;
    getRecentTrades(symbol: string, _marketType: MarketType, limit?: number): Promise<{
        id: string;
        price: number;
        amount: number;
        side: TradeSide;
        timestamp: Date;
    }[]>;
    getKlines(symbol: string, interval: string, _marketType: MarketType, startTime?: Date, endTime?: Date, limit?: number): Promise<{
        timestamp: Date;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }[]>;
    getServerTime(): Promise<Date>;
    protected formatSymbol(symbol: string, marketType: MarketType): string;
    protected parseSymbol(exchangeSymbol: string, marketType: MarketType): string;
    placeOrder(orderRequest: OrderRequest): Promise<OrderResponse>;
    cancelOrder(orderId: string, symbol: string, marketType: MarketType): Promise<boolean>;
    cancelAllOrders(symbol?: string, marketType?: MarketType): Promise<boolean>;
    getOrder(orderId: string, symbol: string, marketType: MarketType): Promise<OrderResponse>;
    getOpenOrders(symbol?: string, marketType?: MarketType): Promise<OrderResponse[]>;
    getOrderHistory(symbol: string, marketType: MarketType, since?: Date): Promise<OrderResponse[]>;
    getPositions(symbol?: string): Promise<PositionInfo[]>;
    setLeverage(symbol: string, leverage: number, _marketType?: MarketType): Promise<boolean>;
    setMarginMode(symbol: string, mode: 'isolated' | 'cross'): Promise<boolean>;
    setPositionMode(mode: 'one-way' | 'hedge'): Promise<boolean>;
    getBalance(_marketType?: MarketType): Promise<AccountBalance[]>;
    getTradingFees(symbol?: string, _marketType?: MarketType): Promise<{
        maker: number;
        taker: number;
    }>;
    subscribeToMarketData(symbol: string, marketType: MarketType): Promise<void>;
    unsubscribeFromMarketData(symbol: string, marketType: MarketType): Promise<void>;
    subscribeToOrderUpdates(): Promise<void>;
    subscribeToPositionUpdates(): Promise<void>;
    private mapOrderStatus;
}
export default BybitExchange;
//# sourceMappingURL=bybit-exchange.d.ts.map