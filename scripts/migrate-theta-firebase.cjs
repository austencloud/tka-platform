/**
 * Firebase Migration Script: Replace lowercase θ with uppercase Θ
 *
 * This script updates all sequences in Firebase that contain lowercase θ:
 * 1. Updates the 'word' field
 * 2. Updates 'letter' fields in beats
 * 3. Updates thumbnail paths
 * 4. Optionally deletes old thumbnails from Storage
 *
 * Usage:
 *   node scripts/migrate-theta-firebase.cjs --dry-run     # Preview changes
 *   node scripts/migrate-theta-firebase.cjs               # Execute migration
 *   node scripts/migrate-theta-firebase.cjs --delete-old  # Also delete old thumbnails
 */

const admin = require('firebase-admin');
const path = require('path');

// Parse arguments
const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_OLD_THUMBNAILS = process.argv.includes('--delete-old');
const VERBOSE = process.argv.includes('--verbose');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'the-kinetic-alphabet.appspot.com'
  });
} catch (err) {
  console.error('❌ Failed to load Firebase service account.');
  console.error(`   Expected at: ${serviceAccountPath}`);
  console.error('   Please ensure serviceAccountKey.json exists in project root');
  process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Stats tracking
const stats = {
  sequencesFound: 0,
  sequencesUpdated: 0,
  thumbnailsDeleted: 0,
  errors: []
};

const log = (msg) => console.log(msg);
const verbose = (msg) => VERBOSE && console.log(`  ${msg}`);

/**
 * Replace θ with Θ in a string (handles both θ and θ-)
 */
function replaceTheta(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/θ-/g, 'Θ-').replace(/θ/g, 'Θ');
}

/**
 * Check if a value contains lowercase theta
 */
function containsLowercaseTheta(str) {
  return typeof str === 'string' && str.includes('θ');
}

/**
 * Update a sequence document
 */
function updateSequenceData(data) {
  const updates = {};
  let hasChanges = false;

  // Update word field
  if (containsLowercaseTheta(data.word)) {
    updates.word = replaceTheta(data.word);
    hasChanges = true;
  }

  // Update name field
  if (containsLowercaseTheta(data.name)) {
    updates.name = replaceTheta(data.name);
    hasChanges = true;
  }

  // Update beats array
  if (Array.isArray(data.beats)) {
    const updatedBeats = data.beats.map(beat => {
      if (containsLowercaseTheta(beat.letter)) {
        return { ...beat, letter: replaceTheta(beat.letter) };
      }
      return beat;
    });

    // Check if any beats changed
    const beatsChanged = data.beats.some((beat, i) =>
      containsLowercaseTheta(beat.letter)
    );

    if (beatsChanged) {
      updates.beats = updatedBeats;
      hasChanges = true;
    }
  }

  // Update thumbnails array
  if (Array.isArray(data.thumbnails)) {
    const updatedThumbnails = data.thumbnails.map(thumb => replaceTheta(thumb));
    const thumbnailsChanged = data.thumbnails.some(containsLowercaseTheta);

    if (thumbnailsChanged) {
      updates.thumbnails = updatedThumbnails;
      hasChanges = true;
    }
  }

  // Update thumbnail (singular) if exists
  if (containsLowercaseTheta(data.thumbnail)) {
    updates.thumbnail = replaceTheta(data.thumbnail);
    hasChanges = true;
  }

  return hasChanges ? updates : null;
}

/**
 * Delete old thumbnail from Storage
 */
async function deleteOldThumbnail(thumbnailPath) {
  if (!DELETE_OLD_THUMBNAILS || DRY_RUN) return;

  try {
    // Remove leading slash if present
    const filePath = thumbnailPath.startsWith('/') ? thumbnailPath.slice(1) : thumbnailPath;
    await bucket.file(filePath).delete();
    stats.thumbnailsDeleted++;
    verbose(`Deleted: ${filePath}`);
  } catch (err) {
    if (err.code !== 404) {
      stats.errors.push(`Failed to delete ${thumbnailPath}: ${err.message}`);
    }
  }
}

/**
 * Main migration function
 */
async function migrateSequences() {
  log('═══════════════════════════════════════════════════════════');
  log('  Firebase θ → Θ Migration');
  log('═══════════════════════════════════════════════════════════');

  if (DRY_RUN) {
    log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    const sequencesToUpdate = [];

    // 1. Query user sequences via collectionGroup (users/{userId}/sequences)
    log('\n📡 Fetching user sequences (collectionGroup)...');
    const userSequencesSnapshot = await db.collectionGroup('sequences').get();
    log(`   Found ${userSequencesSnapshot.size} user sequences`);

    userSequencesSnapshot.forEach(doc => {
      const data = doc.data();
      const updates = updateSequenceData(data);

      if (updates) {
        sequencesToUpdate.push({
          ref: doc.ref,
          id: doc.id,
          path: doc.ref.path,
          oldData: data,
          updates
        });
      }
    });

    // 2. Query publicSequences collection
    log('\n📡 Fetching public sequences...');
    const publicSequencesSnapshot = await db.collection('publicSequences').get();
    log(`   Found ${publicSequencesSnapshot.size} public sequences`);

    publicSequencesSnapshot.forEach(doc => {
      const data = doc.data();
      const updates = updateSequenceData(data);

      if (updates) {
        sequencesToUpdate.push({
          ref: doc.ref,
          id: doc.id,
          path: doc.ref.path,
          oldData: data,
          updates
        });
      }
    });

    stats.sequencesFound = sequencesToUpdate.length;
    log(`\n   Total: ${sequencesToUpdate.length} sequences contain lowercase θ\n`);

    if (sequencesToUpdate.length === 0) {
      log('✅ No sequences need updating!');
      return;
    }

    // Process updates
    log('📝 Processing updates...\n');

    for (const { ref, id, path, oldData, updates } of sequencesToUpdate) {
      verbose(`Updating: ${oldData.word || id} → ${updates.word || 'no word change'}`);

      if (!DRY_RUN) {
        try {
          await ref.update(updates);
          stats.sequencesUpdated++;

          // Delete old thumbnails if requested
          if (DELETE_OLD_THUMBNAILS && oldData.thumbnails) {
            for (const thumb of oldData.thumbnails) {
              if (containsLowercaseTheta(thumb)) {
                await deleteOldThumbnail(thumb);
              }
            }
          }
        } catch (err) {
          stats.errors.push(`Failed to update ${id}: ${err.message}`);
        }
      } else {
        stats.sequencesUpdated++;
      }
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

/**
 * Print summary and exit
 */
async function main() {
  await migrateSequences();

  log('\n═══════════════════════════════════════════════════════════');
  log('  Summary');
  log('═══════════════════════════════════════════════════════════');
  log(`  Sequences found with θ:   ${stats.sequencesFound}`);
  log(`  Sequences updated:        ${stats.sequencesUpdated}`);

  if (DELETE_OLD_THUMBNAILS) {
    log(`  Thumbnails deleted:       ${stats.thumbnailsDeleted}`);
  }

  if (stats.errors.length > 0) {
    log(`\n  ⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach(e => log(`    - ${e}`));
  }

  if (DRY_RUN) {
    log('\n  Run without --dry-run to apply changes.');
    log('  Add --delete-old to also delete old thumbnail files.');
  } else {
    log('\n  ✅ Firebase migration complete!');
    if (!DELETE_OLD_THUMBNAILS) {
      log('  💡 Run with --delete-old to clean up old thumbnail files.');
    }
  }

  process.exit(0);
}

main();
