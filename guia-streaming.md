# 🎮 Guía Completa: Plataforma de Streaming Estilo Twitch

> Node Media Server 4.2 · NestJS 11 · Node.js 24 LTS · Prisma · Socket.IO 4.8 · HLS.js 1.6 · React Native CLI · Docker — Mayo 2026

---

## Versiones verificadas

| Tecnología | Versión y notas |
|---|---|
| Node.js | 24.x LTS — soporte hasta Abril 2028 |
| NestJS | 11.1.x — JSON logging nativo, ParseDatePipe, startup más rápido |
| node-media-server | 4.2.4 — **INCOMPATIBLE con v2**. Esta guía usa v4. |
| Prisma ORM | 7.x — recomendado sobre TypeORM en 2026. **v7 requiere driver adapter para PostgreSQL.** |
| Socket.IO | 4.8.3 — sin cambios de protocolo desde v4 |
| hls.js | 1.6.16 — soporte iOS 17.1+ vía Managed Media Source |
| React Native | 0.85 — New Architecture obligatoria, sin Bridge |
| react-native-video | v6 estable — v5 es EOL, v7 en beta |
| Docker Compose | v2 — comando: `docker compose` (sin guión) |
| PostgreSQL | 16.x — imagen `postgres:16-alpine` |
| Redis | 7.x — imagen `redis:7-alpine` |

> ⚠️ **Atención:** node-media-server v4 es incompatible con v2. Cualquier tutorial con código de v2 no funcionará con esta guía.

---

## Introducción

Construirás una plataforma de streaming en vivo completa similar a Twitch, corriendo en tu propia infraestructura sin servicios de video de pago.

### Estructura de carpetas del proyecto

Créala antes de empezar cualquier parte:

```
StremingServiceAppNWeb/            ← raíz del proyecto
├── docker-compose.yml             ← compose principal (se crea al terminar Parte 2)
├── rtmp-server/                   ← Parte 1
│   ├── src/index.js
│   ├── streams/
│   ├── Dockerfile
│   └── package.json
├── backend/                       ← Parte 2
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   └── .env
├── web/                           ← Parte 3
└── mobile/                        ← Parte 4
```

### Flujo completo cuando todo está listo

1. OBS envía el stream RTMP al servidor en el puerto 1935 usando la stream key.
2. NMS valida la stream key contra el backend. Si es válida, acepta el stream.
3. FFmpeg convierte el RTMP a segmentos HLS (.ts) y genera el playlist .m3u8.
4. NMS notifica al backend vía webhook que el canal está en vivo.
5. El backend actualiza la base de datos y avisa a los viewers por WebSocket.
6. Los viewers reproducen el .m3u8 con hls.js (web) o react-native-video (móvil).
7. El chat fluye en tiempo real vía Socket.IO entre todos los participantes.
8. Cuando el streamer detiene OBS, el backend pone isLive=false y notifica a los viewers.

### Prerrequisitos

- Node.js 24 LTS — nodejs.org/en/download
- Docker Desktop — docker.com/products/docker-desktop
- OBS Studio — obsproject.com
- VS Code o cualquier editor

---

# Parte 1 — Servidor RTMP con Node Media Server 4.2

## ¿Qué hace esta parte?

Configuras el servidor que recibe el video de OBS por RTMP y lo convierte a segmentos HLS que los browsers y apps pueden reproducir. En esta parte **no conectas nada con el backend todavía** — eso viene en la Parte 2.

## ¿Qué es RTMP y HLS?

RTMP es el protocolo que usa OBS para enviar video. Los browsers no lo soportan directamente, por eso FFmpeg lo convierte a HLS: archivos `.ts` de 2 segundos indexados por un playlist `.m3u8` que el player descarga y reproduce en secuencia.

## 1.1 Inicializar el proyecto

```bash
mkdir StremingServiceAppNWeb
cd StremingServiceAppNWeb
mkdir rtmp-server && cd rtmp-server
mkdir -p src streams/live

npm init -y
npm install node-media-server@4

# Verificar que es v4:
npm list node-media-server
# → node-media-server@4.2.4
```

## 1.2 src/index.js

Este es el archivo principal del servidor RTMP. Por ahora no valida stream keys ni llama al backend — eso lo agregas en la Parte 2 cuando el backend ya exista.

> ⚠️ **NMS v4 — API de eventos:** En v4 los callbacks de eventos reciben un objeto `session`, no `(id, streamPath, args)` como en v2/v3. Accedés al path con `session.streamPath` y cerrás el stream con `session.close()`.

