/**
 * Debug script: listens to Firebase RTDB /sync-rooms in real time using Admin SDK.
 * Run this, then tap Connect on your phone. You'll see the broadcast arrive.
 *
 * Usage: node scripts/debug-sync-listener.mjs
 * Press Ctrl+C to stop.
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const serviceAccount = JSON.parse(
  readFileSync(resolve('serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://the-kinetic-alphabet-default-rtdb.firebaseio.com'
});

const db = admin.database();
const roomsRef = db.ref('sync-rooms');

console.log('[sync-listener] Connected to Firebase RTDB with admin credentials.');
console.log('[sync-listener] Watching /sync-rooms — tap Connect on your phone now.\n');

roomsRef.on('value', (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    console.log(`[${new Date().toLocaleTimeString()}] /sync-rooms is EMPTY (null)`);
    return;
  }

  const rooms = Object.entries(data);
  console.log(`[${new Date().toLocaleTimeString()}] /sync-rooms has ${rooms.length} room(s):`);
  for (const [key, room] of rooms) {
    console.log(`  Room: ${key}`);
    console.log(`    host:        ${room.hostDisplayName} (${room.hostUserId})`);
    console.log(`    sessionId:   ${room.hostSessionId || '(not set)'}`);
    console.log(`    sequence:    ${room.sequenceWord} (${room.sequenceId})`);
    console.log(`    peerJsCode:  ${room.peerJsRoomCode}`);
    console.log(`    createdAt:   ${new Date(room.createdAt).toLocaleTimeString()}`);
  }
  console.log('');
}, (err) => {
  console.error('[sync-listener] Listen error:', err.message);
});

process.on('SIGINT', () => {
  console.log('\n[sync-listener] Stopped.');
  roomsRef.off();
  process.exit(0);
});
