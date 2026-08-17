/**
 * Download a recorded pronunciation corpus session into an MFA-ready folder.
 *
 * The recorder uploads to Firebase Storage so the reader is never asked where
 * to save anything. The aligner still wants a directory of `<id>.wav` beside
 * `<id>.lab`, so that directory is made here instead — on the machine that runs
 * the aligner, at the moment it is needed.
 *
 * Usage:
 *   node scripts/fetch-pronunciation-session.mjs <uid> [sessionId] [outDir]
 *
 * With no sessionId, the newest session for that uid is taken. Default outDir
 * is `tools/pronunciation/sessions/<sessionId>`, which is what align.py expects
 * to be pointed at.
 */

import admin from "firebase-admin";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "pronunciation-corpus";

const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + ".appspot.com",
  });
}

const [uid, requestedSession, requestedOut] = process.argv.slice(2);
if (!uid) {
  console.error("Usage: node scripts/fetch-pronunciation-session.mjs <uid> [sessionId] [outDir]");
  process.exit(1);
}

const bucket = admin.storage().bucket();

async function resolveSessionId() {
  if (requestedSession) return requestedSession;

  const [files] = await bucket.getFiles({ prefix: `${ROOT}/${uid}/` });
  // Session ids are ISO-stamped, so the newest is the last in lexical order.
  const ids = [...new Set(files.map((f) => f.name.split("/")[2]).filter(Boolean))].sort();
  if (ids.length === 0) throw new Error(`No sessions found under ${ROOT}/${uid}/`);
  return ids[ids.length - 1];
}

const sessionId = await resolveSessionId();
const prefix = `${ROOT}/${uid}/${sessionId}/`;
const outDir = requestedOut ?? path.join("tools", "pronunciation", "sessions", sessionId);

const [files] = await bucket.getFiles({ prefix });
if (files.length === 0) throw new Error(`No files under ${prefix}`);

mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const name = file.name.slice(prefix.length);
  if (!name) continue;
  const [contents] = await file.download();
  writeFileSync(path.join(outDir, name), contents);
}

// The count the aligner will see, checked against what the session believed it
// wrote — a partial download is otherwise indistinguishable from a short session.
const wavs = files.filter((f) => f.name.endsWith(".wav")).length;
let claimed = null;
try {
  claimed = JSON.parse(readFileSync(path.join(outDir, "session.json"), "utf8")).wordsRecorded;
} catch {
  // A session killed before its first word has no session.json. Not an error.
}

console.log(`${sessionId} -> ${outDir}`);
console.log(`  ${wavs} wav files downloaded${claimed === null ? "" : `, session.json claims ${claimed}`}`);
if (claimed !== null && claimed !== wavs) {
  console.error(`  MISMATCH: ${claimed} recorded but ${wavs} downloaded`);
  process.exit(1);
}
