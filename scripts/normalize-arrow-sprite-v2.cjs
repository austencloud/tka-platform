#!/usr/bin/env node
/**
 * Normalize Arrow Sprite - Version 2
 *
 * Uses svg-path-commander for ACCURATE path parsing and transformation.
 * Previous versions failed because they used naive number extraction
 * which doesn't understand relative commands or varying parameter counts.
 *
 * This script:
 * 1. Parses each arrow's path data properly
 * 2. Calculates accurate bounding boxes
 * 3. Transforms path coordinates to start at origin (with padding)
 * 4. Adds data-viewbox attribute for the loader
 *
 * Result: Arrows can be freely moved in Illustrator (only outer transform changes)
 * while rendering correctly in the app.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const SVGPathCommanderModule = require('svg-path-commander');
const SVGPathCommander = SVGPathCommanderModule.default;
const { getPathBBox, transformPath: transformPathFn, pathToString } = SVGPathCommanderModule;

const SPRITE_PATH = path.join(__dirname, '../apps/scribe/static/images/arrows-sprite.svg');
const BACKUP_PATH = path.join(__dirname, '../apps/scribe/static/images/arrows-sprite-backup.svg');
const PADDING = 5;

/**
 * Get bounding box from a path using svg-path-commander
 */
function getPathBBoxSafe(pathD) {
  try {
    // Use the direct getPathBBox function from svg-path-commander
    return getPathBBox(pathD);
  } catch (error) {
    console.error(`  [error] Failed to parse path: ${error.message}`);
    return null;
  }
}

/**
 * Transform path coordinates by a translate offset
 */
function transformPath(pathD, offsetX, offsetY) {
  try {
    // Use the direct transformPath function from svg-path-commander
    const transformed = transformPathFn(pathD, { translate: [offsetX, offsetY] });
    return pathToString(transformed);
  } catch (error) {
    console.error(`  [error] Failed to transform path: ${error.message}`);
    return pathD; // Return original if transform fails
  }
}

/**
 * Combine bounding boxes from multiple paths
 */
function combineBBoxes(bboxes) {
  if (bboxes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const bbox of bboxes) {
    if (!bbox) continue;
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }

  if (!isFinite(minX)) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Process the sprite file
 */
function processSprite() {
  console.log('Reading sprite file...');

  // Create backup first
  const originalContent = fs.readFileSync(SPRITE_PATH, 'utf-8');
  fs.writeFileSync(BACKUP_PATH, originalContent);
  console.log(`Backup created: ${BACKUP_PATH}`);

  // Parse with jsdom
  const dom = new JSDOM(originalContent, { contentType: 'image/svg+xml' });
  const document = dom.window.document;

  // Find all groups with IDs (arrow symbols)
  const groups = document.querySelectorAll('svg > g[id]');
  console.log(`Found ${groups.length} groups to process\n`);

  let modified = 0;
  let skipped = 0;
  let errors = 0;

  groups.forEach((group) => {
    const id = group.getAttribute('id');

    // Skip if already has data-viewbox (already processed)
    if (group.hasAttribute('data-viewbox')) {
      console.log(`  [skip] ${id} - already has data-viewbox`);
      skipped++;
      return;
    }

    // Get all paths in this group
    const paths = group.querySelectorAll('path');
    if (paths.length === 0) {
      console.log(`  [empty] ${id} - no paths`);
      skipped++;
      return;
    }

    // Calculate bounding boxes for all paths
    const bboxes = [];
    paths.forEach((pathEl) => {
      const d = pathEl.getAttribute('d');
      if (!d) return;
      const bbox = getPathBBoxSafe(d);
      if (bbox) bboxes.push(bbox);
    });

    // Get combined bounding box
    const combinedBBox = combineBBoxes(bboxes);
    if (!combinedBBox) {
      console.log(`  [error] ${id} - couldn't calculate bounds`);
      errors++;
      return;
    }

    // Log original bounds
    console.log(`  [normalize] ${id}`);
    console.log(`      original: (${combinedBBox.x.toFixed(1)}, ${combinedBBox.y.toFixed(1)}) size: ${combinedBBox.width.toFixed(1)} x ${combinedBBox.height.toFixed(1)}`);

    // Calculate offset to normalize to origin with padding
    const offsetX = -(combinedBBox.x - PADDING);
    const offsetY = -(combinedBBox.y - PADDING);

    // Transform each path's coordinates
    paths.forEach((pathEl) => {
      const d = pathEl.getAttribute('d');
      if (!d) return;
      const transformed = transformPath(d, offsetX, offsetY);
      pathEl.setAttribute('d', transformed);
    });

    // Calculate and set data-viewbox
    const viewBoxWidth = combinedBBox.width + (PADDING * 2);
    const viewBoxHeight = combinedBBox.height + (PADDING * 2);
    const dataViewBox = `0 0 ${viewBoxWidth.toFixed(1)} ${viewBoxHeight.toFixed(1)}`;
    group.setAttribute('data-viewbox', dataViewBox);

    console.log(`      normalized: viewBox="${dataViewBox}"`);
    console.log(`      offset applied: translate(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);

    modified++;
  });

  // Serialize and write back
  const serializer = new dom.window.XMLSerializer();
  const output = serializer.serializeToString(document);
  fs.writeFileSync(SPRITE_PATH, output);

  console.log(`\nDone!`);
  console.log(`  Modified: ${modified} groups`);
  console.log(`  Skipped: ${skipped} groups`);
  console.log(`  Errors: ${errors} groups`);
  console.log(`\nOriginal backed up to: ${BACKUP_PATH}`);
  console.log(`If arrows don't render correctly: git checkout -- static/images/arrows-sprite.svg`);
}

// Run
processSprite();
