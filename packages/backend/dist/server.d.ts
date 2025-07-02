declare class JabbrServer {
    private app;
    private httpServer;
    private wsServer;
    private wsBridge;
    private isShuttingDown;
    private readonly PORT;
    private readonly WS_PORT;
    private readonly FRONTEND_URL;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    private setupGracefulShutdown;
    initialize(): Promise<void>;
    start(): Promise<void>;
    private setupTimeSyncBroadcasting;
    private gracefulShutdown;
    getStats(): any;
}
declare const server: JabbrServer;
export default server;
//# sourceMappingURL=server.d.ts.map