```js
// rtmp-server/src/index.js
const NodeMediaServer = require('node-media-server');

// ⚠️ NMS v4 eliminó el soporte de transcoding integrado (config `trans`).
// El servidor HTTP sirve los archivos de ./streams — FFmpeg los genera en la Parte 2.

const config = {
  rtmp: {
    port: 1935,         // Puerto estándar RTMP. OBS conecta aquí.
    chunk_size: 60000,
    gop_cache: true,    // Cachea keyframes para que viewers nuevos vean el stream de inmediato.
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: './streams',
  },
  // NMS v4: 'static' es obligatorio para servir archivos HLS por HTTP.
  // Sin esto el servidor responde 404 a las URLs de .m3u8 y .ts.
  static: {
    router: '/',
    root: './streams',
  },
};

const nms = new NodeMediaServer(config);

// prePublish: se dispara cuando OBS intenta conectar.
// session.streamPath → "/live/STREAM_KEY"
nms.on('prePublish', (session) => {
  const key = session.streamPath?.split('/')[2];
  console.log(`[NMS] Intento de stream con key: ${key}`);
  // Sin validación por ahora — cualquier key funciona.
  // En la Parte 2 agregaremos validación contra el backend.
});

// postPublish: se dispara cuando el stream ya está activo.
nms.on('postPublish', (session) => {
  const key = session.streamPath?.split('/')[2];
  console.log(`[NMS] Stream en vivo: ${key}`);
  // En la Parte 2 notificaremos al backend aquí.
});

// donePublish: se dispara cuando OBS detiene la transmisión.
nms.on('donePublish', (session) => {
  const key = session.streamPath?.split('/')[2];
  console.log(`[NMS] Stream terminado: ${key}`);
});

nms.run();
console.log('RTMP corriendo en puerto 1935');
console.log('HTTP corriendo en puerto 8000');
```

## 1.3 Dockerfile

```dockerfile
# rtmp-server/Dockerfile
FROM node:24-alpine

# FFmpeg es el motor que convierte RTMP → HLS.
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p streams/live

EXPOSE 1935 8000
CMD ["node", "src/index.js"]
```

> ⚠️ **Atención:** No pruebes con OBS todavía. Las pruebas se hacen al final de la Parte 2 cuando el backend y el servidor estén corriendo juntos con Docker Compose.

---

# Parte 2 — Backend con NestJS 11 y Prisma

## ¿Qué hace esta parte?

Creas el backend que maneja usuarios, autenticación, canales, stream keys y chat en tiempo real. Al final de esta parte conectas el backend con el servidor RTMP mediante Docker Compose y realizas las **primeras pruebas completas del sistema**.

## 2.1 Crear el proyecto NestJS

```bash
# Desde la raíz del proyecto:
cd StremingServiceAppNWeb

npm install -g @nestjs/cli
nest new backend
cd backend

# Dependencias de base de datos
npm install prisma @prisma/client
npm install -D prisma

# Autenticación JWT
npm install @nestjs/jwt @nestjs/passport passport passport-jwt passport-local
npm install -D @types/passport-jwt @types/passport-local

# WebSockets
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Utilidades
npm install @nestjs/config bcrypt uuid class-validator class-transformer
npm install -D @types/bcrypt @types/uuid

# Driver adapter para PostgreSQL (obligatorio en Prisma 7)
npm install @prisma/adapter-pg pg
npm install -D @types/pg

# Inicializar Prisma
npx prisma init
# Crea: prisma/schema.prisma y .env con DATABASE_URL vacío
```

## 2.2 backend/.env

Este archivo vive dentro de la carpeta `backend/`. El `docker-compose.yml` lo referencia con la ruta `./backend/.env` desde la raíz del proyecto.

```env
DATABASE_URL="postgresql://streaming_user:tu_password@postgres:5432/streaming_db"
# Nota: 'postgres' es el nombre del servicio en docker-compose.yml.
# Para desarrollo local sin Docker usa: @localhost:5432

JWT_SECRET="pon_aqui_un_string_largo_y_aleatorio"
JWT_EXPIRES_IN="7d"
PORT=3000
```

> **Cómo generar el JWT_SECRET:** Necesitás un string largo y aleatorio. Opciones:
>
> ```bash
> # Node.js (en cualquier terminal):
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
>
> # PowerShell (Windows):
> [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
>
> # OpenSSL (Mac/Linux):
> openssl rand -hex 64
> ```
>
> Copiá el output y pegalo como valor de `JWT_SECRET`. Nunca lo compartas ni lo subas a git.

## 2.3 Schema de Prisma

> ⚠️ **Prisma 7:** La propiedad `url` ya no va en `schema.prisma`. Se configura en `prisma.config.ts` (generado por `npx prisma init`) y en el constructor del cliente con el adapter (ver sección 2.4).

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  channel   Channel?
  @@map("users")
}

model Channel {
  id        String   @id @default(uuid())
  slug      String   @unique   // URL del canal (/canal/username)
  title     String?
  isLive    Boolean  @default(false)
  streamKey String   @unique   // UUID secreto que el streamer pone en OBS
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  @@map("channels")
}
```

## 2.4 PrismaService y PrismaModule

> ⚠️ **Prisma 7:** `PrismaService` necesita pasar un driver adapter al constructor. Asegurate de haber corrido `npm install @prisma/adapter-pg pg` (sección 2.1).

**backend/src/prisma/prisma.service.ts**

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
```

**backend/src/prisma/prisma.module.ts**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

## 2.5 Autenticación JWT (todos los archivos)

**backend/src/auth/dto/register.dto.ts**

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

