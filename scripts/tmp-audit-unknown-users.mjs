// Read-only audit: which users docs render as "Unknown" in the admin tab
// (missing displayName), who they are per Firebase Auth, and lastLocation
// coverage across all user docs.
import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection("users").get();
const noName = snap.docs.filter((d) => !d.data().displayName);
const noLoc = snap.docs.filter((d) => !d.data().lastLocation);
const locNoCity = snap.docs.filter((d) => d.data().lastLocation && !d.data().lastLocation.city);
console.log(`users total: ${snap.size}`);
console.log(`missing displayName ("Unknown" rows): ${noName.length}`);
console.log(`missing lastLocation entirely: ${noLoc.length}`);
console.log(`lastLocation present but city null: ${locNoCity.length}`);

for (const d of noName) {
  const data = d.data();
  console.log(`\n--- users/${d.id}`);
  console.log("fields:", Object.keys(data).sort().join(", "));
  console.log("isAnonymous:", data.isAnonymous, "| createdAt:", data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt, "| updatedAt:", data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt);
  if (data.lastLocation) console.log("lastLocation:", JSON.stringify(data.lastLocation));
  try {
    const authUser = await admin.auth().getUser(d.id);
    console.log("AUTH: email:", authUser.email ?? "(none)", "| providers:", authUser.providerData.map((p) => p.providerId).join(",") || "(anonymous)", "| created:", authUser.metadata.creationTime, "| lastSignIn:", authUser.metadata.lastSignInTime);
  } catch (e) {
    console.log("AUTH: no auth record (", e.code ?? e.message, ")");
  }
}

// City coverage summary for the docs that DO have a location
const cities = new Map();
for (const d of snap.docs) {
  const loc = d.data().lastLocation;
  if (loc?.city) cities.set(loc.city, (cities.get(loc.city) ?? 0) + 1);
}
console.log("\nlastLocation city counts:", JSON.stringify([...cities.entries()].sort((a, b) => b[1] - a[1])));
