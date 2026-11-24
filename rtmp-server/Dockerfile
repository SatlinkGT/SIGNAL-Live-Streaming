FROM bluenviron/mediamtx:1.21.3 AS media
FROM node:24-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=media /mediamtx /usr/local/bin/mediamtx
COPY mediamtx.yml ./mediamtx.yml
COPY src ./src
EXPOSE 1935 8000 8890/udp
CMD ["node", "src/index.js"]
