// One-off: remove the bad simple_staff tip point override from config/effectPoints
// so it falls back to the hardcoded registry defaults (±135, the staff ends).
// See prop-tip-points.ts STAFF_TIP_POINTS.
const admin = require("firebase-admin");
const path = require("path");

const sa = require(path.join(__dirname, "../serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(sa) });

async function main() {
  const db = admin.firestore();
  const ref = db.doc("config/effectPoints");
  const snap = await ref.get();

  if (!snap.exists) {
    console.log("config/effectPoints does not exist — nothing to reset.");
    return;
  }

  const data = snap.data();
  console.log("BEFORE simple_staff:", JSON.stringify(data.simple_staff ?? null));

  if (data.simple_staff === undefined) {
    console.log("No simple_staff override present — already at system defaults.");
    return;
  }

  await ref.update({
    simple_staff: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: "reset-simple-staff-tip-points-script",
  });

  const after = await ref.get();
  console.log("AFTER simple_staff:", JSON.stringify(after.data().simple_staff ?? null));
  console.log("Override removed — app now falls back to registry defaults (±135).");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
