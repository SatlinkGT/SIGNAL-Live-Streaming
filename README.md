<div align="center">

# StreamLive

**A self-hosted live streaming platform — your own Twitch, running in Docker.**

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

StreamLive es una plataforma de transmisión en vivo autohospedada. Cada cuenta recibe un canal y una clave personal. Los espectadores pueden reproducir la señal HLS y participar en el chat del canal.

## Inicio rápido

Requiere Docker y Docker Compose v2.

```bash
git clone https://github.com/SatlinkGT/SIGNAL-Live-Streaming.git
cd SIGNAL-Live-Streaming
cp backend/.env_example backend/.env
```

En `backend/.env`, reemplaza `JWT_SECRET` por un valor aleatorio, por ejemplo con `openssl rand -hex 32`. La contraseña de `DATABASE_URL` debe coincidir con la de PostgreSQL en `docker-compose.yml`. La configuración incluida es para uso local.

```bash
docker compose up -d --build
docker compose logs -f backend
```

La API aplica las migraciones al arrancar. Abre http://localhost:5173/register, crea una cuenta y entra en el panel (`/dashboard`) para ver la clave y la configuración de emisión.

## Emitir y ver un canal

- **RTMP (OBS o vMix)**. Selecciona RTMP en el panel y usa `rtmp://localhost/live` con tu clave personal.
- **SRT (Astra u otro emisor compatible)**. Selecciona SRT en el panel. Usa el puerto 8890/UDP en modo Caller y el Stream ID `publish:live/CLAVE_PERSONAL`.
- Envía vídeo H.264 y audio AAC. Abre `http://localhost:5173/canal/TU_CANAL` para reproducir el directo.

## Chat del canal

Socket.IO entrega los mensajes en tiempo real y PostgreSQL guarda el historial de cada canal. Al recargar o reconectar se recuperan los mensajes del día. A las **00:00 UTC** comienza un historial nuevo y se eliminan los mensajes del día anterior. Los avisos de inicio y fin de emisión se muestran en directo.

El cliente se conecta al mismo origen por `/socket.io/`. Emite `join_channel` con el slug y recibe `chat_history`. Para escribir, emite `send_message` con `{ channel, username, text }`. El servidor publica `new_message` con `{ id, username, text, timestamp }`.

## Componentes y documentación

- `backend/` contiene la API NestJS, el chat, el esquema Prisma y las migraciones PostgreSQL.
- `rtmp-server/` contiene MediaMTX y la integración Node.js que valida las entradas y sirve HLS.
- `web/` contiene la aplicación React y el proxy Nginx para API, chat y HLS.
- [Despliegue en producción](DEPLOYMENT.md) incluye HTTPS, variables de entorno, copias de seguridad y la configuración de RTMP y SRT.
- La guía de emisión está disponible en [Markdown](guia-streaming.md) y [PDF](guia-streaming-instructiva.pdf).

## Licencia

[MIT](LICENSE)
