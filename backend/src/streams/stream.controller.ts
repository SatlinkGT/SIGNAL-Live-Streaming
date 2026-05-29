import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

@Controller('streams')
export class StreamsController {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
  ) {}

  // NMS llama este endpoint en el evento prePublish
  @Get('validate/:streamKey')
  async validate(@Param('streamKey') key: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { streamKey: key },
    });
    if (!channel) throw new NotFoundException('Stream key inválida');
    return { channelId: channel.id };
  }

  // NMS llama este endpoint en postPublish y donePublish
  @Post('webhook')
  async webhook(@Body() body: { streamKey: string; event: 'start' | 'end' }) {
    const channel = await this.prisma.channel.findUnique({
      where: { streamKey: body.streamKey },
    });
    if (!channel) return;
    await this.prisma.channel.update({
      where: { id: channel.id },
      data: { isLive: body.event === 'start' },
    });
    this.chatGateway.broadcastToChannel(channel.slug, {
      type: 'stream_status',
      isLive: body.event === 'start',
    });
  }
}
