#!/usr/bin/env node
/**
 * Find user sequences containing gamma (γ) character
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ serviceAccountKey.json not found in project root");
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();

async function findEmptyPublicSequences() {
  // Get all users
  const usersSnap = await db.collection('users').get();
  console.log('Checking user sequences for empty public ones...\n');

  let emptyPublicSeqs = [];

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();

    const seqSnap = await db.collection(`users/${userId}/sequences`).get();

    seqSnap.forEach(seqDoc => {
      const data = seqDoc.data();
      const word = data.word || data.name || seqDoc.id;
      const steps = data.steps || data.beats || [];
      const visibility = data.visibility || 'unknown';

      // Find public sequences with 0 steps
      if (visibility === 'public' && steps.length === 0) {
        emptyPublicSeqs.push({
          id: seqDoc.id,
          word,
          userId,
          displayName: userData.displayName || 'Unknown',
          visibility,
        });
      }
    });
  }

  return emptyPublicSeqs;
}

async function deleteEmptySequences(sequences) {
  console.log(`\nDeleting ${sequences.length} empty sequences...\n`);

  let deleted = 0;
  let failed = 0;

  for (const seq of sequences) {
    try {
      await db.collection(`users/${seq.userId}/sequences`).doc(seq.id).delete();
      console.log(`✅ Deleted: "${seq.word}" (${seq.displayName})`);
      deleted++;
    } catch (error) {
      console.log(`❌ Failed to delete "${seq.word}": ${error.message}`);
      failed++;
    }
  }

  return { deleted, failed };
}

async function main() {
  const shouldDelete = process.argv.includes("--delete");

  const emptyPublicSeqs = await findEmptyPublicSequences();

  console.log('Empty public sequences (0 steps):');
  emptyPublicSeqs.forEach(s => {
    console.log(`  ${s.displayName}: "${s.word}"`);
  });
  console.log(`\nTotal: ${emptyPublicSeqs.length}`);

  if (emptyPublicSeqs.length === 0) {
    console.log('\n✨ No empty public sequences found!');
    process.exit(0);
  }

  if (shouldDelete) {
    const { deleted, failed } = await deleteEmptySequences(emptyPublicSeqs);
    console.log("\n" + "=".repeat(60));
    console.log(`Deleted: ${deleted}, Failed: ${failed}`);
  } else {
    console.log('\n⚠️  DRY RUN - no changes made');
    console.log('Run with --delete to remove these empty sequences');
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
