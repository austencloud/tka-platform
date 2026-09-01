#!/usr/bin/env node
/**
 * Send test admin QR-scan notifications to Austen's inbox so the new look can
 * be seen end to end (inbox card → click → Scan Atlas map + card peek).
 *
 * Writes real notification docs into users/{uid}/notifications, which also
 * triggers the deployed onNewNotification → FCM push. Picks a real owned card
 * and a real recent scan location so the click destination actually resolves.
 *
 * Usage: node scripts/_send-test-scan-notification.mjs
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, "..", "serviceAccountKey.json"), "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}
const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAIL = "austencloud@gmail.com";

// Minimal port of simplifyRepeatedWord — smallest repeating unit (FΨFΨ → FΨ).
function simplifyRepeatedWord(word) {
  if (!word) return word;
  const n = word.length;
  for (let i = 1; i <= Math.floor(n / 2); i++) {
    const p = word.substring(0, i);
    if (n % i === 0) {
      let ok = true;
      for (let j = 0; j < n; j += i)
        if (word.substring(j, j + i) !== p) {
          ok = false;
          break;
        }
      if (ok) return p;
    }
  }
  return word;
}

async function pickCardAndLocation(uid) {
  // Prefer a real recent scan that has coordinates — most authentic.
  try {
    const events = await db
      .collectionGroup("scanEvents")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();
    for (const d of events.docs) {
      const e = d.data();
      const m = d.ref.path.match(/^shortcodes\/([^/]+)\/scanEvents\//);
      const code = m?.[1];
      const lat = Number(e.lat);
      const lng = Number(e.lng);
      if (code && e.city && Number.isFinite(lat) && Number.isFinite(lng)) {
        const parent = await db.collection("shortcodes").doc(code).get();
        const p = parent.data() ?? {};
        return {
          code,
          word: p.sequenceName || p.word || p.sequence || code,
          city: e.city,
          country: e.country ?? null,
          lat,
          lng,
        };
      }
    }
  } catch (err) {
    console.warn("scanEvents lookup skipped:", err.message);
  }

  // Fallback: any card Austen owns, placed at Portland for the demo.
  const owned = await db
    .collection("shortcodes")
    .where("ownerId", "==", uid)
    .limit(1)
    .get();
  const doc = owned.docs[0];
  const p = doc?.data() ?? {};
  return {
    code: doc?.id ?? "DEMO",
    word: p.sequenceName || p.word || p.sequence || "FΨFΨ",
    city: "Portland",
    country: "US",
    lat: 45.5152,
    lng: -122.6784,
  };
}

async function main() {
  const uid = (await auth.getUserByEmail(ADMIN_EMAIL)).uid;
  const card = await pickCardAndLocation(uid);
  const label = simplifyRepeatedWord(card.word);
  const where = [card.city, card.country].filter(Boolean).join(", ");
  const col = db.collection("users").doc(uid).collection("notifications");

  const common = {
    userId: uid,
    type: "admin-qr-scan",
    read: false,
    shortCode: card.code,
    scanCity: card.city,
    scanCountry: card.country,
    scanLat: card.lat,
    scanLng: card.lng,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // 1) Single anonymous scan — simplified word + location + interactive target.
  const single = await col.add({
    ...common,
    message: `"${label}" scanned${where ? ` in ${where}` : ""}`,
    scanCount: 1,
    cities: card.city ? [card.city] : [],
    codes: [card.code],
  });

  // 2) Rolling digest — the coalesced-burst format.
  const digest = await col.add({
    ...common,
    message: `9 scans · 3 cities · last 10 min`,
    scanCount: 9,
    cities: [card.city, "Austin", "Seattle"].filter(Boolean),
    codes: [card.code],
  });

  console.log("\n✅ Sent 2 test notifications to", ADMIN_EMAIL, `(uid ${uid})`);
  console.log("   Card:", card.code, "· word", card.word, "→", label);
  console.log("   Location:", where, `(${card.lat}, ${card.lng})`);
  console.log("   1) single :", single.id, `→ "${label}" scanned in ${where}`);
  console.log("   2) digest :", digest.id, "→ 9 scans · 3 cities · last 10 min");
  console.log(
    "\nOpen the inbox on https://localhost:5173, tap either one → map flies to the pin + card peek."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
