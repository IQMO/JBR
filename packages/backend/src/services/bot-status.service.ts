
import { CONSTANTS } from '@jabbr/shared';

import type { JabbrWebSocketServer } from '../websocket/websocket-server';

class BotStatusService {
  private wsServer: JabbrWebSocketServer;

  constructor(wsServer: JabbrWebSocketServer) {
    this.wsServer = wsServer;
  }

  public broadcastBotStatus(botId: string, status: any): void {
    this.wsServer.broadcast(CONSTANTS.WS_CHANNELS.BOT_STATUS, {
      botId,
      ...status,
    });
  }
}

export default BotStatusService;
