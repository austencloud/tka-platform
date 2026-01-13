#!/usr/bin/env tsx
/**
 * Standalone Pictograph CLI
 *
 * Renders pictographs using Canvas2DDirectRenderer in Node.js
 * No browser, no auth, no dev server required
 *
 * Usage:
 *   npm run pictograph A
 *   npm run pictograph A B C
 *   npm run pictograph --all
 */

// CRITICAL: Load Svelte runes mock FIRST (before any .svelte.ts file imports)
import './svelte-runes-mock';

import { fileURLToPath } from 'url';
import path from 'path';
import { createCanvas, Canvas as NodeCanvas, Image } from 'canvas';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Provide global Canvas and Image for Node.js context
if (typeof global !== 'undefined') {
  (global as any).Canvas = NodeCanvas;
  (global as any).Image = Image;
  // Mock document for Canvas2DDirectRenderer isSupported() check
  if (typeof (global as any).document === 'undefined') {
    (global as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') return createCanvas(1, 1);
        return {};
      }
    };
  }
}

const OUTPUT_DIR = path.join(__dirname, '..', 'static', 'images', 'grant-feature');

interface PictographData {
  id: string;
  letter: string;
  motions: {
    blue: MotionData;
    red: MotionData;
  };
}

interface MotionData {
  motionType: string;
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  startOrientation: string;
  endOrientation: string;
  turns: number;
  propType: string;
  propPlacementData: {
    propType: string;
  };
}

async function loadPictographData(letter: string): Promise<PictographData> {
  const csvPath = path.join(__dirname, '..', 'static', 'data', 'pictographs', 'DiamondPictographDataframe.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n');
  const headers = lines[0].split(',');

  let row: string[] | null = null;
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i].split(',');
    if (r[0] === letter) {
      row = r;
      break;
    }
  }

  if (!row) {
    throw new Error(`No data found for letter ${letter}`);
  }

  return {
    id: `pictograph-${letter}`,
    letter: letter,
    motions: {
      blue: {
        motionType: row[headers.indexOf('blueMotionType')],
        rotationDirection: row[headers.indexOf('blueRotationDirection')],
        startLocation: row[headers.indexOf('blueStartLocation')],
        endLocation: row[headers.indexOf('blueEndLocation')],
        startOrientation: 'in',
        endOrientation: 'in',
        turns: 1,
        propType: 'staff',
        propPlacementData: { propType: 'staff' }
      },
      red: {
        motionType: row[headers.indexOf('redMotionType')],
        rotationDirection: row[headers.indexOf('redRotationDirection')],
        startLocation: row[headers.indexOf('redStartLocation')],
        endLocation: row[headers.indexOf('redEndLocation')],
        startOrientation: 'in',
        endOrientation: 'in',
        turns: 1,
        propType: 'staff',
        propPlacementData: { propType: 'staff' }
      }
    }
  };
}

async function renderPictograph(letter: string): Promise<string> {
  console.log(`\n🎨 Rendering pictograph ${letter}...`);

  const pictographData = await loadPictographData(letter);
  console.log(`  ✓ Loaded data`);

  // Import Node.js preparer factory
  console.log(`  📦 Loading preparer...`);
  const { createNodePictographPreparer } = await import(pathToFileURL(path.join(__dirname, 'node', 'create-node-pictograph-preparer.ts')).href);
  console.log(`  ✓ Preparer module loaded`);
  const { pictographPreparer, turnsTupleGenerator } = createNodePictographPreparer();
  console.log(`  ✓ Created preparer instance`);

  // Dynamically import Canvas2DDirectRenderer
  const rendererPath = pathToFileURL(path.join(__dirname, '..', 'src', 'lib', 'shared', 'render', 'services', 'implementations', 'Canvas2DDirectRenderer.ts')).href;
  const { Canvas2DDirectRenderer } = await import(rendererPath);
  console.log(`  ✓ Loaded renderer`);

  // Create renderer WITH preparer
  const renderer = new Canvas2DDirectRenderer(pictographPreparer);

  // Set global turn tuple generator for turn numbers
  Canvas2DDirectRenderer.setGlobalTurnsTupleGeneratorGetter(() => turnsTupleGenerator);

  await renderer.initialize();
  console.log(`  ✓ Initialized renderer`);

  // Render pictograph (grid + glyph - arrows/props coming soon)
  console.log(`  🎨 Rendering grid + glyph...`);
  const canvas = await renderer.renderPictograph(pictographData as any, {
    size: 950,
    visibility: {
      showGrid: true,
      showTKA: true,
      showVTG: false,
      showElemental: false,
      showPositions: false,
      showReversals: false,
      showNonRadialPoints: false,
      darkMode: false,
      handPointVisibility: 'active',
      // Explicitly pass prop types to avoid needing global settings
      bluePropType: 'staff' as any,
      redPropType: 'staff' as any,
    }
  });

  console.log(`  ✓ Rendered (${canvas.width}x${canvas.height})`);

  // Save to file
  const buffer = canvas.toBuffer('image/png');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, `pictograph-${letter}.png`);
  fs.writeFileSync(outputPath, buffer);

  console.log(`  ✅ Saved: ${outputPath}`);

  return outputPath;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm run pictograph A B C');
    console.log('   Or: npm run pictograph --all');
    process.exit(1);
  }

  let letters = args;

  if (args[0] === '--all') {
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  TKA Pictograph CLI');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📝 Generating ${letters.length} pictograph(s)...`);

  const startTime = Date.now();
  const results: { letter: string; success: boolean; path?: string; error?: string }[] = [];

  for (const letter of letters) {
    try {
      const outputPath = await renderPictograph(letter);
      results.push({ letter, success: true, path: outputPath });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Failed: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      results.push({ letter, success: false, error: errorMsg });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}/${letters.length}`);
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach(f => console.log(`  - ${f.letter}: ${f.error}`));
  }

  console.log(`\n⏱️  Total time: ${elapsed}s`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  process.exit(failed.length > 0 ? 1 : 0);
}

// Helper to convert path to file URL
function pathToFileURL(filePath: string): URL {
  return new URL(`file:///${filePath.replace(/\\/g, '/')}`);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
