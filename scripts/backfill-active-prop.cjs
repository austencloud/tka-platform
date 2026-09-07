// One-time backfill: mirror each user's settings prop selection onto their
// user doc as `activeProp`, so the browse creators queries (which can't reach
// the settings subcollection) can show a prop identity badge for everyone.
//
// Source: users/{uid}/settings/preferences.leftPropType
// Target: users/{uid}.activeProp
//
// Idempotent - skips users whose activeProp already matches. Going forward,
// FirebaseSettingsPersister.mirrorActiveProp() keeps the field current on
// every settings save.
//
// Usage: node scripts/backfill-active-prop.cjs [--dry-run]
const admin = require("firebase-admin");
const path = require("path");

const sa = require(path.join(__dirname, "../serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(sa) });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = admin.firestore();
  const users = await db.collection("users").select("activeProp").get();

  let written = 0;
  let skippedNoSetting = 0;
  let skippedCurrent = 0;

  for (const userDoc of users.docs) {
    const prefs = await db
      .doc(`users/${userDoc.id}/settings/preferences`)
      .get();
    const leftPropType = prefs.exists ? prefs.data().leftPropType : undefined;

    if (!leftPropType) {
      skippedNoSetting++;
      continue;
    }
    if (userDoc.data().activeProp === leftPropType) {
      skippedCurrent++;
      continue;
    }

    if (!dryRun) {
      await db.doc(`users/${userDoc.id}`).update({ activeProp: leftPropType });
    }
    written++;
    console.log(
      `${dryRun ? "[dry-run] would set" : "set"} ${userDoc.id} activeProp=${leftPropType}`
    );
  }

  console.log(
    `\nDone. ${written} written, ${skippedCurrent} already current, ${skippedNoSetting} had no prop setting, ${users.size} total users.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
