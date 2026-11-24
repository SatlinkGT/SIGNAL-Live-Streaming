import { Controller, Get, Post, Body, Param, BadRequestException, NotFoundException } from '@nestjs/common';
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
    return { channelId: channel.id, slug: channel.slug, inputProtocol: channel.inputProtocol };
  }

  // Internal ingest reconciliation; the public proxy blocks /streams/*.
  @Post('sync')
  async sync(@Body() body: { channels: { channelId: string; protocol: string }[] }) {
    if (!Array.isArray(body?.channels) || body.channels.length > 10000 ||
        body.channels.some((c) => !c || typeof c.channelId !== 'string' || !['rtmp', 'srt'].includes(c.protocol))) {
      throw new BadRequestException('Invalid snapshot');
    }
    const active = new Set(body.channels.map((c) => c.channelId));
    const channels = await this.prisma.channel.findMany({ select: { id: true, slug: true, isLive: true } });
    for (const channel of channels) {
      const isLive = active.has(channel.id);
      if (isLive === channel.isLive) continue;
      await this.prisma.channel.update({ where: { id: channel.id }, data: { isLive } });
      this.chatGateway.broadcastToChannel(channel.slug, { type: 'stream_status', isLive });
    }
    return { ok: true };
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
