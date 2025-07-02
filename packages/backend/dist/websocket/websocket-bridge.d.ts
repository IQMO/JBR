import { EventEmitter } from 'events';
import JabbrWebSocketServer from './websocket-server';
export declare class WebSocketBridge extends EventEmitter {
    private wsServer;
    private bybitClient;
    private subscriptions;
    private isInitialized;
    constructor(wsServer: JabbrWebSocketServer);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    private setupInternalServerHandlers;
    private setupBybitHandlers;
    private handleMarketData;
    private handleTickerData;
    private handleTradeData;
    private handleOrderbookData;
    private handleKlineData;
    subscribeToMarketData(symbol: string, exchange?: string): Promise<void>;
    unsubscribeFromMarketData(symbol: string, exchange?: string): Promise<void>;
    subscribeToKlineData(symbol: string, interval?: string, exchange?: string): Promise<void>;
    private broadcastSystemHealth;
    private broadcastError;
    getStats(): {
        initialized: boolean;
        exchanges: Record<string, any>;
        subscriptions: number;
        activeSubscriptions: string[];
    };
    handleClientSubscription(channel: string, symbol?: string, exchange?: string): Promise<void>;
    handleClientUnsubscription(channel: string, symbol?: string, exchange?: string): Promise<void>;
    testConnections(): Promise<Record<string, boolean>>;
    subscribeToPopularPairs(): Promise<void>;
}
export default WebSocketBridge;
//# sourceMappingURL=websocket-bridge.d.ts.map