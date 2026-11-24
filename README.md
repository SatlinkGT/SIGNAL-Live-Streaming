<div align="center">

# StreamLive

**Plataforma de transmisión en vivo autohospedada con Docker.**

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

StreamLive es una plataforma de transmisión en vivo autohospedada. Cada cuenta recibe un canal y una clave personal. Los espectadores pueden reproducir la señal HLS y participar en el chat del canal.

## Características

- **Entradas RTMP y SRT** configurables por canal desde el panel.
- **Reproducción HLS** en navegadores de escritorio y móviles.
- **Chat en tiempo real** con historial por canal hasta las 00:00 UTC.
- **Cuentas y canales** con autenticación JWT, título, logo y clave de emisión personal.
- **Despliegue con Docker Compose** y HTTPS mediante Caddy en producción.

## Arquitectura

```text
OBS / vMix / Astra ── RTMP o SRT ──► MediaMTX
                                        │
                             HLS        │    Validación de claves
                              │         └────────────► NestJS ───► PostgreSQL
                              ▼                           ▲
Navegador ◄── React + hls.js / Nginx ◄── API y Socket.IO ──┘
```

| Capa | Tecnología |
|---|---|
| Interfaz | React 19, Vite 6 y hls.js |
| API y autenticación | NestJS 11, Prisma 7 y Passport JWT |
| Base de datos | PostgreSQL 16 |
| Entrada y reproducción | MediaMTX, RTMP, SRT y HLS |
| Chat | Socket.IO 4.8 |
| Despliegue | Docker Compose, Nginx y Caddy |

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

## API

La aplicación web usa el prefijo `/api` en el mismo origen.

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/register` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/channels/live` | Público |
| GET | `/api/channels/:slug` | Público |
| GET | `/api/channels/me/stream-key` | JWT |
| POST | `/api/channels/me/reset-key` | JWT |
| POST | `/api/channels/me/input` | JWT |
| POST | `/api/channels/me/title` | JWT |
| POST | `/api/channels/me/logo` | JWT |

## Estructura del proyecto

- `backend/` contiene la API NestJS, el chat, el esquema Prisma y las migraciones PostgreSQL.
- `rtmp-server/` contiene MediaMTX y la integración Node.js que valida las entradas y sirve HLS.
- `web/` contiene la aplicación React y el proxy Nginx para API, chat y HLS.
- `docker-compose.yml` inicia el entorno local.
- `docker-compose.production.yml` y `Caddyfile` configuran producción.

## Modelo de datos

```text
Usuario 1 ── 1 Canal 1 ── * Mensajes de chat
```

El canal guarda el slug, el título, el logo, el protocolo de entrada y la clave personal. Cada mensaje guarda su autor, texto y fecha dentro de su canal.

## Puertos

| Puerto | Servicio |
|---|---|
| 5173/TCP | Web local, API, chat y HLS a través de Nginx |
| 1935/TCP | Entrada RTMP |
| 8890/UDP | Entrada SRT |
| 80 y 443/TCP | Web y HTTPS en producción |

## Documentación

- [Despliegue en producción](DEPLOYMENT.md) incluye HTTPS, variables de entorno, copias de seguridad y la configuración de RTMP y SRT.
- La guía de emisión está disponible en [Markdown](guia-streaming.md) y [PDF](guia-streaming-instructiva.pdf).

## Licencia

[MIT](LICENSE)
