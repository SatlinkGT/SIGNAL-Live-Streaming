const http = require('node:http');
let state = [];
let inputProtocol = "rtmp";
http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/select/srt' || req.url === '/select/rtmp') { inputProtocol = req.url.split('/')[2]; return res.end('{}'); }
  if (req.url === '/streams/validate/test-key') return res.end(JSON.stringify({ channelId: 'test-channel', slug: 'test-channel', inputProtocol }));
  if (req.url === '/streams/validate/second-key') return res.end(JSON.stringify({ channelId: 'second-channel', slug: 'second-channel', inputProtocol: 'srt' }));
  if (req.url === '/streams/sync') {
    let body = ''; for await (const c of req) body += c;
    state = JSON.parse(body).channels;
    return res.end('{}');
  }
  if (req.url === '/state') return res.end(JSON.stringify(state));
  res.writeHead(404).end('{}');
}).listen(3000, '127.0.0.1');
