#!/usr/bin/env node
/**
 * Cleanup Orphaned Sequences
 *
 * Removes sequences from the index that have no valid metadata/beats.
 * These orphaned entries cause rendering errors in Discover.
 *
 * Usage:
 *   node scripts/cleanup-orphaned-sequences.js           # Dry run (report only)
 *   node scripts/cleanup-orphaned-sequences.js --confirm # Actually remove orphans
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_PATH = path.join(__dirname, '../static/data/sequence-index.json');
const CONFIRM_FLAG = process.argv.includes('--confirm');

console.log('🔍 Scanning for orphaned sequences...\n');

// Read the index
let data;
try {
  const raw = fs.readFileSync(INDEX_PATH, 'utf8');
  data = JSON.parse(raw);
} catch (err) {
  console.error('❌ Failed to read sequence-index.json:', err.message);
  process.exit(1);
}

if (!data.sequences || !Array.isArray(data.sequences)) {
  console.error('❌ Invalid index format: missing sequences array');
  process.exit(1);
}

const totalCount = data.sequences.length;
console.log(`📊 Total sequences in index: ${totalCount}\n`);

// Find orphaned sequences
const orphaned = [];
const valid = [];

for (const seq of data.sequences) {
  const id = seq.id || seq.name || seq.word || 'unknown';

  // Check for valid metadata
  const hasFullMetadata = seq.fullMetadata?.sequence &&
                          Array.isArray(seq.fullMetadata.sequence) &&
                          seq.fullMetadata.sequence.length > 0;

  const hasBeats = seq.beats &&
                   Array.isArray(seq.beats) &&
                   seq.beats.length > 0;

  const hasBundledFlag = seq.metadataBundled === true;

  // A sequence is valid if it has fullMetadata OR beats
  // (metadataBundled flag alone isn't enough - need actual data)
  if (hasFullMetadata || hasBeats) {
    valid.push(seq);
  } else {
    orphaned.push({
      id,
      word: seq.word || 'N/A',
      name: seq.name || 'N/A',
      hasFullMetadata,
      hasBeats,
      hasBundledFlag,
    });
  }
}

// Report findings
console.log(`✅ Valid sequences: ${valid.length}`);
console.log(`❌ Orphaned sequences: ${orphaned.length}\n`);

if (orphaned.length === 0) {
  console.log('🎉 No orphaned sequences found! Index is clean.');
  process.exit(0);
}

// List orphaned sequences
console.log('Orphaned sequences:');
console.log('─'.repeat(80));
for (const seq of orphaned) {
  console.log(`  • ${seq.word || seq.name || seq.id}`);
  console.log(`    ID: ${seq.id}`);
  console.log(`    hasFullMetadata: ${seq.hasFullMetadata}, hasBeats: ${seq.hasBeats}, bundledFlag: ${seq.hasBundledFlag}`);
  console.log('');
}
console.log('─'.repeat(80));

if (!CONFIRM_FLAG) {
  console.log('\n⚠️  DRY RUN - No changes made.');
  console.log('   Run with --confirm to remove orphaned sequences.\n');
  console.log(`   node scripts/cleanup-orphaned-sequences.js --confirm`);
  process.exit(0);
}

// Actually remove orphaned sequences
console.log('\n🗑️  Removing orphaned sequences...');

data.sequences = valid;

// Create backup first
const backupPath = INDEX_PATH.replace('.json', `.backup-${Date.now()}.json`);
try {
  fs.copyFileSync(INDEX_PATH, backupPath);
  console.log(`📦 Backup created: ${path.basename(backupPath)}`);
} catch (err) {
  console.error('❌ Failed to create backup:', err.message);
  process.exit(1);
}

// Write cleaned index
try {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(data, null, 2));
  console.log(`✅ Removed ${orphaned.length} orphaned sequences`);
  console.log(`📊 New total: ${valid.length} sequences`);
} catch (err) {
  console.error('❌ Failed to write index:', err.message);
  process.exit(1);
}

console.log('\n🎉 Cleanup complete!');
