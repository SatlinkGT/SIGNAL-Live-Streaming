const NodeMediaServer = require("node-media-server");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:3000";
const STREAMS_DIR = "./streams";
const FFMPEG = "/usr/bin/ffmpeg";

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    allow_origin: "*",
    mediaroot: STREAMS_DIR,
  },
  // NMS v4: mediaroot no sirve archivos estáticos automáticamente.
  // El bloque 'static' activa express.static() para servir los .m3u8 y .ts de HLS.
  static: {
    router: "/",
    root: STREAMS_DIR,
  },
};

const nms = new NodeMediaServer(config);

// Mapa sessionId → proceso FFmpeg activo
const ffmpegProcesses = new Map();

nms.on("prePublish", async (session) => {
  const streamKey = session.streamPath?.split("/")[2];
  if (!streamKey) { session.close(); return; }
  console.log(`[NMS] Intento de stream con key: ${streamKey}`);
  try {
    const res = await fetch(`${BACKEND_URL}/streams/validate/${streamKey}`);
    if (!res.ok) {
      console.log(`[NMS] Key inválida: ${streamKey}`);
      session.close();
    } else {
      console.log(`[NMS] Key válida, aceptando stream`);
    }
  } catch (err) {
    console.error("[NMS] Backend no disponible, rechazando stream:", err.message);
    session.close();
  }
});

nms.on("postPublish", async (session) => {
  const streamKey = session.streamPath?.split("/")[2];
  if (!streamKey) return;

  // Crear carpeta de salida para los segmentos HLS
  const outputDir = path.join(STREAMS_DIR, session.streamPath);
  fs.mkdirSync(outputDir, { recursive: true });

  // NMS v4 no tiene transcoding integrado: lo hacemos con FFmpeg directamente.
  // FFmpeg pull del RTMP y genera segmentos HLS en ./streams/live/KEY/
  const ffmpeg = spawn(FFMPEG, [
    "-i", `rtmp://127.0.0.1:1935${session.streamPath}`,
    "-c", "copy",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "5",
    "-hls_flags", "delete_segments",
    path.join(outputDir, "index.m3u8"),
  ]);

  ffmpeg.stderr.on("data", (data) => {
    // FFmpeg escribe su log en stderr por defecto
    process.stdout.write(`[FFmpeg] ${data}`);
  });

  ffmpeg.on("close", (code) => {
    console.log(`[FFmpeg] Proceso terminado con código ${code}`);
    ffmpegProcesses.delete(session.id);
  });

  ffmpegProcesses.set(session.id, ffmpeg);

  console.log(`[NMS] Stream en vivo: ${streamKey}`);
  try {
    await fetch(`${BACKEND_URL}/streams/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamKey, event: "start" }),
    });
  } catch (err) {
    console.error("[NMS] Error notificando inicio:", err.message);
  }
});

nms.on("donePublish", async (session) => {
  // Matar el proceso FFmpeg de este stream
  const ffmpeg = ffmpegProcesses.get(session.id);
  if (ffmpeg) {
    ffmpeg.kill();
    ffmpegProcesses.delete(session.id);
  }

  const streamKey = session.streamPath?.split("/")[2];
  if (!streamKey) return;
  console.log(`[NMS] Stream terminado: ${streamKey}`);
  try {
    await fetch(`${BACKEND_URL}/streams/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamKey, event: "end" }),
    });
  } catch (err) {
    console.error("[NMS] Error notificando fin:", err.message);
  }
});

nms.on("prePlay", (session) => {
  console.log(`[NMS] Viewer conectado a: ${session.streamPath}`);
});

nms.run();
console.log(`RTMP → 1935 | HTTP → 8000 | Backend: ${BACKEND_URL}`);
