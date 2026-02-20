const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/6AF19200EC5FB936CB4878A5F9C5C383');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `
        const results = [];
        document.querySelectorAll('video, video source, iframe, [data-src]').forEach(el => {
          results.push({
            tag: el.tagName,
            src: el.src || el.getAttribute('src') || el.getAttribute('data-src') || '',
            type: el.type || '',
            className: el.className || ''
          });
        });
        const scripts = [...document.querySelectorAll('script')].map(s => s.src).filter(s => s);
        JSON.stringify({ elements: results, scriptCount: scripts.length, bodySnippet: document.body?.innerText?.slice(0, 3000) || '' });
      `,
      returnByValue: true
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1) {
    console.log(msg.result?.result?.value || JSON.stringify(msg.result, null, 2));
    ws.close();
  }
});

ws.on('error', (e) => { console.error('WS Error:', e.message); });
setTimeout(() => { ws.close(); process.exit(0); }, 5000);
