const {createServer} = require('http');
const {readFileSync, readdirSync, statSync, existsSync, appendFileSync, mkdirSync} = require('fs');
const {join} = require('path');

const DIR = join(__dirname, 'session');
const SCRIPTS = process.argv[2];
const PORT = 58256;

mkdirSync(DIR, {recursive: true});

let FRAME, HELPER;
try {
  FRAME = readFileSync(join(SCRIPTS, 'frame-template.html'), 'utf8');
  HELPER = readFileSync(join(SCRIPTS, 'helper.js'), 'utf8');
} catch(e) {
  FRAME = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Brainstorm</title></head><body>{{CONTENT}}<script>{{HELPER_SCRIPT}}</script></body></html>';
  HELPER = '';
}

function getNewestHtml() {
  if (!existsSync(DIR)) return null;
  const files = readdirSync(DIR).filter(f => f.endsWith('.html')).map(f => ({
    name: f, mtime: statSync(join(DIR, f)).mtimeMs
  })).sort((a,b) => b.mtime - a.mtime);
  return files[0] ? readFileSync(join(DIR, files[0].name), 'utf8') : null;
}

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/events' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      appendFileSync(join(DIR, '.events'), body + '\n');
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  const content = getNewestHtml();
  if (!content) {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end('<html><body style="background:#1a1a2e;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><p>Waiting for content...</p></body></html>');
    return;
  }
  let html;
  if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
    html = content;
  } else {
    html = FRAME.replace('{{CONTENT}}', content).replace('{{HELPER_SCRIPT}}', HELPER);
  }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(html);
});

server.listen(PORT, () => {
  console.log(JSON.stringify({type:'server-started', port:PORT, url:'http://localhost:'+PORT, screen_dir:DIR}));
});
