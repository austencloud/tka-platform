/**
 * Debug Beat Structure Comparison
 *
 * Shows side-by-side comparison of legacy vs Firebase beat structure
 * to understand the differences for proper matching.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const LEGACY_DATA_PATH = path.join(__dirname, 'legacy-sequence-dates.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

// Initialize Firebase
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Target word to compare (can be passed as argument)
const TARGET_WORD = process.argv[2] || 'AB';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Debug Beat Structure: "${TARGET_WORD}"`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load legacy data
  const legacyData = JSON.parse(fs.readFileSync(LEGACY_DATA_PATH, 'utf-8'));
  const legacySeqs = legacyData.sequences.filter(s => s.word === TARGET_WORD);

  console.log(`Found ${legacySeqs.length} legacy version(s)\n`);

  for (const legacy of legacySeqs) {
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  LEGACY: ${legacy.filename}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  Date added: ${legacy.date_added}`);
    console.log(`  Beat count (raw): ${legacy.beat_count}`);
    console.log(`  Beats normalized length: ${legacy.beats_normalized.length}`);
    console.log('\n  Raw beats structure:');

    for (const beat of legacy.beats_raw.slice(0, 3)) {
      console.log(`\n  Beat ${beat.beat}:`);
      console.log(`    letter: ${beat.letter}`);
      if (beat.blue_attributes) {
        console.log(`    blue: ${beat.blue_attributes.motion_type} | ${beat.blue_attributes.start_loc}→${beat.blue_attributes.end_loc} | ${beat.blue_attributes.prop_rot_dir} | turns:${beat.blue_attributes.turns}`);
      }
      if (beat.red_attributes) {
        console.log(`    red:  ${beat.red_attributes.motion_type} | ${beat.red_attributes.start_loc}→${beat.red_attributes.end_loc} | ${beat.red_attributes.prop_rot_dir} | turns:${beat.red_attributes.turns}`);
      }
    }
    if (legacy.beats_raw.length > 3) {
      console.log(`\n    ... and ${legacy.beats_raw.length - 3} more beats`);
    }
  }

  // Fetch Firebase data
  console.log('\n\n─────────────────────────────────────────────────────────');
  console.log('  FIREBASE');
  console.log('─────────────────────────────────────────────────────────');

  // Fetch all sequences and filter in memory (collectionGroup + where needs index)
  const allSnapshot = await db.collectionGroup('sequences').get();
  const matchingDocs = allSnapshot.docs.filter(doc => doc.data().word === TARGET_WORD);
  console.log(`  Found ${matchingDocs.length} Firebase sequence(s) (from ${allSnapshot.size} total)\n`);

  for (const doc of matchingDocs) {
    const data = doc.data();
    console.log(`  ID: ${doc.id}`);
    console.log(`  Path: ${doc.ref.path}`);
    console.log(`  Beats array length: ${(data.beats || []).length}`);
    console.log(`  Has startPosition: ${data.startPosition ? 'yes' : 'no'}`);
    console.log(`  Has startingPositionBeat: ${data.startingPositionBeat ? 'yes' : 'no'}`);

    // Show start position if exists
    if (data.startPosition) {
      console.log('\n  Start Position:');
      const sp = data.startPosition;
      console.log(`    letter: ${sp.letter}`);
      if (sp.motions?.blue) {
        const blue = sp.motions.blue;
        console.log(`    blue: ${blue.motionType} | ${blue.startLocation}→${blue.endLocation} | ${blue.rotationDirection} | turns:${blue.turns}`);
      }
      if (sp.motions?.red) {
        const red = sp.motions.red;
        console.log(`    red:  ${red.motionType} | ${red.startLocation}→${red.endLocation} | ${red.rotationDirection} | turns:${red.turns}`);
      }
    }

    // Show first few beats
    console.log('\n  Beats:');
    for (const beat of (data.beats || []).slice(0, 3)) {
      console.log(`\n  Beat ${beat.beatNumber}:`);
      console.log(`    letter: ${beat.letter}`);
      if (beat.motions?.blue) {
        const blue = beat.motions.blue;
        console.log(`    blue: ${blue.motionType} | ${blue.startLocation}→${blue.endLocation} | ${blue.rotationDirection} | turns:${blue.turns}`);
      }
      if (beat.motions?.red) {
        const red = beat.motions.red;
        console.log(`    red:  ${red.motionType} | ${red.startLocation}→${red.endLocation} | ${red.rotationDirection} | turns:${red.turns}`);
      }
    }
    if ((data.beats || []).length > 3) {
      console.log(`\n    ... and ${data.beats.length - 3} more beats`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
