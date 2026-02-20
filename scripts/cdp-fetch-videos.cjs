const WebSocket = require('ws');

const pageId = '6AF19200EC5FB936CB4878A5F9C5C383';
const ws = new WebSocket(`ws://127.0.0.1:9222/devtools/page/${pageId}`);

const expression = `
  (async function() {
    var playlists = [
      { id: 'NjLAZPKzOq', name: 'From Stuck to Secure' },
      { id: '1ZbWxnqWLe', name: 'Your Questions Answered' },
      { id: '1ZbWxn2JLe', name: 'Live QA Replays' }
    ];
    var allVideos = [];
    for (var p of playlists) {
      var page = 1;
      while (true) {
        var r = await fetch('/api/hub/Jkjw7MrjdD/' + p.id + '/files?page=' + page);
        var d = await r.json();
        var files = d.data || [];
        if (files.length === 0) break;
        files.forEach(function(f) {
          allVideos.push({
            playlist: p.name,
            title: f.title,
            source_url: f.source_url
          });
        });
        if (!d.links || !d.links.next) break;
        page++;
      }
    }
    return JSON.stringify({ total: allVideos.length, videos: allVideos });
  })()
`;

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
setTimeout(() => { ws.close(); process.exit(0); }, 30000);
