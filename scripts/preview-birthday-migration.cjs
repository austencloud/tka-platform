/**
 * Preview Birthday Migration
 *
 * Compares legacy sequence dates against Firebase sequences to preview
 * what birthdays would be set during migration.
 *
 * KEY INSIGHT:
 * - Firebase sequences WITHOUT beats (372) = imported from legacy, match by word
 * - Firebase sequences WITH beats (59) = created in new app, use createdAt
 *
 * Prerequisites:
 *   1. Run: python scripts/extract-legacy-dates.py
 *   2. Ensure serviceAccountKey.json exists in project root
 *
 * Usage:
 *   node scripts/preview-birthday-migration.cjs                    # Show summary
 *   node scripts/preview-birthday-migration.cjs --verbose          # Show all matches
 *   node scripts/preview-birthday-migration.cjs --json             # Output JSON report
 *   node scripts/preview-birthday-migration.cjs --unmatched        # Show only unmatched
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Parse arguments
const VERBOSE = process.argv.includes('--verbose');
const JSON_OUTPUT = process.argv.includes('--json');
const SHOW_UNMATCHED = process.argv.includes('--unmatched');

// Paths
const LEGACY_DATA_PATH = path.join(__dirname, 'legacy-sequence-dates.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

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
 * Format date for display
 */
