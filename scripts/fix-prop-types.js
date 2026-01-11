/**
 * Fix PropType Data Migration
 *
 * This script fixes invalid propType values in the database:
 * - "fans" -> "fan"
 * - "staffs" -> "staff"
 * - "clubs" -> "club"
 * - etc.
 *
 * Run: node scripts/fix-prop-types.js [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without modifying database
 *   --confirm    Actually apply changes to database
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Valid PropType values from PropType.ts enum
const VALID_PROP_TYPES = new Set([
  'staff', 'simple_staff', 'bigstaff', 'staff_v2',
  'club', 'bigclub',
  'fan', 'bigfan',
  'triad', 'bigtriad',
  'minihoop', 'bighoop',
  'buugeng', 'bigbuugeng', 'fractalgeng',
  'hand',
  'triquetra', 'triquetra2',
  'sword',
  'chicken', 'bigchicken',
  'guitar', 'ukulele',
  'doublestar', 'bigdoublestar',
  'eightrings', 'bigeightrings',
  'quiad'
]);

// Mapping of invalid values to correct values
const PROP_TYPE_FIXES = {
  'fans': 'fan',
  'staffs': 'staff',
  'clubs': 'club',
  'hoops': 'minihoop',
  'triads': 'triad',
  'hands': 'hand',
  'swords': 'sword'
};

function normalizePropType(propType) {
  if (!propType) return null;

  const lower = propType.toLowerCase();

  // Check if it's already valid
  if (VALID_PROP_TYPES.has(lower)) {
    return lower === propType ? null : lower; // Return null if no change needed
  }

  // Check if it's a known fix
  if (PROP_TYPE_FIXES[lower]) {
    return PROP_TYPE_FIXES[lower];
  }

  // Unknown prop type - flag for manual review
  return { unknown: true, original: propType };
}

async function initFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  // Try multiple locations for service account
  const possiblePaths = [
    path.join(__dirname, '..', 'serviceAccountKey.json'),
    path.join(__dirname, '..', 'firebase-service-account.json'),
    path.join(__dirname, '..', 'config', 'firebase-service-account.json'),
  ];

  let serviceAccountPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      serviceAccountPath = p;
      break;
    }
  }

  if (!serviceAccountPath) {
    console.error('❌ Firebase service account not found. Checked:');
    possiblePaths.forEach(p => console.error('  -', p));
    console.error('');
    console.error('To use this script:');
    console.error('1. Go to Firebase Console > Project Settings > Service Accounts');
    console.error('2. Click "Generate new private key"');
    console.error('3. Save as firebase-service-account.json in project root or config/');
    process.exit(1);
  }

  console.log('Using service account:', serviceAccountPath);
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  initializeApp({
    credential: cert(serviceAccount)
  });

  return getFirestore();
}

async function scanPublicSequences(db, dryRun) {
  console.log('');
  console.log('📊 Scanning publicSequences collection...');
  console.log('');

  const publicSeqRef = db.collection('publicSequences');
  const snapshot = await publicSeqRef.get();

  const issues = [];
  const unknownTypes = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const propType = data.propType;

    if (propType) {
      const fix = normalizePropType(propType);

      if (fix && fix.unknown) {
        unknownTypes.push({ id: doc.id, word: data.word, propType: fix.original });
      } else if (fix) {
        issues.push({
          collection: 'publicSequences',
          id: doc.id,
          word: data.word,
          sourceRef: data.sourceRef,
          oldValue: propType,
          newValue: fix
        });
      }
    }
  }

  console.log(`Found ${snapshot.size} public sequences`);
  console.log(`  - ${issues.length} need propType fixes`);
  console.log(`  - ${unknownTypes.length} have unknown propTypes`);

  return { issues, unknownTypes };
}

async function applyFixes(db, issues, dryRun) {
  if (issues.length === 0) {
    console.log('');
    console.log('✅ No propType fixes needed!');
    return;
  }

  console.log('');
  console.log('📝 PropType fixes needed:');
  console.log('');

  for (const issue of issues) {
    console.log(`  ${issue.word} (${issue.collection}/${issue.id})`);
    console.log(`    "${issue.oldValue}" → "${issue.newValue}"`);
    if (issue.sourceRef) {
      console.log(`    Source: ${issue.sourceRef}`);
    }
  }

  if (dryRun) {
    console.log('');
    console.log('🔍 DRY RUN - No changes made');
    console.log('');
    console.log('Run with --confirm to apply these fixes');
    return;
  }

  console.log('');
  console.log('⏳ Applying fixes...');

  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;

  for (const issue of issues) {
    const docRef = db.collection(issue.collection).doc(issue.id);
    batch.update(docRef, { propType: issue.newValue });
    batchCount++;

    // Firestore batch limit is 500
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit();
      batchCount = 0;
      console.log(`  Committed batch of ${MAX_BATCH_SIZE} updates`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} updates`);
  }

  console.log('');
  console.log(`✅ Fixed ${issues.length} propType values`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm');

  if (args.includes('--help')) {
    console.log('Usage: node scripts/fix-prop-types.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run    Preview changes without modifying database (default)');
    console.log('  --confirm    Actually apply changes to database');
    console.log('  --help       Show this help message');
    process.exit(0);
  }

  console.log('🔧 PropType Data Migration');
  console.log('==========================');

  if (dryRun) {
    console.log('Mode: DRY RUN (use --confirm to apply changes)');
  } else {
    console.log('Mode: LIVE - Changes will be applied to database');
  }

  const db = await initFirebase();

  const { issues, unknownTypes } = await scanPublicSequences(db, dryRun);

  if (unknownTypes.length > 0) {
    console.log('');
    console.log('⚠️  Unknown propTypes (need manual review):');
    for (const item of unknownTypes) {
      console.log(`  ${item.word}: "${item.propType}"`);
    }
  }

  await applyFixes(db, issues, dryRun);

  console.log('');
  console.log('Done!');
}

main().catch(console.error);
