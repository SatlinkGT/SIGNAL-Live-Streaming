import { Controller, Get, Post, Body, BadRequestException, ConflictException, Param, UseGuards, Request, NotFoundException } from '@nestjs/common';
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
      select: { id: true, slug: true, title: true, logoUrl: true, isLive: true, user: { select: { username: true } } },
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
    return { streamKey: channel.streamKey, title: channel.title, logoUrl: channel.logoUrl, inputProtocol: channel.inputProtocol };
  }

  @Post('me/title')
  @UseGuards(JwtAuthGuard)
  async updateTitle(@Request() req, @Body() body: { title?: string }) {
    if (typeof body?.title !== 'string' || !body.title.trim() || body.title.trim().length > 100) {
      throw new BadRequestException('El nombre debe tener entre 1 y 100 caracteres.');
    }
    const channel = await this.prisma.channel.findUnique({ where: { userId: req.user.id } });
    if (!channel) throw new NotFoundException('Canal no encontrado');
    return this.prisma.channel.update({
      where: { userId: req.user.id },
      data: { title: body.title.trim() },
      select: { title: true },
    });
  }

  @Post('me/input')
  @UseGuards(JwtAuthGuard)
  async selectInput(@Request() req, @Body() body: { inputProtocol: string }) {
    if (!body || !['rtmp', 'srt'].includes(body.inputProtocol)) {
      throw new BadRequestException('Selecciona RTMP o SRT.');
    }
    const channel = await this.prisma.channel.findUnique({ where: { userId: req.user.id } });
    if (!channel) throw new NotFoundException('Canal no encontrado');
    if (channel.inputProtocol === body.inputProtocol) return { inputProtocol: channel.inputProtocol };
    // Conditional write also prevents changing the input while a live state is being set.
    const updated = await this.prisma.channel.updateMany({
      where: { id: channel.id, isLive: false },
      data: { inputProtocol: body.inputProtocol },
    });
    if (!updated.count) throw new ConflictException('Detén la señal actual antes de cambiar el protocolo de entrada.');
    return { inputProtocol: body.inputProtocol };
  }

  @Post('me/logo')
  @UseGuards(JwtAuthGuard)
  async updateLogo(@Request() req, @Body() body: { logoUrl?: string | null }) {
    const logo = body?.logoUrl;
    if (logo !== null) {
      if (typeof logo !== 'string' || logo.length > 210000 ||
          !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(logo)) {
        throw new BadRequestException('El logo debe ser una imagen PNG de hasta 150 KB.');
      }
      const image = Buffer.from(logo.split(',')[1], 'base64');
      if (image.length < 33 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
          image.toString('ascii', 12, 16) !== 'IHDR' ||
          image.readUInt32BE(16) < 1 || image.readUInt32BE(16) > 192 ||
          image.readUInt32BE(20) < 1 || image.readUInt32BE(20) > 192) {
        throw new BadRequestException('Imagen de logo inválida.');
      }
    }
    const channel = await this.prisma.channel.update({
      where: { userId: req.user.id },
      data: { logoUrl: logo },
      select: { logoUrl: true },
    });
    return channel;
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
      select: { id: true, slug: true, title: true, logoUrl: true, isLive: true, user: { select: { username: true } } },
    });
  }
}
