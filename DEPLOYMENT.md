# Despliegue en producción

Usa Docker con Compose v2 y un dominio que apunte al servidor. Sustituye el nombre de sitio en `Caddyfile` por tu dominio antes de iniciar Caddy.

## Configuración

Crea `.env` en la raíz del proyecto con `POSTGRES_PASSWORD`. Copia `backend/.env_example` a `backend/.env` y establece las variables siguientes.

| Variable | Archivo | Valor |
|---|---|---|
| `POSTGRES_PASSWORD` | `.env` | Contraseña aleatoria de PostgreSQL |
| `DATABASE_URL` | `backend/.env` | `postgresql://streaming_user:CONTRASEÑA@postgres:5432/streaming_db` |
| `JWT_SECRET` | `backend/.env` | Secreto aleatorio independiente |
| `JWT_EXPIRES_IN` | `backend/.env` | `7d` |
| `PORT` | `backend/.env` | `3000` |

Puedes generar cada valor secreto con `openssl rand -hex 32`. Restringe los permisos de ambos archivos con `chmod 600 .env backend/.env`.

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100
```

La API aplica las migraciones al iniciar. Caddy obtiene y renueva el certificado HTTPS. Publica 80/TCP y 443/TCP para web, 443/UDP para HTTP/3, 1935/TCP para RTMP y 8890/UDP para SRT. PostgreSQL, la API y Nginx se comunican por la red de Docker.

## Copia de la base de datos

```bash
umask 077
mkdir -p backups
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U streaming_user -d streaming_db > backups/streaming.sql
```

Conserva los volúmenes de PostgreSQL y Caddy entre despliegues. El chat usa PostgreSQL y elimina el historial anterior cada día a las 00:00 UTC.

## Entradas RTMP y SRT

El servicio `rtmp-server` utiliza MediaMTX 1.21.3, supervisado por Node.js.
Cada canal guarda `inputProtocol` (`rtmp` por defecto para conservar los canales existentes).
En `/dashboard` se elige RTMP o SRT y se muestran instrucciones para vMix (RTMP) o Astra de Cesbo (SRT).
El servidor rechaza el protocolo no seleccionado y las señales duplicadas.
Para cambiar de protocolo se debe detener la señal; un cambio en vivo devuelve HTTP 409.

- RTMP: `rtmp://streaming.example.com/live` y la clave personal.
- SRT: Astra de Cesbo envía en modo Caller; este servidor recibe en modo Listener.
  Destino: host `streaming.example.com`, puerto **8890/UDP**,
  Stream ID `publish:live/CLAVE_PERSONAL`, latencia de 200 ms, sin passphrase.
- Video H.264, audio AAC; fotogramas clave cada 2 segundos.
- Las credenciales y la selección solo se consultan con sesión autenticada.
- HLS conserva `/hls/live/SLUG/index.m3u8` y usa segmentos MPEG-TS.
  El proxy conserva las sesiones HLS y traduce las redirecciones sin exponer la clave.
- El reproductor web no requiere cambios para elegir protocolo.
- La API de MediaMTX, autenticación y HLS interno escuchan únicamente en loopback.
  Nginx sigue bloqueando `/api/streams/*` desde Internet.
- El estado del canal se sincroniza con las entradas activas y conserva los eventos del chat.
  Si el backend no está disponible, se conserva la señal existente y se rechazan nuevas conexiones.
- El volumen `hls_streams` anterior se conserva para permitir volver a la implementación previa.

Documentación: https://mediamtx.org/docs/publish/srt y
https://astra.cesbo.com/en/delivery/srt/.

En Astra, añade una salida SRT al canal, configura el destino y copia el Stream ID
completo del panel. La versión de Astra debe admitir Stream ID en salidas Caller.
Envía un solo programa MPEG-TS por canal. Astra conserva los códecs de la fuente:
si no son H.264/AAC, transcodifica antes de enviarlos para reproducirlos en la web.

Prueba aislada (no utiliza la base de datos de producción):

```bash
docker run -d --name srt-isolated-test \
  -e BACKEND_URL=http://127.0.0.1:3000 \
  -p 127.0.0.1:19000:8000 \
  -v "$PWD/rtmp-server/test/mock-backend.js:/app/mock-backend.js:ro" \
  streamingserviceappnweb-rtmp-server \
  sh -c 'node /app/mock-backend.js & exec node src/index.js'
python3 rtmp-server/test/integration.py
docker rm -f srt-isolated-test
```

La prueba verifica ambos protocolos, rechazo del protocolo desactivado y duplicados,
reconexión, separación por canal, descarga de segmentos y decodificación HLS de audio/video.
