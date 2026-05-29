# Usar Node.js 24 LTS con Alpine (imagen mínima, ~70MB)
FROM node:24-alpine
# Instalar FFmpeg desde los repositorios de Alpine.
# FFmpeg es necesario para que NMS transcodifique RTMP → HLS.
# --no-cache evita guardar el índice de paquetes en la imagen.
RUN apk add --no-cache ffmpeg
# Establecer directorio de trabajo dentro del contenedor
WORKDIR /app
# Copiar primero package.json para aprovechar el cache de Docker.
# Si package.json no cambia, Docker reutiliza la capa de npm install.
COPY package*.json ./
# Instalar dependencias de producción solamente
RUN npm install --omit=dev
# Copiar el resto del código fuente
COPY . .
# Crear la carpeta donde FFmpeg guardará los segmentos HLS
RUN mkdir -p streams/live
# Exponer puertos:
# 1935 → RTMP (OBS conecta aquí)
# 8000 → HTTP (viewers y el player HLS consumen el .m3u8 aquí)
EXPOSE 1935 8000
# Comando para iniciar el servidor
CMD ["node", "src/index.js"]