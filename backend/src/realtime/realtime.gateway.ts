import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { AUTH_COOKIE } from '../common/constants.js';
import { readCookie } from '../common/utils/cookies.js';
import { Room, SocketEvent } from './realtime.events.js';

/**
 * Delivery only: every emit happens after the database write it describes.
 * Clients refetch state over REST on (re)connect, so a missed event is never
 * fatal.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly auth: AuthService) {}

  afterInit(server: Server) {
    // Runs before the connection is accepted: unauthorized sockets get a
    // connect_error and Socket.IO does not retry them automatically.
    server.use((socket, next) => {
      this.resolveRoom(socket)
        .then((room) => {
          if (!room) return next(new Error('unauthorized'));
          (socket.data as { room: Room }).room = room;
          next();
        })
        .catch((error: unknown) => {
          this.logger.error('Socket authentication failed', error);
          next(new Error('unauthorized'));
        });
    });
  }

  async handleConnection(socket: Socket) {
    await socket.join((socket.data as { room: Room }).room);
  }

  private async resolveRoom(socket: Socket): Promise<Room | null> {
    const auth = socket.handshake.auth as { room?: unknown; token?: unknown };
    // The presentation screen is public and read-only.
    if (auth.room === Room.PRESENTATION) return Room.PRESENTATION;

    const token =
      readCookie(socket.handshake.headers.cookie, AUTH_COOKIE) ??
      (typeof auth.token === 'string' ? auth.token : undefined);
    const user = token ? await this.auth.verifyToken(token) : null;
    if (!user) return null;
    return user.role === 'MODERATOR' ? Room.MODERATOR : Room.HOST;
  }

  emit(rooms: Room | Room[], event: SocketEvent, payload: unknown = {}) {
    this.server.to(rooms).emit(event, payload);
  }
}
