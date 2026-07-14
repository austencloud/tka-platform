import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const uid = "pN1yIVYGv0PgVmOmqERkpAdSWYG2";
const seqs = await db.collection(`users/${uid}/sequences`).get();
console.log("=== sequences:", seqs.size);
for (const d of seqs.docs) {
  const v = d.data();
  console.log(JSON.stringify({
    id: d.id,
    word: v.word ?? v.name ?? null,
    visibility: v.visibility ?? null,
    isPublic: v.isPublic ?? null,
    length: v.beats?.length ?? v.steps?.length ?? v.metadata?.length ?? null,
    letters: (v.beats ?? v.steps ?? []).map(b => b.letter ?? b.beat?.letter ?? null).join(","),
    createdAt: v.createdAt?.toDate?.()?.toISOString?.() ?? v.createdAt ?? null,
    updatedAt: v.updatedAt?.toDate?.()?.toISOString?.() ?? null,
  }));
}

console.log("\n=== errorTelemetry Jul 7-10:");
const errs = await db.collection("errorTelemetry")
  .where("lastSeen", ">=", new Date("2026-07-07T00:00:00Z")).get();
for (const d of errs.docs) {
  const v = d.data();
  console.log(JSON.stringify({
    id: d.id, message: v.message, module: v.module, action: v.action,
    severity: v.severity, count: v.count,
    firstSeen: v.firstSeen?.toDate?.()?.toISOString?.(),
    lastSeen: v.lastSeen?.toDate?.()?.toISOString?.(),
    lastAdditionalData: v.lastAdditionalData ?? null,
  }));
}
