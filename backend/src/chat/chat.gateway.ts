import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const currentMidnight = () => Math.floor(Date.now() / DAY_MS) * DAY_MS;
const messageFields = { id: true, username: true, text: true, timestamp: true } as const;

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.cleanExpiredMessages();
  }

  onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.cleanupTimer);
  }

  private async cleanExpiredMessages() {
    const midnight = currentMidnight();
    let nextCleanup = midnight + DAY_MS;
    try {
      await this.prisma.chatMessage.deleteMany({
        where: { timestamp: { lt: new Date(midnight) } },
      });
    } catch (error) {
      this.logger.error('Could not remove expired chat messages', error);
      nextCleanup = Date.now() + 60_000;
    }
    if (!this.stopped) {
      this.cleanupTimer = setTimeout(
        () => void this.cleanExpiredMessages(),
        Math.max(0, nextCleanup - Date.now()),
      );
    }
  }

  handleConnection(client: Socket) {
    console.log('Conectado:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Desconectado:', client.id);
  }

  @SubscribeMessage('join_channel')
  async handleJoin(@MessageBody() slug: string, @ConnectedSocket() client: Socket) {
    if (typeof slug !== 'string' || !slug) return;
    await client.join(slug);
    const messages = await this.prisma.chatMessage.findMany({
      where: { channelSlug: slug, timestamp: { gte: new Date(currentMidnight()) } },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      select: messageFields,
    });
    client.emit('chat_history', messages);
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() payload: { channel: string; text: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (
      typeof payload?.text !== 'string' || !payload.text.trim() || payload.text.length > 500 ||
      typeof payload.channel !== 'string' || !client.rooms.has(payload.channel) ||
      typeof payload.username !== 'string'
    ) return;

    const channel = await this.prisma.channel.findUnique({
      where: { slug: payload.channel },
      select: { slug: true },
    });
    if (!channel) return;

    const message = await this.prisma.chatMessage.create({
      data: {
        channelSlug: channel.slug,
        username: payload.username,
        text: payload.text.trim(),
      },
      select: messageFields,
    });
    this.server.to(channel.slug).emit('new_message', message);
  }

  broadcastToChannel(slug: string, data: any) {
    this.server.to(slug).emit('channel_event', data);
  }
}