function formatDate(date) {
  if (!date) return 'N/A';
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return 'N/A';
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
 * Fetch all sequences from Firebase
 */
async function fetchFirebaseSequences(db) {
  const sequences = [];

  // User sequences (users/{userId}/sequences)
  const userSeqSnapshot = await db.collectionGroup('sequences').get();
  userSeqSnapshot.forEach(doc => {
    const data = doc.data();
    sequences.push({
      id: doc.id,
      path: doc.ref.path,
      userId: doc.ref.parent.parent?.id,
      word: data.word,
      beats: data.beats || [],
      hasBeats: (data.beats || []).length > 0,
      dateAdded: toDate(data.dateAdded),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });
  });

  return sequences;
}

/**
 * Find the best matching legacy version for a word
 * Returns the one with the earliest date_added (original birthday)
 */
function findBestLegacyMatch(word, legacyByWord) {
  const versions = legacyByWord.get(word);
  if (!versions || versions.length === 0) return null;

  // Sort by date_added ascending (earliest first)
  const sorted = [...versions].sort((a, b) => {
    const dateA = new Date(a.date_added || '9999');
    const dateB = new Date(b.date_added || '9999');
    return dateA - dateB;
  });

  return sorted[0];
}

/**
 * Main preview function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Birthday Migration Preview');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load data
  console.log('📁 Loading legacy data...');
  const legacyData = loadLegacyData();
  console.log(`   ${legacyData.sequences.length} sequences from legacy app`);
  console.log(`   Extracted: ${legacyData.extracted_at}\n`);

  console.log('📡 Fetching Firebase sequences...');
  const db = initFirebase();
  const firebaseSeqs = await fetchFirebaseSequences(db);
  console.log(`   ${firebaseSeqs.length} sequences from Firebase`);

  const withBeats = firebaseSeqs.filter(s => s.hasBeats).length;
  const withoutBeats = firebaseSeqs.filter(s => !s.hasBeats).length;
  console.log(`   - With beats (new app created): ${withBeats}`);
  console.log(`   - Without beats (legacy imports): ${withoutBeats}\n`);

  // Build legacy lookup by word
  const legacyByWord = new Map();
  for (const seq of legacyData.sequences) {
    const word = seq.word;
    if (!legacyByWord.has(word)) {
      legacyByWord.set(word, []);
    }
    legacyByWord.get(word).push(seq);
  }

  // Categorize Firebase sequences
  const results = {
    // Sequences created in new app (have beats) - use createdAt as birthday
    newAppCreated: [],

    // Legacy imports that matched by word - use legacy date_added as birthday
    legacyMatched: [],

    // Legacy imports with no word match - use Firebase dateAdded or createdAt
    legacyNoMatch: [],

    // Track legacy sequences not referenced in Firebase
    legacyUnused: [],

    // Multiple legacy versions for matched sequences
    multipleVersions: [],
  };

  // Track which legacy words were used
  const usedLegacyWords = new Set();

  for (const fbSeq of firebaseSeqs) {
    const word = fbSeq.word;

    if (fbSeq.hasBeats) {
      // Created in new app - use createdAt as birthday
      results.newAppCreated.push({
        word,
        firebaseId: fbSeq.id,
        userId: fbSeq.userId,
        beatCount: fbSeq.beats.length,
        birthday: fbSeq.createdAt,
        source: 'firebase_createdAt',
        action: 'use_createdAt_as_birthday',
      });
      continue;
    }

    // Legacy import (no beats) - try to match by word
    const legacyMatch = findBestLegacyMatch(word, legacyByWord);

    if (legacyMatch) {
      usedLegacyWords.add(word);
      const legacyDate = new Date(legacyMatch.date_added);
      const firebaseDateAdded = fbSeq.dateAdded;

      // Use whichever date is EARLIER as the true birthday
      const legacyIsEarlier = !firebaseDateAdded || legacyDate < firebaseDateAdded;
      const birthday = legacyIsEarlier ? legacyDate : firebaseDateAdded;
      const source = legacyIsEarlier ? 'legacy_date_added' : 'firebase_dateAdded';

      results.legacyMatched.push({
        word,
        firebaseId: fbSeq.id,
        userId: fbSeq.userId,
        legacyFile: legacyMatch.filename,
        legacyDate: legacyMatch.date_added,
        firebaseDateAdded: formatDate(firebaseDateAdded),
        birthday,
        source,
        action: legacyIsEarlier ? 'set_birthday_from_legacy' : 'keep_firebase_dateAdded',
        // Check if legacy date is earlier than Firebase date
        isEarlier: legacyIsEarlier,
      });

      // Track if multiple versions exist
      const versions = legacyByWord.get(word);
      if (versions.length > 1) {
        results.multipleVersions.push({
          word,
          versionCount: versions.length,
          selectedVersion: legacyMatch.filename,
          selectedDate: legacyMatch.date_added,
          allVersions: versions.map(v => ({
            filename: v.filename,
            date_added: v.date_added,
          })),
        });
      }
    } else {
      // No legacy match - use Firebase dateAdded or createdAt
      const birthday = fbSeq.dateAdded || fbSeq.createdAt;
      results.legacyNoMatch.push({
        word,
        firebaseId: fbSeq.id,
        userId: fbSeq.userId,
        firebaseDateAdded: formatDate(fbSeq.dateAdded),
        firebaseCreatedAt: formatDate(fbSeq.createdAt),
        birthday,
        source: fbSeq.dateAdded ? 'firebase_dateAdded' : 'firebase_createdAt',
        action: 'use_firebase_date',
      });
    }
  }

  // Find legacy sequences not used
  for (const [word, versions] of legacyByWord.entries()) {
    if (!usedLegacyWords.has(word)) {
      results.legacyUnused.push({
        word,
        versionCount: versions.length,
        versions: versions.map(v => ({
          filename: v.filename,
          date_added: v.date_added,
        })),
      });
    }
  }

  // Output results
  if (JSON_OUTPUT) {
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        firebase_total: firebaseSeqs.length,
        firebase_with_beats: withBeats,
        firebase_without_beats: withoutBeats,
        legacy_total: legacyData.sequences.length,
        new_app_created: results.newAppCreated.length,
        legacy_matched: results.legacyMatched.length,
        legacy_no_match: results.legacyNoMatch.length,
        legacy_unused: results.legacyUnused.length,
        multiple_versions: results.multipleVersions.length,
      },
      results,
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Summary output
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Migration Plan');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('  Firebase sequences to update:\n');
    console.log(`    ✅ Legacy matched (use legacy date):        ${results.legacyMatched.length}`);
    console.log(`    🆕 New app created (use createdAt):         ${results.newAppCreated.length}`);
    console.log(`    📦 No legacy match (use Firebase date):     ${results.legacyNoMatch.length}`);
    console.log(`    ─────────────────────────────────────────`);
    console.log(`    Total:                                      ${firebaseSeqs.length}`);

    if (results.multipleVersions.length > 0) {
      console.log(`\n  ℹ️  ${results.multipleVersions.length} words have multiple legacy versions`);
      console.log(`     (earliest date will be used as birthday)`);
    }

    if (results.legacyUnused.length > 0) {
      console.log(`\n  📁 ${results.legacyUnused.length} legacy sequences not in Firebase`);
    }

    // Show details based on flags
    if (VERBOSE) {
      if (results.legacyMatched.length > 0) {
        console.log('\n─────────────────────────────────────────────────────────');
        console.log('  Legacy Matched (sample)');
        console.log('─────────────────────────────────────────────────────────');
        for (const item of results.legacyMatched.slice(0, 10)) {
          const earlier = item.isEarlier ? '✓ earlier' : '≈ same/later';
          console.log(`  ${item.word}`);
          console.log(`    Legacy: ${formatDate(item.legacyDate)} (${item.legacyFile})`);
          console.log(`    Firebase dateAdded: ${item.firebaseDateAdded} ${earlier}`);
          console.log();
        }
        if (results.legacyMatched.length > 10) {
          console.log(`  ... and ${results.legacyMatched.length - 10} more`);
        }
      }
    }

    if (SHOW_UNMATCHED && results.legacyNoMatch.length > 0) {
      console.log('\n─────────────────────────────────────────────────────────');
      console.log('  No Legacy Match (will use Firebase date)');
      console.log('─────────────────────────────────────────────────────────');
      for (const item of results.legacyNoMatch) {
        console.log(`  ${item.word}`);
        console.log(`    User: ${item.userId}`);
        console.log(`    Using: ${item.source}`);
        console.log();
      }
    }

    // Final action summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Ready to Migrate');
    console.log('═══════════════════════════════════════════════════════════\n');

    const willGetLegacyBirthday = results.legacyMatched.filter(s => s.isEarlier).length;
    const willKeepFirebaseBirthday = results.legacyMatched.filter(s => !s.isEarlier).length;
    const willGetFirebaseBirthday = results.newAppCreated.length + results.legacyNoMatch.length + willKeepFirebaseBirthday;

    console.log(`  🎂 ${willGetLegacyBirthday} sequences will get birthday from legacy (earlier)`);
    console.log(`  📅 ${willGetFirebaseBirthday} sequences will use Firebase date as birthday`);
    if (willKeepFirebaseBirthday > 0) {
      console.log(`     (includes ${willKeepFirebaseBirthday} where Firebase was already earlier)`);
    }

    if (!VERBOSE) {
      console.log('\n  💡 Run with --verbose to see matched sequences');
    }
    if (!SHOW_UNMATCHED && results.legacyNoMatch.length > 0) {
      console.log('  💡 Run with --unmatched to see sequences without legacy match');
    }
    console.log('  💡 Run with --json for full report');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
