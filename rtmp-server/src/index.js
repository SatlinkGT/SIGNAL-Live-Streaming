const http = require('node:http');
const { spawn } = require('node:child_process');

const BACKEND = process.env.BACKEND_URL || 'http://backend:3000';
const MEDIA = 'http://127.0.0.1:9997';
const channels = new Map();
const reservations = new Map();
let stopping = false;
let lastSnapshot = '';

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  return response.json();
}

async function validate(mediaPath) {
  const match = /^live\/([a-zA-Z0-9_-]+)$/.exec(mediaPath);
  if (!match) throw new Error('Invalid path');
  return json(`${BACKEND}/streams/validate/${encodeURIComponent(match[1])}`);
}

// Control and authentication listen on loopback only; they are not public HTTP routes.
const control = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/auth') { res.writeHead(404).end(); return; }
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 8192) throw new Error('Body too large');
    }
    const auth = JSON.parse(raw);
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(auth.ip);
    if (local && ['api', 'read'].includes(auth.action)) { res.writeHead(200).end(); return; }
    if (auth.action !== 'publish' || !['rtmp', 'srt'].includes(auth.protocol)) throw new Error('Forbidden');
    const channel = await validate(auth.path);
    if (channel.inputProtocol !== auth.protocol) throw new Error('Input protocol disabled');
    const held = reservations.get(channel.channelId);
    if (held && held.id !== auth.id && (held.active || held.until > Date.now())) throw new Error('Channel occupied');
    reservations.set(channel.channelId, { id: auth.id, path: auth.path, until: Date.now() + 15000, active: false });
    res.writeHead(200).end();
  } catch { res.writeHead(403).end(); }
});

function normalizeLivePlaylist(playlist) {
  if (/^#EXT-X-ENDLIST\r?$/m.test(playlist)) return playlist;
  const durations = Array.from(
    playlist.matchAll(/^#EXTINF:(\d+(?:\.\d+)?)(?:,|\r?$)/gm),
    ([, duration]) => Math.round(Number(duration)),
  );
  if (!durations.length) return playlist;

  const target = Math.max(1, ...durations);
  // MediaMTX can retain the target of a segment that has left the live window.
  return playlist.replace(/^#EXT-X-TARGETDURATION:(\d+)(?=\r?$)/m, (line, advertised) =>
    Number(advertised) > target ? `#EXT-X-TARGETDURATION:${target}` : line,
  );
}

// Preserve the player's public HLS URLs. Private stream keys never enter a playlist URL.
const publicServer = http.createServer((req, res) => {
  const pathname = req.url?.split('?')[0];
  const match = /^\/live\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/.exec(pathname || '');
  const channel = match && channels.get(match[1]);
  if (!channel || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404).end(); return; }
  const upstream = http.request({
    hostname: '127.0.0.1', port: 8888,
    path: `/${channel.path}/${match[2]}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`,
    method: req.method,
  }, async (response) => {
    const headers = { 'Content-Type': response.headers['content-type'] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
    if (response.headers.location) {
      const redirect = new URL(response.headers.location, `http://localhost/${channel.path}/${match[2]}`);
      // Relative redirects work both directly and behind the public /hls/ prefix.
      headers.Location = `./${match[2]}${redirect.search}`;
    }
    if (req.method === 'GET' && response.statusCode === 200 && match[2].endsWith('.m3u8')) {
      try {
        let playlist = '';
        response.setEncoding('utf8');
        for await (const chunk of response) {
          playlist += chunk;
          if (playlist.length > 65536) throw new Error('Oversized HLS playlist');
        }
        res.writeHead(200, headers).end(normalizeLivePlaylist(playlist));
      } catch {
        if (!res.headersSent && !res.destroyed) res.writeHead(502).end();
      }
      return;
    }
    res.writeHead(response.statusCode, headers);
    response.pipe(res);
  });
  upstream.setTimeout(10000, () => upstream.destroy());
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  res.on('close', () => upstream.destroy());
  upstream.end();
});

async function sync() {
  const data = await json(`${MEDIA}/v3/paths/list?itemsPerPage=10000`);
  const next = new Map();
  const snapshot = [];
  const active = new Set();
  for (const item of data.items || []) {
    if (!item.ready || !item.source) continue;
    let channel;
    try { channel = await validate(item.name); } catch (error) {
      if (error.status !== 404) throw error;
      // A rotated key must disconnect its old publisher, releasing the input.
      const type = item.source.type === 'srtConn' ? 'srtconns' : 'rtmpconns';
      await fetch(`${MEDIA}/v3/${type}/kick/${item.source.id}`, { method: 'POST', signal: AbortSignal.timeout(5000) });
      continue;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(channel.slug)) continue;
    const protocol = item.source.type === 'srtConn' ? 'srt' : 'rtmp';
    if (channel.inputProtocol !== protocol) {
      const type = protocol === 'srt' ? 'srtconns' : 'rtmpconns';
      await fetch(`${MEDIA}/v3/${type}/kick/${item.source.id}`, { method: 'POST', signal: AbortSignal.timeout(5000) });
      continue;
    }
    next.set(channel.slug, { path: item.name });
    active.add(channel.channelId);
    reservations.set(channel.channelId, { id: item.source.id, path: item.name, active: true });
    snapshot.push({ channelId: channel.channelId, protocol });
  }
  for (const [id, held] of reservations) {
    if (!active.has(id) && (held.active || held.until < Date.now())) reservations.delete(id);
  }
  channels.clear();
  for (const [slug, channel] of next) channels.set(slug, channel);
  snapshot.sort((a, b) => a.channelId.localeCompare(b.channelId));
  const encoded = JSON.stringify(snapshot);
  // Reconcile periodically too, so a backend restart cannot leave stale live states.
  if (encoded !== lastSnapshot || Date.now() - sync.lastSent > 10000) {
    await json(`${BACKEND}/streams/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channels: snapshot }) });
    lastSnapshot = encoded;
    sync.lastSent = Date.now();
  }
}

let media;
async function poll() {
  while (!stopping) {
    try { await sync(); } catch { console.error('[ingest] State synchronization unavailable; retrying'); }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
async function start() {
  await new Promise((resolve) => control.listen(8001, '127.0.0.1', resolve));
  publicServer.listen(8000, '0.0.0.0');
  media = spawn('/usr/local/bin/mediamtx', ['/app/mediamtx.yml'], { stdio: 'inherit' });
  media.on('error', (err) => { console.error(err.message); process.exit(1); });
  media.on('exit', () => { if (!stopping) process.exit(1); });
  poll();
  console.log('Ingest: RTMP TCP 1935 / SRT UDP 8890 / public HLS HTTP 8000');
}
async function stop() {
  if (stopping) return;
  stopping = true;
  media?.kill('SIGINT');
  publicServer.close();
  control.close();
  try {
    await json(`${BACKEND}/streams/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channels: [] }) });
  } catch {}
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
start().catch((err) => { console.error(err); process.exit(1); });
