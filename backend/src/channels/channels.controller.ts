import { Controller, Get, Post, Param, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('channels')
export class ChannelsController {
  constructor(private prisma: PrismaService) {}

  @Get('live')
  getLive() {
    return this.prisma.channel.findMany({
      where: { isLive: true },
      include: { user: { select: { username: true } } },
    });
  }

  // me/* debe ir ANTES de :slug para que 'me' no sea tratado como slug
  @Get('me/stream-key')
  @UseGuards(JwtAuthGuard)
  async getMyStreamKey(@Request() req) {
    const channel = await this.prisma.channel.findUnique({
      where: { userId: req.user.id },
    });
    if (!channel) throw new NotFoundException('Canal no encontrado');
    return { streamKey: channel.streamKey };
  }

  @Post('me/reset-key')
  @UseGuards(JwtAuthGuard)
  async resetKey(@Request() req) {
    const updated = await this.prisma.channel.update({
      where: { userId: req.user.id },
      data: { streamKey: uuidv4() },
    });
    return { streamKey: updated.streamKey };
  }

  @Get(':slug')
  getChannel(@Param('slug') slug: string) {
    return this.prisma.channel.findUnique({
      where: { slug },
      include: { user: { select: { username: true } } },
    });
  }
}
