const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url;
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  // Vite-like behavior: check public/ first, then root
  const pathsToTry = [
    path.join(__dirname, 'public', urlPath),
    path.join(__dirname, urlPath)
  ];

  function tryNext(index) {
    if (index >= pathsToTry.length) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }

    const filePath = pathsToTry[index];
    fs.readFile(filePath, (error, content) => {
      if (error) {
        tryNext(index + 1);
      } else {
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = MIME_TYPES[extname] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }

  tryNext(0);
});

server.listen(PORT, () => {
  console.log(`\n🚀 [SKY DASH] Server running at http://localhost:${PORT}/`);
  console.log('✨ Graphics are now being served from /public and root.');
  console.log('🛑 Press Ctrl+C to stop.\n');
});