**backend/src/auth/jwt.strategy.ts**

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: { sub: string; username: string }) {
    return { id: payload.sub, username: payload.username };
  }
}
```

**backend/src/auth/jwt-auth.guard.ts**

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**backend/src/auth/auth.service.ts**

```ts
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
    });
    if (exists) throw new ConflictException('Username o email ya en uso');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { username: dto.username, email: dto.email, password: hashed },
      });
      await tx.channel.create({
        data: { userId: u.id, slug: dto.username.toLowerCase(), streamKey: uuidv4() },
      });
      return u;
    });
    return {
      access_token: this.jwt.sign({ sub: user.id, username: user.username }),
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');
    return {
      access_token: this.jwt.sign({ sub: user.id, username: user.username }),
    };
  }
}
```

**backend/src/auth/auth.controller.ts**

```ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }
}
```

**backend/src/auth/auth.module.ts**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

## 2.6 StreamsController: validación y webhooks

Este controlador valida stream keys y recibe webhooks de NMS. Los endpoints de gestión de canal (`/channels/*`) están en el `ChannelsController` (sección 2.7).

**backend/src/streams/stream.controller.ts**

```ts
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
```

**backend/src/streams/streams.module.ts**

```ts
import { Module } from '@nestjs/common';
import { StreamsController } from './stream.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [StreamsController],
})
export class StreamsModule {}
```

## 2.7 ChannelsController

Gestiona los canales: lista los en vivo, devuelve info de un canal, y maneja la stream key del usuario autenticado.

> ⚠️ **Orden de rutas:** `@Get('me/stream-key')` debe estar ANTES de `@Get(':slug')` para que NestJS no trate `me` como un slug.

**backend/src/channels/channels.controller.ts**

```ts
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
```

**backend/src/channels/channels.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';

@Module({ controllers: [ChannelsController] })
export class ChannelsModule {}
```

## 2.8 ChatGateway con Socket.IO 4.8

**backend/src/chat/chat.gateway.ts**

```ts
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
```

**backend/src/chat/chat.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

@Module({
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
```

## 2.9 AppModule y arranque

Conecta todos los módulos y habilita CORS y validación global.

**backend/src/app.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { StreamsModule } from './streams/streams.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ChannelsModule,
    StreamsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**backend/src/main.ts**

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

## 2.10 Endpoints del API

| Método + Ruta | Descripción |
|---|---|
| POST /auth/register | Crea usuario + canal. Retorna JWT. |
| POST /auth/login | Login. Retorna JWT. |
| GET /channels/live | Canales en vivo ahora. |
| GET /channels/:slug | Info de un canal. |
| GET /channels/me/stream-key | Tu stream key. Requiere JWT. |
| POST /channels/me/reset-key | Regenerar stream key. Requiere JWT. |
| GET /streams/validate/:key | Llamado internamente por NMS. |
| POST /streams/webhook | Recibe eventos de NMS. |

## 2.11 Dockerfile del backend

Este Dockerfile es para **desarrollo** con hot-reload. Docker Compose monta `./backend` como volumen encima de `/app`, así los cambios en código se reflejan sin reconstruir la imagen. El `node_modules` del contenedor vive en un volumen anónimo separado para no solaparlo con el de Windows.

```dockerfile
# backend/Dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
```

## 2.12 Actualizar src/index.js del servidor RTMP

Ahora que el backend existe, reemplaza el contenido completo de `rtmp-server/src/index.js`:

```js
// rtmp-server/src/index.js — versión final con backend
const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// BACKEND_URL viene del environment en docker-compose.yml
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';
const STREAMS_DIR = './streams';
const FFMPEG = '/usr/bin/ffmpeg';

const config = {
  rtmp: { port: 1935, chunk_size: 60000, gop_cache: true, ping: 30, ping_timeout: 60 },
  http: { port: 8000, allow_origin: '*', mediaroot: STREAMS_DIR },
  // NMS v4: mediaroot no sirve archivos estáticos automáticamente.
  // 'static' activa express.static() para que los .m3u8 y .ts sean accesibles por HTTP.
  static: { router: '/', root: STREAMS_DIR },
};

const nms = new NodeMediaServer(config);

// NMS v4: los callbacks reciben un objeto session.
// session.streamPath → "/live/STREAM_KEY"
// session.close()    → rechaza o cierra el stream
//
// ⚠️ NMS v4 eliminó el soporte de transcoding integrado (config `trans` de v2/v3).
// La conversión RTMP → HLS se hace spawnando FFmpeg manualmente en postPublish.

const ffmpegProcesses = new Map(); // sessionId → proceso FFmpeg

nms.on('prePublish', async (session) => {
  const key = session.streamPath?.split('/')[2];
  if (!key) { session.close(); return; }
  console.log(`[NMS] Intento de stream con key: ${key}`);
  try {
    const res = await fetch(`${BACKEND_URL}/streams/validate/${key}`);
    if (!res.ok) {
      console.log(`[NMS] Key inválida: ${key}`);
      session.close();
    } else {
      console.log(`[NMS] Key válida, aceptando stream`);
    }
  } catch (err) {
    console.error('[NMS] Backend no disponible, rechazando stream:', err.message);
    session.close();
  }
});

nms.on('postPublish', async (session) => {
  const key = session.streamPath?.split('/')[2];
  if (!key) return;

  // Crear carpeta de salida y lanzar FFmpeg
  const outputDir = path.join(STREAMS_DIR, session.streamPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const ffmpeg = spawn(FFMPEG, [
    '-i', `rtmp://127.0.0.1:1935${session.streamPath}`,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments',
    path.join(outputDir, 'index.m3u8'),
  ]);

  ffmpeg.stderr.on('data', (data) => process.stdout.write(`[FFmpeg] ${data}`));
  ffmpeg.on('close', (code) => {
    console.log(`[FFmpeg] Proceso terminado con código ${code}`);
    ffmpegProcesses.delete(session.id);
  });
  ffmpegProcesses.set(session.id, ffmpeg);

  console.log(`[NMS] Stream en vivo: ${key}`);
  try {
    await fetch(`${BACKEND_URL}/streams/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamKey: key, event: 'start' }),
    });
  } catch (err) { console.error('[NMS] Error webhook start:', err.message); }
});

nms.on('donePublish', async (session) => {
  // Matar el proceso FFmpeg de este stream
  const ffmpeg = ffmpegProcesses.get(session.id);
  if (ffmpeg) { ffmpeg.kill(); ffmpegProcesses.delete(session.id); }

  const key = session.streamPath?.split('/')[2];
  if (!key) return;
  console.log(`[NMS] Stream terminado: ${key}`);
  try {
    await fetch(`${BACKEND_URL}/streams/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamKey: key, event: 'end' }),
    });
  } catch (err) { console.error('[NMS] Error webhook end:', err.message); }
});

nms.on('prePlay', (session) => {
  console.log(`[NMS] Viewer conectado a: ${session.streamPath}`);
});

nms.run();
console.log(`RTMP → 1935 | HTTP → 8000 | Backend: ${BACKEND_URL}`);
```

## 2.13 docker-compose.yml principal

Crea este archivo en la **raíz del proyecto** (`StremingServiceAppNWeb/docker-compose.yml`). Siempre se corre desde la raíz.

```yaml
# StremingServiceAppNWeb/docker-compose.yml

services:

  postgres:
    image: postgres:16-alpine
    container_name: streaming_postgres
    environment:
      POSTGRES_DB: streaming_db
      POSTGRES_USER: streaming_user
      POSTGRES_PASSWORD: tu_password
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U streaming_user -d streaming_db']
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: streaming_redis
    ports:
      - '6379:6379'
    command: redis-server --save 20 1 --loglevel warning

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: streaming_backend
    ports:
      - '3000:3000'
    env_file:
      - ./backend/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend:/app        # hot-reload: cambios en código se reflejan al instante
      - /app/node_modules     # evita que el node_modules de Windows solapé al del contenedor

  rtmp-server:
    build:
      context: ./rtmp-server
      dockerfile: Dockerfile
    container_name: streaming_rtmp
    ports:
      - '1935:1935'
      - '8000:8000'
    environment:
      - BACKEND_URL=http://backend:3000
    volumes:
      - hls_streams:/app/streams
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  hls_streams:
```

## 2.14 Levantar todo y correr las migraciones

> ⚠️ **Antes de hacer el build de Docker:** Corré `npx prisma generate` dentro de `backend/` para generar el cliente Prisma. En Windows, si ves el error `Module '"@prisma/client"' has no exported member 'PrismaClient'` en VS Code, creá el junction manualmente:
> ```powershell
> New-Item -ItemType Junction `
>   -Path "backend\node_modules\@prisma\client\.prisma" `
>   -Target "backend\node_modules\.prisma"
> ```
> Esto es un bug de Prisma 7 en Windows donde el symlink no se crea automáticamente.

```bash
# Desde la carpeta backend/, generar el cliente Prisma:
cd backend
npx prisma generate
cd ..

# Desde la RAÍZ del proyecto:
# Levantar todos los servicios:
docker compose up --build

# En otra terminal, correr las migraciones por PRIMERA VEZ:
docker compose exec backend npx prisma migrate dev --name init

# Verificar que el backend responde:
curl http://localhost:3000/channels/live
# Debe retornar: []
```

> **`migrate dev` vs `migrate deploy`:**
> - `migrate dev --name init` — para **desarrollo**. Crea el archivo de migración en `prisma/migrations/` y aplica los cambios. Usar en la primera vez y cada vez que cambies el schema.
> - `migrate deploy` — para **producción**. Solo aplica migraciones ya existentes sin crear nuevas. No usar en la primera vez.

## 2.15 Prueba completa con OBS

Con todos los servicios corriendo, ya puedes hacer la primera prueba del sistema completo.

**1. Registra un usuario de prueba:**

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username": "testuser", "email": "test@test.com", "password": "12345678"}'
# Guarda el access_token que retorna
```

**2. Obtén tu stream key:**

```bash
curl http://localhost:3000/channels/me/stream-key \
  -H 'Authorization: Bearer TU_TOKEN_AQUI'
# Guarda el streamKey que retorna (ej: a1b2c3d4-e5f6-...)
```

**3. Configura OBS:**
- Configuración → Emisión → Servicio: Personalizado
- Servidor: `rtmp://localhost/live`
- Clave de emisión: pega la streamKey que obtuviste

**4.** Haz click en **Iniciar emisión** en OBS.

**5.** Verifica en la terminal de Docker que aparece: `[NMS] Stream en vivo`.

**6. Verifica que el canal está en vivo:**

```bash
curl http://localhost:3000/channels/live
# Debe mostrar tu canal con isLive: true
```

**7. Verifica el stream HLS:**

```
# Abre en el navegador (confirma que existen los segmentos):
http://localhost:8000/live/TU_STREAM_KEY/index.m3u8

# Para reproducirlo usa VLC: Medios → Abrir ubicación de red → pega la URL
```

> 💡 **Tip:** Si OBS dice "Error al conectar al servidor", verifica que los contenedores estén corriendo con: `docker compose ps`

---

# Parte 3 — Frontend Web con React, Vite y HLS.js 1.6

## ¿Qué hace esta parte?

Construyes la interfaz web donde los viewers ven los streams en vivo, participan en el chat, y los streamers gestionan su canal.

## 3.1 Crear el proyecto

```bash
cd StremingServiceAppNWeb
npm create vite@latest web -- --template react
cd web && npm install

npm install hls.js socket.io-client axios react-router-dom
npm install tailwindcss @tailwindcss/vite
```

**`web/vite.config.js` — configuración completa con todos los proxies necesarios:**

```js
// web/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,  // expone el servidor en la red local (necesario para acceder desde el celular)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // ⚠️ El rewrite es OBLIGATORIO. El backend NestJS no tiene prefijo /api.
        // Sin él, /api/channels/live llega como /api/channels/live → 404.
      },
      '/hls': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hls/, ''),
        // ⚠️ NMS (puerto 8000) no envía encabezados CORS confiables en desarrollo.
        // Proxiar /hls a través de Vite evita el bloqueo CORS del browser.
        // El VideoPlayer debe usar /hls/live/<key>/index.m3u8, NO http://localhost:8000/...
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        // ⚠️ ws: true activa el proxy WebSocket (necesario para el upgrade HTTP→WS).
        // Chat.jsx debe conectar a io() sin URL para usar el mismo origen que la página.
        // Sin este proxy, el chat no funciona desde celulares u otras PCs en la red.
      },
    },
  },
})
```

> **Errores comunes sin esta configuración:**
> - `Cannot GET /api/channels/live` → falta el `rewrite` en `/api`
> - `Access to XMLHttpRequest blocked by CORS policy` en el video → falta el proxy `/hls`
> - Chat no conecta desde el celular → falta el proxy `/socket.io` con `ws: true`

## 3.2 VideoPlayer.jsx con HLS.js 1.6

HLS.js detecta automáticamente si el navegador soporta MediaSource. En Safari usa HLS nativo. En Chrome/Firefox/Edge usa HLS.js. En iOS 17.1+ usa Managed Media Source.

> ⚠️ La URL del stream debe usar `/hls/...` (proxiado por Vite), **no** `http://localhost:8000/...` directamente. El browser bloquea el acceso directo al puerto 8000 por CORS.

```jsx
// web/src/components/VideoPlayer.jsx
import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

export function VideoPlayer({ streamKey, isLive }) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ✅ Usar la ruta /hls proxiada — nunca http://localhost:8000 directamente
  const hlsUrl = `/hls/live/${streamKey}/index.m3u8`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isLive) return;
    setError(null); setLoading(true);

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => { video.muted = true; video.play(); });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { setError('Error al cargar el stream'); hls.destroy(); }
        }
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari: soporte HLS nativo, no necesita hls.js
      video.src = hlsUrl; video.play(); setLoading(false);
    }
  }, [hlsUrl, isLive]);

  if (!isLive) return (
    <div className="aspect-video bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400">El canal no está en vivo</p>
    </div>
  );

  return (
    <div className="relative aspect-video bg-black">
      {loading && <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 rounded-full border-t-transparent" />
      </div>}
      {error && <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-red-400">{error}</p></div>}
      <video ref={videoRef} className="w-full h-full" controls playsInline />
    </div>
  );
}
```

## 3.3 Chat.jsx

> ⚠️ **No hardcodear `http://localhost:3000`** en `io()`. Si lo hacés, el chat solo funciona en tu PC. Desde un celular u otra máquina en la red, `localhost` apunta al dispositivo del visitante, no a tu servidor.
>
> La solución es llamar a `io()` **sin URL** — socket.io-client conecta al mismo origen que la página. Vite proxia `/socket.io` al backend gracias al proxy con `ws: true` configurado en 3.1.

```jsx
// web/src/components/Chat.jsx
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export function Chat({ channelSlug, username }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;

    // ✅ Sin URL: conecta al mismo origen que la página (Vite lo proxia al backend)
    const s = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = s;

    s.on('connect', () => {
      if (!active) return;
      s.emit('join_channel', channelSlug);
    });
    s.on('new_message', msg => {
      if (!active) return;
      setMessages(p => [...p, msg]);
    });
    s.on('channel_event', e => {
      if (!active || e.type !== 'stream_status') return;
      setMessages(p => [...p, { id: Date.now(), username: 'Sistema',
        text: e.isLive ? '🔴 Stream iniciado' : '⏹ Stream terminado' }]);
    });

    // La bandera `active` evita actualizar estado tras el desmontaje.
    // Esto es especialmente importante en React 19 StrictMode, que
    // desmonta y remonta componentes en desarrollo.
    return () => { active = false; s.disconnect(); };
  }, [channelSlug]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    socketRef.current.emit('send_message',
      { channel: channelSlug, text: input.trim(), username: username || 'Anónimo' });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-white font-semibold">Chat</h3></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {messages.map(m => (<div key={m.id} className="text-sm">
          <span className="font-bold text-purple-400">{m.username}: </span>
          <span className="text-gray-200">{m.text}</span></div>))}
        <div ref={bottomRef} /></div>
      <div className="p-3 border-t border-gray-700 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()} maxLength={500}
          placeholder="Escribe..."
          className="flex-1 bg-gray-800 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-purple-500" />
        <button onClick={send}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm">
          Chat</button></div>
    </div>
  );
}
```

## 3.4 Página del canal

```jsx
// web/src/pages/Channel.jsx
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { Chat } from '../components/Chat';
import axios from 'axios';

export function ChannelPage() {
  const { slug } = useParams();
  const [channel, setChannel] = useState(null);
  useEffect(() => { axios.get(`/api/channels/${slug}`).then(r => setChannel(r.data)); }, [slug]);
  if (!channel) return <div className="text-white p-8">Cargando...</div>;

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <VideoPlayer streamKey={channel.streamKey} isLive={channel.isLive} />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{channel.title || channel.user.username}</h1>
            {channel.isLive && <span className="bg-red-600 px-2 py-0.5 text-xs rounded font-bold">EN VIVO</span>}
          </div>
          <p className="text-gray-400 mt-1">{channel.user.username}</p>
        </div>
      </div>
      {/* En mobile el sidebar se oculta — usar layout responsive o tabs */}
      <div className="w-72 border-l border-gray-800 hidden lg:block">
        <Chat channelSlug={slug} /></div>
    </div>
  );
}
```

> 💡 **Mobile:** El sidebar de chat se oculta en pantallas chicas (`hidden lg:block`). Para una experiencia mobile completa, considerar un layout que apile el video arriba y el chat abajo, o un sistema de tabs Video/Chat.

## 3.5 Dashboard del streamer

```jsx
// web/src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';

