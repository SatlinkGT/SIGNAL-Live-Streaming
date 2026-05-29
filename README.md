<div align="center">

# StreamLive

**A self-hosted live streaming platform — your own Twitch, running in Docker.**

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

Users register, get a personal stream key, and broadcast live from OBS. Viewers watch in real-time through an HLS video player with live chat — no third-party services, no cloud costs, zero external dependencies.

## Features

- **Live RTMP ingest** — compatible with OBS, Streamlabs, and any RTMP client
- **Automatic HLS transcoding** via FFmpeg for universal browser playback
- **Real-time chat** powered by Socket.IO WebSockets
- **JWT authentication** — register, login, protected routes
- **Stream key management** — generate and reset your key from the dashboard
- **Responsive dark UI** — works on desktop and mobile browsers
- **One-command setup** — entire stack starts with `docker compose up`

## Architecture

```
[OBS / Streaming Software]
         │
         │  RTMP  (port 1935)
         ▼
┌─────────────────────┐   validate key    ┌──────────────────────┐
│    RTMP Server      │ ─────────────────▶│   NestJS Backend     │
│  Node Media Server  │ ◀─────────────────│   REST API + WS      │
│  + FFmpeg           │   webhook on live │                      │
└─────────────────────┘                   │   PostgreSQL 16       │
         │                                │   Redis 7            │
         │  HLS segments                  └──────────┬───────────┘
         ▼                                           │
┌─────────────────────┐                             │
│   React Frontend    │ ◀──── Socket.IO chat ────────┘
│   Vite + hls.js     │ ◀──── REST API ─────────────
│   Tailwind CSS 4    │
└─────────────────────┘
         │
         ▼
   [Browser / Mobile]
```

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend API | NestJS · Prisma ORM · Passport JWT | 11 · 7 · latest |
| Database | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Streaming ingest | Node Media Server + FFmpeg | 4.2 |
| Video delivery | HLS (HTTP Live Streaming) | — |
| Web frontend | React · Vite · Tailwind CSS | 19 · 6 · 4 |
| Video playback | hls.js | 1.6 |
| Real-time chat | Socket.IO | 4.8 |
| Mobile (in progress) | React Native | 0.85 |
| DevOps | Docker · Docker Compose | — |

## Getting Started

### Prerequisites

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (includes Docker Compose v2)

That's it. No Node.js, PostgreSQL, or Redis installation required on your machine.

### 1. Clone the repository

```bash
git clone https://github.com/BernardoCamarena/StreamingServiceAppNWeb.git
cd StreamingServiceAppNWeb
```

### 2. Configure environment variables

```bash
cp backend/.env_example backend/.env
```

Edit `backend/.env` and set a strong JWT secret:

```env
DATABASE_URL="postgresql://streaming_user:tu_password@postgres:5432/streaming_db"
JWT_SECRET="your-long-random-secret-here"
JWT_EXPIRES_IN="7d"
PORT=3000
```

> Generate a secure JWT secret:
> ```bash
> # Linux / macOS / Git Bash
> openssl rand -base64 64
>
> # Node.js (any platform)
> node -e "require('crypto').randomBytes(64).toString('base64')"
> ```

### 3. Start the entire stack

```bash
docker compose up --build
```

All five services start: `postgres`, `redis`, `backend`, `rtmp-server`, and `web`.  
Wait until you see `NestJS application started` in the backend logs.

### 4. Run the database migration (first time only)

```bash
docker compose exec backend npx prisma migrate deploy
```

### 5. Open the app

| Service | URL |
|---|---|
| **Web app** | http://localhost:5173 |
| **Backend API** | http://localhost:3000 |
| **HLS stream endpoint** | http://localhost:8000 |

## Streaming with OBS

1. Go to **http://localhost:5173/register** and create an account
2. Log in and navigate to **Dashboard** (`/dashboard`)
3. Copy your personal **stream key**
4. Open **OBS Studio → Settings → Stream**:
   - Service: `Custom`
   - Server: `rtmp://localhost/live`
   - Stream Key: *(paste from dashboard)*
5. Click **Start Streaming**
6. Your channel is now live at `http://localhost:5173/canal/your-username`

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Register user + auto-create channel |
| `POST` | `/auth/login` | — | Login, returns JWT |

**Register / Login body:**
```json
{
  "username": "streamer123",
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Channels

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/channels/live` | — | List all currently live channels |
| `GET` | `/channels/:slug` | — | Get channel info and stream key |
| `GET` | `/channels/me/stream-key` | JWT | Get your own stream key |
| `POST` | `/channels/me/reset-key` | JWT | Regenerate stream key |

### WebSocket Events

Connect to the backend via Socket.IO on the same origin.

```js
// Client → Server
socket.emit('join_channel', 'channel-slug')
socket.emit('send_message', { channel: 'slug', text: 'Hello!', username: 'user123' })

// Server → Client
socket.on('new_message',    { id, username, text, timestamp })
socket.on('channel_event',  { type: 'stream_status', isLive: boolean })
```

## Project Structure

```
.
├── backend/               # NestJS API — auth, channels, streams, chat
│   ├── src/
│   │   ├── auth/          # JWT auth, Passport strategy, guards
│   │   ├── channels/      # Channel CRUD and stream key management
│   │   ├── streams/       # RTMP webhook handler and key validation
│   │   └── chat/          # Socket.IO gateway
│   ├── prisma/            # Schema + migrations
│   └── Dockerfile
│
├── rtmp-server/           # RTMP ingest + FFmpeg HLS transcoding
│   ├── src/
│   │   └── index.js       # Node Media Server config + FFmpeg spawn
│   └── Dockerfile
│
├── web/                   # React frontend
│   ├── src/
│   │   ├── pages/         # Home, Channel, Dashboard, Login, Register
│   │   ├── components/    # VideoPlayer (hls.js), Chat (Socket.IO), Navbar
│   │   ├── context/       # AuthContext (JWT decode, login/logout)
│   │   └── api/           # Axios instance with JWT interceptor
│   └── Dockerfile
│
├── mobile/                # React Native app (in progress)
├── docker-compose.yml
└── README.md
```

## Database Schema

```
User ──────── Channel
│              │
id (uuid)      id (uuid)
username       slug          (URL-friendly, e.g. "streamer123")
email          title
password       isLive        (updated by RTMP webhook)
               streamKey     (UUID, used with OBS)
               userId (FK)
```

## Roadmap

- [x] RTMP ingest with stream key authentication
- [x] HLS transcoding with FFmpeg
- [x] NestJS REST API + Prisma ORM
- [x] JWT authentication
- [x] Real-time chat with Socket.IO
- [x] Responsive web frontend
- [x] Full Docker Compose setup
- [ ] React Native mobile app
- [ ] Stream recording to disk
- [ ] VOD (video on demand) support
- [ ] Channel categories and tags
- [ ] Follower / notification system

## Port Reference

| Port | Service | Protocol |
|---|---|---|
| `5173` | Web frontend (Vite) | HTTP |
| `3000` | Backend API + Socket.IO | HTTP / WS |
| `1935` | RTMP ingest | RTMP |
| `8000` | HLS segments | HTTP |
| `5432` | PostgreSQL | TCP |
| `6379` | Redis | TCP |

## License

[MIT](LICENSE)
