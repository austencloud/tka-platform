const WebSocket = require('ws');

const pageId = process.argv[2] || '6AF19200EC5FB936CB4878A5F9C5C383';
const expression = process.argv[3];

if (!expression) {
  console.error('Usage: node cdp-eval.cjs <pageId> "<expression>"');
  process.exit(1);
}

const ws = new WebSocket(`ws://127.0.0.1:9222/devtools/page/${pageId}`);

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, returnByValue: true, awaitPromise: true }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1) {
    const val = msg.result?.result?.value;
    if (val !== undefined) {
      console.log(typeof val === 'string' ? val : JSON.stringify(val, null, 2));
    } else {
      console.log(JSON.stringify(msg.result, null, 2));
    }
    ws.close();
  }
});

ws.on('error', (e) => { console.error('WS Error:', e.message); });
setTimeout(() => { ws.close(); process.exit(0); }, 15000);