export function Dashboard() {
  const [streamKey, setStreamKey] = useState('');
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get('/api/channels/me/stream-key', { headers }).then(r => setStreamKey(r.data.streamKey));
  }, []);

  const copy = () => { navigator.clipboard.writeText(streamKey); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const reset = async () => {
    if (!confirm('La key anterior dejará de funcionar. ¿Continuar?')) return;
    const r = await axios.post('/api/channels/me/reset-key', {}, { headers });
    setStreamKey(r.data.streamKey);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Mi Canal</h1>
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Configuración OBS</h2>
        <p className="text-gray-400 text-sm mb-1">Servidor</p>
        <div className="bg-gray-900 rounded p-3 mb-4 font-mono text-sm">rtmp://localhost/live</div>
        <p className="text-gray-400 text-sm mb-1">Stream Key</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-900 rounded p-3 font-mono text-sm">
            {show ? streamKey : '•'.repeat(36)}</div>
          <button onClick={() => setShow(!show)} className="px-3 bg-gray-700 rounded text-sm">{show ? 'Ocultar' : 'Ver'}</button>
          <button onClick={copy} className="px-3 bg-purple-600 rounded text-sm">{copied ? '✓' : 'Copiar'}</button>
        </div>
        <button onClick={reset} className="mt-3 text-red-400 text-sm hover:underline">Resetear stream key</button>
      </div>
    </div>
  );
}
```

## 3.6 Acceder desde el celular

Con `host: true` en la configuración de Vite, el servidor de desarrollo queda accesible en toda la red local.

**1.** Encontrá la IP de tu PC:
```bash
# Windows
ipconfig
# Buscá "Dirección IPv4" bajo tu adaptador WiFi → 192.168.X.X
```

**2.** Arrancá el servidor de desarrollo:
```bash
npm run dev
# Vite mostrará:
#   ➜  Local:   http://localhost:5173/
#   ➜  Network: http://192.168.X.X:5173/   ← esta URL abrís desde el celular
```

**3.** El celular y la PC deben estar en la **misma red WiFi**.

> ⚠️ **Windows Firewall:** Si el celular no puede conectar, puede que el firewall bloquee el puerto 5173. Creá una regla de entrada para TCP 5173, o temporalmente desactivá el firewall para redes privadas.

---

# Parte 4 — App Móvil con React Native CLI

## ¿Qué hace esta parte?

Construyes la app móvil para que los viewers vean streams y participen en el chat desde su teléfono. Usa React Native CLI para acceso completo a los reproductores nativos de Android e iOS.

## 4.1 Estado actual de React Native (Mayo 2026)

- React Native 0.85 (Abril 2026) es la versión estable más reciente.
- New Architecture es **obligatoria** desde RN 0.82. No se puede deshabilitar.
- El Bridge legacy fue eliminado completamente en 0.85.
- Hermes V1 es el motor JavaScript por defecto. JSC ya no está incluido.
- react-native-video **v6** es la versión estable recomendada. v5 es EOL. v7 está en beta.

> ⚠️ **Atención:** react-native-video v5 y anteriores son EOL. No los uses. Usa v6 para proyectos nuevos.

## 4.2 Requisitos del entorno

**Todos los sistemas:**
- Node.js 24 LTS
- Java 17 — Zulu JDK (más estable para Android builds)
- Android Studio — incluye SDK y emulador
- Watchman — mejora el file watching de Metro

**Solo iOS (requiere Mac):**
- Xcode 16+ con Command Line Tools
- CocoaPods

```bash
# macOS
brew install node@24 watchman
brew install --cask zulu@17 android-studio
sudo gem install cocoapods

