/**
 * Parse Instagram captions to extract TKA words and update Firestore
 *
 * Usage: node scripts/parse-instagram-captions.js [--dry-run]
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const isDryRun = process.argv.includes('--dry-run');

const METADATA_DIR = './downloads/instagram/tkaflowarts';

/**
 * Check if a string looks like a TKA word
 * TKA words contain Greek letters OR are all uppercase A-Z with optional dashes
 */
function isTkaWord(word) {
  if (!word || word.length < 2) return false;

  // Contains Greek letters - definitely TKA
  if (/[ΣΔΘΩΦΨΛαβγ]/.test(word)) return true;

  // All uppercase letters A-Z with optional dashes, no lowercase
  // This catches words like "MTMT", "BJEA", "ECKΨ-"
  if (/^[A-Z\-]+$/.test(word) && word.length >= 2 && word.length <= 12) return true;

  return false;
}

/**
 * Extract TKA word from caption text
 * Patterns:
 * - "Word: X-BΦ-θ-" (explicit word prefix)
 * - "Tutorial 7 MTMT" (tutorial number + word after, if it looks like TKA)
 */
function extractTkaWord(caption) {
  if (!caption) return null;

  // Pattern 1: "Word: XXXXX" or "Word : XXXXX" - trust this explicitly
  const wordMatch = caption.match(/Word\s*:\s*([A-Za-zΣΔΘΩΦΨΛαβγ\-]+)/i);
  if (wordMatch) {
    const word = wordMatch[1].trim();
    // Still validate it looks like TKA (contains Greek or is uppercase)
    if (isTkaWord(word)) {
      return word;
    }
  }

  // Pattern 2: "Tutorial N WORD" - only if WORD looks like TKA
  const tutorialMatch = caption.match(/Tutorial\s+\d+\s+([A-ZΣΔΘΩΦΨΛαβγ\-]{2,12})/);
  if (tutorialMatch) {
    const word = tutorialMatch[1].trim();
    if (isTkaWord(word)) {
      return word;
    }
  }

  return null;
}

/**
 * Extract tutorial number if present
 */
function extractTutorialNumber(caption) {
  if (!caption) return null;

  const match = caption.match(/Tutorial\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse a JSON metadata file and extract relevant info
 */
function parseMetadataFile(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8');
    const data = JSON.parse(content);

    const node = data.node;
    if (!node) return null;

    const shortcode = node.shortcode;
    const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
    const timestamp = node.taken_at_timestamp;

    return {
      shortcode,
      caption,
      timestamp,
      tkaWord: extractTkaWord(caption),
      tutorialNumber: extractTutorialNumber(caption)
    };
  } catch (e) {
    console.error(`Error parsing ${filepath}:`, e.message);
    return null;
  }
}

/**
 * Find video in Firestore by shortcode field
 */
async function findVideoByShortcode(shortcode) {
  const snapshot = await db.collection('showcaseVideos')
    .where('shortcode', '==', shortcode)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function main() {
  console.log(isDryRun ? '=== DRY RUN ===' : '=== UPDATING FIRESTORE ===');
  console.log('');

  // Get all JSON metadata files (exclude profile JSON)
  const files = readdirSync(METADATA_DIR)
    .filter(f => f.endsWith('.json') && f.includes('UTC'));

  console.log(`Found ${files.length} metadata files\n`);

  let matched = 0;
  let updated = 0;
  let noWord = 0;

  for (const file of files) {
    const filepath = join(METADATA_DIR, file);
    const metadata = parseMetadataFile(filepath);

    if (!metadata) continue;

    console.log(`--- ${file} ---`);
    console.log(`  Shortcode: ${metadata.shortcode}`);
    console.log(`  TKA Word: ${metadata.tkaWord || '(none found)'}`);
    if (metadata.tutorialNumber) {
      console.log(`  Tutorial #: ${metadata.tutorialNumber}`);
    }

    if (!metadata.tkaWord) {
      noWord++;
      console.log('  -> Skipping (no TKA word found)\n');
      continue;
    }

    // Find matching video in Firestore
    const video = await findVideoByShortcode(metadata.shortcode);

    if (!video) {
      console.log(`  -> No matching video found in Firestore\n`);
      continue;
    }

    matched++;
    console.log(`  -> Found video: ${video.id}`);

    // Build title
    let title = metadata.tkaWord;
    if (metadata.tutorialNumber) {
      title = `Tutorial ${metadata.tutorialNumber}: ${metadata.tkaWord}`;
    }

    if (!isDryRun) {
      await db.collection('showcaseVideos').doc(video.id).update({
        title: title,
        tkaWord: metadata.tkaWord,
        ...(metadata.tutorialNumber && { tutorialNumber: metadata.tutorialNumber })
      });
      updated++;
      console.log(`  -> Updated title to: "${title}"\n`);
    } else {
      console.log(`  -> Would update title to: "${title}"\n`);
    }
  }

  console.log('=== SUMMARY ===');
  console.log(`Total metadata files: ${files.length}`);
  console.log(`Files with TKA words: ${files.length - noWord}`);
  console.log(`Matched to videos: ${matched}`);
  if (!isDryRun) {
    console.log(`Updated in Firestore: ${updated}`);
  }
}

main().catch(console.error);
