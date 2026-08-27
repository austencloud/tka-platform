/**
 * Scrape Instagram captions using Playwright
 *
 * This visits each Instagram post page like a normal browser and extracts the caption.
 * Much safer than using API scraping tools.
 *
 * Usage: node scripts/scrape-instagram-captions.js [--dry-run] [--limit N]
 */

import { chromium } from 'playwright';
import admin from 'firebase-admin';
import { readFileSync, readdirSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const isDryRun = process.argv.includes('--dry-run');
const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(process.argv[limitIndex + 1], 10) : null;

/**
 * Check if a string looks like a TKA word
 */
function isTkaWord(word) {
  if (!word || word.length < 2) return false;

  // Contains Greek letters - definitely TKA
  if (/[ΣΔΘΩΦΨΛαβγ]/.test(word)) return true;

  // All uppercase letters A-Z with optional dashes, 2-12 chars
  if (/^[A-Z\-]+$/.test(word) && word.length >= 2 && word.length <= 12) return true;

  return false;
}

/**
 * Extract TKA word from caption text
 */
function extractTkaWord(caption) {
  if (!caption) return null;

  // Pattern 1: "Word: XXXXX" or "Word : XXXXX"
  const wordMatch = caption.match(/Word\s*:\s*([A-Za-zΣΔΘΩΦΨΛαβγ\-]+)/i);
  if (wordMatch && isTkaWord(wordMatch[1].trim())) {
    return wordMatch[1].trim();
  }

  // Pattern 2: "(WORD)" or "(WORD*N)" - like "(BJEA*2)"
  const parenMatch = caption.match(/\(([A-ZΣΔΘΩΦΨΛαβγ\-]+)(?:\*\d+)?\)/);
  if (parenMatch && isTkaWord(parenMatch[1].trim())) {
    return parenMatch[1].trim();
  }

  // Pattern 3: "the word XXXXX" or "word is XXXXX"
  const theWordMatch = caption.match(/(?:the\s+)?word\s+(?:is\s+)?([A-ZΣΔΘΩΦΨΛαβγ\-]{2,12})/i);
  if (theWordMatch && isTkaWord(theWordMatch[1].trim())) {
    return theWordMatch[1].trim();
  }

  return null;
}

/**
 * Get all shortcodes from video filenames
 */
function getShortcodesFromFiles() {
  const videoDir = './downloads/instagram/tkaflowarts';
  const files = readdirSync(videoDir).filter(f => f.endsWith('.mp4'));

  const shortcodes = [];
  for (const file of files) {
    // Extract shortcode from filename like "2022-07-21_19-01-22__CgSQebjFdPT.mp4"
    const match = file.match(/__([A-Za-z0-9_-]+?)(?:_\d+)?\.mp4$/);
    if (match) {
      shortcodes.push({
        shortcode: match[1],
        filename: file
      });
    }
  }

  return shortcodes;
}

/**
 * Check which videos already have titles in Firestore
 */
async function getVideosWithTitles() {
  const snapshot = await db.collection('showcaseVideos').get();
  const withTitles = new Set();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.title && data.tkaWord) {
      withTitles.add(data.shortcode);
    }
  }

  return withTitles;
}

async function main() {
  console.log(isDryRun ? '=== DRY RUN ===' : '=== SCRAPING INSTAGRAM CAPTIONS ===');
  console.log('');

  const allShortcodes = getShortcodesFromFiles();
  console.log(`Found ${allShortcodes.length} videos total`);

  // Filter out ones that already have titles
  const alreadyHaveTitles = await getVideosWithTitles();
  console.log(`${alreadyHaveTitles.size} already have titles`);

  const toProcess = allShortcodes.filter(s => !alreadyHaveTitles.has(s.shortcode));
  console.log(`${toProcess.length} need captions scraped`);

  if (limit) {
    console.log(`Limiting to first ${limit} videos`);
  }

  const processList = limit ? toProcess.slice(0, limit) : toProcess;
  console.log('');

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  let updated = 0;
  let noWord = 0;
  let errors = 0;

  for (let i = 0; i < processList.length; i++) {
    const { shortcode, filename } = processList[i];
    console.log(`[${i + 1}/${processList.length}] ${shortcode}`);

    try {
      // Navigate to the post
      const url = `https://www.instagram.com/p/${shortcode}/`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait a bit for content to load
      await page.waitForTimeout(2000);

      // Try to get the caption text
      // Instagram puts captions in various places, try multiple selectors
      let caption = null;

      // Try getting text from the main content area
      const textContent = await page.textContent('main');
      if (textContent) {
        caption = textContent;
      }

      if (!caption) {
        console.log(`  -> Could not find caption`);
        errors++;
        continue;
      }

      // Extract TKA word
      const tkaWord = extractTkaWord(caption);

      if (!tkaWord) {
        console.log(`  -> No TKA word found in caption`);
        noWord++;
        continue;
      }

      console.log(`  -> Found TKA word: ${tkaWord}`);

      if (!isDryRun) {
        // Update Firestore
        const snapshot = await db.collection('showcaseVideos')
          .where('shortcode', '==', shortcode)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          await snapshot.docs[0].ref.update({
            title: tkaWord,
            tkaWord: tkaWord
          });
          console.log(`  -> Updated Firestore`);
          updated++;
        } else {
          console.log(`  -> Video not found in Firestore`);
        }
      } else {
        console.log(`  -> Would update Firestore`);
        updated++;
      }

      // Random delay between requests (2-5 seconds)
      const delay = 2000 + Math.random() * 3000;
      await page.waitForTimeout(delay);

    } catch (e) {
      console.log(`  -> Error: ${e.message}`);
      errors++;
    }
  }

  await browser.close();

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Processed: ${processList.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`No TKA word: ${noWord}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
