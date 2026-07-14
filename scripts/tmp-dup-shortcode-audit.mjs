import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection("shortcodes").select("encoderHash", "createdAt", "scanCount").get();
console.log("total shortcode docs:", snap.size);

const byHash = new Map();
let noHash = 0;
for (const doc of snap.docs) {
  const h = doc.get("encoderHash");
  if (!h) { noHash++; continue; }
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push({
    code: doc.id,
    createdAt: doc.get("createdAt"),
    scans: doc.get("scanCount") ?? 0,
  });
}
console.log("docs without encoderHash (legacy):", noHash);
console.log("distinct hashes:", byHash.size);

const dups = [...byHash.values()].filter((v) => v.length > 1);
console.log("hashes with >1 code:", dups.length);

// Group-size histogram
const sizeHist = {};
for (const g of dups) sizeHist[g.length] = (sizeHist[g.length] ?? 0) + 1;
console.log("group-size histogram:", sizeHist);

// Time-delta between first and last doc in each duplicate group
const buckets = { "<=10ms": 0, "<=1s": 0, "<=1min": 0, "<=1h": 0, ">1h": 0 };
let scannedDupGroups = 0; // groups where MORE THAN ONE code has scans (real-world confusion)
let groupsWithAnyScan = 0;
for (const g of dups) {
  const times = g.map((d) => new Date(d.createdAt).getTime()).sort((a, b) => a - b);
  const delta = times[times.length - 1] - times[0];
  if (delta <= 10) buckets["<=10ms"]++;
  else if (delta <= 1000) buckets["<=1s"]++;
  else if (delta <= 60_000) buckets["<=1min"]++;
  else if (delta <= 3_600_000) buckets["<=1h"]++;
  else buckets[">1h"]++;
  const scanned = g.filter((d) => d.scans > 0).length;
  if (scanned >= 1) groupsWithAnyScan++;
  if (scanned > 1) scannedDupGroups++;
}
console.log("creation-spread buckets:", buckets);
console.log("dup groups with any scanned code:", groupsWithAnyScan);
console.log("dup groups where 2+ codes were scanned:", scannedDupGroups);

// Show the >1h groups (true cross-session duplicates, not the same-view race)
console.log("\n--- groups spread >1h (cross-session dedup failures) ---");
for (const g of dups) {
  const times = g.map((d) => new Date(d.createdAt).getTime()).sort((a, b) => a - b);
  if (times[times.length - 1] - times[0] > 3_600_000) {
    console.log(g.map((d) => `${d.code}@${d.createdAt}(scans=${d.scans})`).join("  "));
  }
}
process.exit(0);