# Windows (PowerShell como Administrador)
choco install -y nodejs-lts microsoft-openjdk17
# Instalar Android Studio desde developer.android.com/studio

# Variables de entorno — agregar a ~/.zshrc o ~/.bashrc
export ANDROID_HOME=$HOME/Library/Android/sdk    # macOS
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Verificar:
node --version   # v24.x.x
java -version    # openjdk 17
adb --version    # Android Debug Bridge
```

## 4.3 Crear el proyecto

```bash
cd StremingServiceAppNWeb
npx @react-native-community/cli@latest init mobile --template react-native-template-typescript
cd mobile

# Verificar que el proyecto base funciona ANTES de instalar dependencias:
npx react-native run-android   # o run-ios en Mac
# Si ves la pantalla de bienvenida, el setup es correcto.
```

> 💡 **Tip:** Verifica siempre que el proyecto base corre antes de instalar dependencias. Si algo falla después, sabrás que el problema es de una librería específica y no del setup.

## 4.4 Instalar dependencias

```bash
npm install react-native-video@6
npm install socket.io-client axios
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context react-native-gesture-handler
npm install @react-native-async-storage/async-storage

# iOS: instalar pods después de cada librería nativa
cd ios && pod install && cd ..
```

> ⚠️ **Atención:** Cada vez que instales una librería con módulos nativos debes correr `pod install` en iOS y re-buildear la app. Metro no detecta cambios nativos automáticamente.

## 4.5 HLSPlayer.tsx con react-native-video v6

react-native-video v6 usa ExoPlayer en Android y AVPlayer en iOS — los reproductores nativos del OS con decodificación por hardware.

```tsx
// mobile/src/components/HLSPlayer.tsx
import React, { useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import Video, { VideoRef, OnProgressData } from 'react-native-video';

// En dispositivo físico usa la IP de tu PC, NO 'localhost'.
// El teléfono y tu PC deben estar en la misma red WiFi.
// Encuentra tu IP: ifconfig (Mac/Linux) o ipconfig (Windows)
const NMS_URL = 'http://192.168.1.100:8000';  // ← cambia esto por tu IP

export function HLSPlayer({ streamKey, isLive }: { streamKey: string; isLive: boolean }) {
  const videoRef = useRef<VideoRef>(null);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isLive) return (
    <View style={styles.offline}>
      <Text style={styles.offlineText}>⏸ Canal offline</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: `${NMS_URL}/live/${streamKey}/index.m3u8` }}
        controls={true}
        style={styles.video}
        resizeMode="contain"
        paused={false}
        onLoad={() => { setBuffering(false); setError(null); }}
        onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
        onError={() => { setError('No se puede cargar el stream.'); setBuffering(false); }}
        onProgress={(data: OnProgressData) => {
          // Si el viewer se atrasa más de 10s del live edge, hacer seek al final
          if (data.seekableDuration - data.currentTime > 10)
            videoRef.current?.seek(data.seekableDuration);
        }}
      />
      {buffering && <View style={styles.overlay}><ActivityIndicator size="large" color="#7C3AED" /></View>}
      {error && <View style={styles.overlay}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry}
          onPress={() => { setError(null); setBuffering(true); }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Reintentar</Text>
        </TouchableOpacity></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  video: { flex: 1 },
  offline: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#1F2937',
             justifyContent: 'center', alignItems: 'center' },
  offlineText: { color: '#9CA3AF', fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)',
             justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#EF4444', textAlign: 'center', padding: 16 },
  retry: { marginTop: 12, backgroundColor: '#7C3AED',
           paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
```

## 4.6 Chat.tsx

```tsx
// mobile/src/components/Chat.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList,
         StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';

const BACKEND = 'http://192.168.1.100:3000';  // ← tu IP local

export function Chat({ channelSlug }: { channelSlug: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(BACKEND, { transports: ['websocket'], reconnection: true });
    socketRef.current = s;
    s.on('connect', () => { setConnected(true); s.emit('join_channel', channelSlug); });
    s.on('disconnect', () => setConnected(false));
    s.on('new_message', msg => setMessages(p => [msg, ...p]));
    s.on('channel_event', e => {
      if (e.type === 'stream_status')
        setMessages(p => [{ id: Date.now(), username: 'Sistema',
          text: e.isLive ? '🔴 Stream iniciado' : '⏹ Stream terminado' }, ...p]);
    });
    return () => s.disconnect();
  }, [channelSlug]);

  const send = () => {
    if (!input.trim() || !socketRef.current?.connected) return;
    socketRef.current.emit('send_message',
      { channel: channelSlug, text: input.trim(), username: 'Usuario' });
    setInput('');
  };

  return (
    <KeyboardAvoidingView style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <Text style={s.headerText}>Chat</Text>
        <View style={[s.dot, { backgroundColor: connected ? '#10B981' : '#EF4444' }]} />
      </View>
      <FlatList data={messages} inverted keyExtractor={i => i.id.toString()}
        renderItem={({ item }) => (
          <View style={s.msg}>
            <Text style={s.user}>{item.username}: </Text>
            <Text style={s.text}>{item.text}</Text>
          </View>
        )} />
      <View style={s.inputRow}>
        <TextInput value={input} onChangeText={setInput} style={s.input}
          placeholder="Escribe..." placeholderTextColor="#6B7280"
          returnKeyType="send" onSubmitEditing={send} blurOnSubmit={false} />
        <TouchableOpacity onPress={send} style={s.sendBtn}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  headerText: { color: '#fff', fontWeight: 'bold' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  msg: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  user: { color: '#A78BFA', fontWeight: 'bold', fontSize: 13 },
  text: { color: '#E5E7EB', fontSize: 13 },
  inputRow: { flexDirection: 'row', padding: 8, gap: 8,
              borderTopWidth: 1, borderTopColor: '#374151' },
  input: { flex: 1, backgroundColor: '#1F2937', color: '#fff', borderRadius: 8,
           paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
           borderWidth: 1, borderColor: '#4B5563' },
  sendBtn: { backgroundColor: '#7C3AED', borderRadius: 8,
             paddingHorizontal: 16, justifyContent: 'center' },
});
```

## 4.7 WatchScreen.tsx

```tsx
// mobile/src/screens/WatchScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HLSPlayer } from '../components/HLSPlayer';
import { Chat } from '../components/Chat';

export function WatchScreen({ route, navigation }: any) {
  const { channel } = route.params;
  React.useEffect(() => { navigation.setOptions({ title: channel.user.username }); }, []);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <HLSPlayer streamKey={channel.streamKey} isLive={channel.isLive} />
      <View style={s.info}>
        <View style={s.row}>
          <Text style={s.title} numberOfLines={1}>
            {channel.title ?? `Canal de ${channel.user.username}`}
          </Text>
          {channel.isLive && (
            <View style={s.badge}><Text style={s.badgeText}>🔴 EN VIVO</Text></View>
          )}
        </View>
        <Text style={s.username}>{channel.user.username}</Text>
      </View>
      <View style={{ flex: 1 }}><Chat channelSlug={channel.slug} /></View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  info: { paddingHorizontal: 14, paddingVertical: 10,
          borderBottomWidth: 1, borderBottomColor: '#374151' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: '#fff', fontSize: 15, fontWeight: 'bold' },
  username: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
```

## 4.8 Permisos de red en Android

Android bloquea HTTP por defecto. Para desarrollo necesitas esta excepción:

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.1.100</domain>
    </domain-config>
</network-security-config>
```

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

> ⚠️ **Atención:** Solo para desarrollo. En producción usa HTTPS y elimina esta excepción.

## 4.9 Correr en dispositivo físico

**Android:**
1. Ajustes → Acerca del teléfono → toca 7 veces "Número de compilación"
2. Activa "Depuración USB" en opciones de desarrollador
3. Conecta por USB → `adb devices` (verifica que aparece)
4. `npx react-native run-android`

**iOS (solo macOS):**
1. Conecta el iPhone por USB
2. Abre `ios/mobile.xcworkspace` en Xcode
3. Signing & Capabilities → configura tu Apple Developer account
4. `npx react-native run-ios --device`

> 📌 **Nota:** El teléfono y tu PC deben estar en la misma red WiFi. Cambia `192.168.1.100` por la IP real de tu máquina en `HLSPlayer.tsx` y `Chat.tsx`.

---

# Siguientes pasos — Para llevar a producción

| Área | Qué hacer |
|---|---|
| SSL/HTTPS | Certbot + nginx. Sin SSL los browsers modernos bloquean el video en producción. |
| CDN | Cloudflare o BunnyCDN enfrente de nginx para distribuir HLS globalmente. |
| Múltiples calidades | Agregar tasks en NMS: 1080p/5000kbps, 720p/2500kbps, 480p/1000kbps. |
| Latencia baja | `hls_time=1` en NMS + `lowLatencyMode:true` en hls.js → ~2-4s de latencia. |
| VODs | Activar recording en NMS, convertir .flv a MP4 al terminar y subir a S3. |
| Moderación | Roles en DB + filtro de palabras en ChatGateway. |
| Escalado | Redis Adapter para Socket.IO cuando escales a múltiples instancias de NestJS. |

## Recursos oficiales

- Node.js 24 — nodejs.org
- NestJS 11 — docs.nestjs.com
- Node Media Server — github.com/illuspas/Node-Media-Server
- Prisma — prisma.io/docs
- Socket.IO 4.8 — socket.io/docs/v4
- hls.js 1.6 — github.com/video-dev/hls.js
- react-native-video v6 — docs.thewidlarzgroup.com/react-native-video
- React Native CLI — reactnative.dev/docs/environment-setup
- Docker Compose v2 — docs.docker.com/compose
