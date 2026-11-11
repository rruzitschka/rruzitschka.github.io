const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = process.argv[2] || '.';
const PORT = parseInt(process.argv[3] || '8080');

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url.split('?')[0]);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())
    filePath = path.join(filePath, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
