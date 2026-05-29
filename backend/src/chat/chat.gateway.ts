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

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    console.log('Conectado:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Desconectado:', client.id);
  }

  @SubscribeMessage('join_channel')
  handleJoin(@MessageBody() slug: string, @ConnectedSocket() client: Socket) {
    client.join(slug);
  }

  @SubscribeMessage('send_message')
  handleMessage(
    @MessageBody() payload: { channel: string; text: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload.text?.trim() || payload.text.length > 500) return;
    this.server.to(payload.channel).emit('new_message', {
      id: Date.now().toString(),
      username: payload.username,
      text: payload.text.trim(),
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToChannel(slug: string, data: any) {
    this.server.to(slug).emit('channel_event', data);
  }
}
