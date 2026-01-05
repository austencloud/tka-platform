#!/usr/bin/env node

/**
 * Purge Thumbnail Cache
 *
 * Deletes all thumbnails from Firebase Storage to force regeneration.
 * Use this when cached thumbnails have become corrupted (e.g., wrong prop rendered).
 *
 * Usage:
 *   node scripts/purge-thumbnail-cache.js           # Preview what would be deleted
 *   node scripts/purge-thumbnail-cache.js --confirm # Actually delete
 *   node scripts/purge-thumbnail-cache.js --prop staff  # Only delete staff thumbnails
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse args
const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const propFilter = args.find(a => a.startsWith('--prop='))?.split('=')[1]
  || (args.includes('--prop') ? args[args.indexOf('--prop') + 1] : null);

// Initialize Firebase Admin
const serviceAccountPath = resolve(process.cwd(), 'serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (err) {
  console.error('❌ Could not read Firebase service account key.');
  console.error('   Expected at: config/firebase-admin-key.json');
  console.error('   Download from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'the-kinetic-alphabet.firebasestorage.app'
});

const bucket = getStorage().bucket();

async function listThumbnails() {
  const prefix = propFilter ? `thumbnails/${propFilter}/` : 'thumbnails/';
  const [files] = await bucket.getFiles({ prefix });
  return files.filter(f => f.name.endsWith('.webp'));
}

async function main() {
  console.log('🔍 Scanning Firebase Storage for thumbnails...\n');

  const files = await listThumbnails();

  if (files.length === 0) {
    console.log('✅ No thumbnails found to delete.');
    return;
  }

  // Group by prop type for summary
  const byProp = {};
  for (const file of files) {
    const parts = file.name.split('/');
    const propType = parts[1] || 'unknown';
    byProp[propType] = (byProp[propType] || 0) + 1;
  }

  console.log(`Found ${files.length} thumbnails:\n`);
  for (const [prop, count] of Object.entries(byProp).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${prop}: ${count} files`);
  }
  console.log('');

  if (!confirm) {
    console.log('⚠️  This is a preview. To actually delete, run:');
    console.log('   node scripts/purge-thumbnail-cache.js --confirm');
    if (!propFilter) {
      console.log('\n   Or delete only one prop type:');
      console.log('   node scripts/purge-thumbnail-cache.js --prop staff --confirm');
    }
    return;
  }

  // Actually delete
  console.log('🗑️  Deleting thumbnails...\n');

  let deleted = 0;
  let errors = 0;

  for (const file of files) {
    try {
      await file.delete();
      deleted++;
      if (deleted % 50 === 0) {
        console.log(`   Deleted ${deleted}/${files.length}...`);
      }
    } catch (err) {
      errors++;
      console.error(`   ❌ Failed to delete ${file.name}: ${err.message}`);
    }
  }

  console.log(`\n✅ Done! Deleted ${deleted} thumbnails.`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} files failed to delete.`);
  }

  console.log('\nThumbnails will regenerate automatically when users view the gallery.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
