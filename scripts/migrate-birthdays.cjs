/**
 * Birthday Migration Script
 *
 * Migrates birthday field to all Firebase sequences.
 * Uses legacy date_added where available, otherwise uses Firebase dateAdded/createdAt.
 *
 * Prerequisites:
 *   1. Run: python scripts/extract-legacy-dates.py
 *   2. Ensure serviceAccountKey.json exists in project root
 *
 * Usage:
 *   node scripts/migrate-birthdays.cjs --dry-run    # Preview changes
 *   node scripts/migrate-birthdays.cjs              # Execute migration
 *   node scripts/migrate-birthdays.cjs --verbose    # Execute with detailed logging
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Parse arguments
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Paths
const LEGACY_DATA_PATH = path.join(__dirname, 'legacy-sequence-dates.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

// Stats
const stats = {
  total: 0,
  updatedFromLegacy: 0,
  updatedFromFirebase: 0,
  alreadyHasBirthday: 0,
  errors: [],
};

/**
 * Convert Firestore timestamp to Date
 */
function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return null;
}

/**
 * Initialize Firebase Admin
 */
function initFirebase() {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin.firestore();
  } catch (err) {
    console.error('❌ Failed to initialize Firebase.');
    console.error(`   Expected service account at: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
  }
}

/**
 * Load legacy sequence data
 */
function loadLegacyData() {
  if (!fs.existsSync(LEGACY_DATA_PATH)) {
    console.error('❌ Legacy data not found.');
    console.error(`   Expected at: ${LEGACY_DATA_PATH}`);
    console.error('   Run first: python scripts/extract-legacy-dates.py');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(LEGACY_DATA_PATH, 'utf-8'));
}

/**
 * Find the best matching legacy version for a word (earliest date)
 */
function findBestLegacyMatch(word, legacyByWord) {
  const versions = legacyByWord.get(word);
  if (!versions || versions.length === 0) return null;

  const sorted = [...versions].sort((a, b) => {
    const dateA = new Date(a.date_added || '9999');
    const dateB = new Date(b.date_added || '9999');
    return dateA - dateB;
  });

  return sorted[0];
}

/**
 * Main migration function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Birthday Migration');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Load data
  console.log('📁 Loading legacy data...');
  const legacyData = loadLegacyData();
  console.log(`   ${legacyData.sequences.length} sequences from legacy app\n`);

  // Build legacy lookup by word
  const legacyByWord = new Map();
  for (const seq of legacyData.sequences) {
    const word = seq.word;
    if (!legacyByWord.has(word)) {
      legacyByWord.set(word, []);
    }
    legacyByWord.get(word).push(seq);
  }

  console.log('📡 Connecting to Firebase...');
  const db = initFirebase();

  // Fetch all sequences
  console.log('📡 Fetching all sequences...');
  const snapshot = await db.collectionGroup('sequences').get();
  stats.total = snapshot.size;
  console.log(`   ${stats.total} sequences found\n`);

  console.log('🔄 Processing sequences...\n');

  // Process in batches for Firestore efficiency
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;
  let processedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const word = data.word;
    const existingBirthday = toDate(data.birthday);

    // Skip if already has birthday
    if (existingBirthday) {
      stats.alreadyHasBirthday++;
      if (VERBOSE) {
        console.log(`  ⏭️  ${word} - already has birthday: ${existingBirthday.toISOString().split('T')[0]}`);
      }
      continue;
    }

    // Determine birthday
    let birthday = null;
    let source = null;

    const hasBeats = (data.beats || []).length > 0;
    const firebaseDateAdded = toDate(data.dateAdded);
    const firebaseCreatedAt = toDate(data.createdAt);

    if (!hasBeats) {
      // Legacy import - try to match by word
      const legacyMatch = findBestLegacyMatch(word, legacyByWord);

      if (legacyMatch) {
        const legacyDate = new Date(legacyMatch.date_added);
        // Use whichever is earlier
        if (!firebaseDateAdded || legacyDate < firebaseDateAdded) {
          birthday = legacyDate;
          source = 'legacy';
        } else {
          birthday = firebaseDateAdded;
          source = 'firebase_dateAdded';
        }
      } else {
        // No legacy match - use Firebase date
        birthday = firebaseDateAdded || firebaseCreatedAt || new Date();
        source = firebaseDateAdded ? 'firebase_dateAdded' : 'firebase_createdAt';
      }
    } else {
      // New app created - use createdAt
      birthday = firebaseCreatedAt || new Date();
      source = 'firebase_createdAt';
    }

    if (birthday) {
      if (!DRY_RUN) {
        batch.update(doc.ref, { birthday });
        batchCount++;

        // Commit batch when it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
          console.log(`   Committed ${processedCount + 1} updates...`);
        }
      }

      if (source === 'legacy') {
        stats.updatedFromLegacy++;
      } else {
        stats.updatedFromFirebase++;
      }

      if (VERBOSE) {
        console.log(`  ✅ ${word} - birthday: ${birthday.toISOString().split('T')[0]} (from ${source})`);
      }
    }

    processedCount++;
  }

  // Commit remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`   Committed final ${batchCount} updates`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`  Total sequences:              ${stats.total}`);
  console.log(`  Already had birthday:         ${stats.alreadyHasBirthday}`);
  console.log(`  Updated from legacy:          ${stats.updatedFromLegacy}`);
  console.log(`  Updated from Firebase date:   ${stats.updatedFromFirebase}`);

  const totalUpdated = stats.updatedFromLegacy + stats.updatedFromFirebase;
  console.log(`  ─────────────────────────────`);
  console.log(`  Total updated:                ${totalUpdated}`);

  if (stats.errors.length > 0) {
    console.log(`\n  ⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`    - ${e}`));
  }

  if (DRY_RUN) {
    console.log('\n  Run without --dry-run to apply changes.');
  } else {
    console.log('\n  ✅ Migration complete!');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
