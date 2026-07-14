// Read-only: what traces did users/RMTg4iBHpBNhHbgGju2Xwpzh9C82 leave?
// Auth record is gone — figure out if this was a real account (self-deleted)
// or an anonymous dev session whose auth record was cleaned up.
import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://the-kinetic-alphabet-default-rtdb.firebaseio.com",
});
const db = admin.firestore();
const uid = "RMTg4iBHpBNhHbgGju2Xwpzh9C82";

// RTDB presence remnant (has lastSeen/displayName/email/isAnonymous at session time)
const presenceSnap = await admin.database().ref(`presence/${uid}`).get();
console.log("RTDB presence:", presenceSnap.exists() ? JSON.stringify(presenceSnap.val(), null, 1) : "(none)");

// Activity log (session events)
const activity = await db.collection(`users/${uid}/activityLog`).orderBy("timestamp", "desc").limit(5).get().catch(() => null);
console.log("activityLog docs:", activity ? activity.size : "(query failed)");
activity?.docs.forEach((d) => {
  const x = d.data();
  console.log(" -", x.eventType, x.timestamp?.toDate?.()?.toISOString?.() ?? x.timestamp);
});

// Owned content across likely collections
for (const [coll, field] of [
  ["sequences", "userId"],
  ["sequences", "ownerId"],
  ["collections", "ownerId"],
  ["shortcodes", "ownerId"],
]) {
  const s = await db.collection(coll).where(field, "==", uid).limit(3).get().catch((e) => ({ error: e.message }));
  if (s.error) console.log(`${coll}.${field}: query error (${s.error})`);
  else console.log(`${coll}.${field} == uid: ${s.size} docs${s.size ? " e.g. " + s.docs[0].id : ""}`);
}

// Subcollections under the user doc (settings etc. survive doc deletion)
const subcolls = await db.doc(`users/${uid}`).listCollections();
console.log("subcollections under users/{uid}:", subcolls.map((c) => c.id).join(", ") || "(none)");
for (const c of subcolls) {
  const s = await c.limit(3).get();
  console.log(` ${c.id}: ${s.size} docs, sample:`, s.docs[0] ? JSON.stringify(s.docs[0].data()).slice(0, 200) : "-");
}
