#!/usr/bin/env node
/**
 * Add data-viewbox attributes to arrow sprite groups
 *
 * This allows arrows to be freely moved in Illustrator without
 * affecting rendering, since the loader uses explicit viewBox
 * instead of calculating from path coordinates.
 */

const fs = require('fs');
const path = require('path');

const SPRITE_PATH = path.join(__dirname, '../apps/scribe/static/images/arrows-sprite.svg');
const PADDING = 5;

/**
 * Parse path d attribute to extract coordinate bounds
 */
function getPathBounds(pathD) {
  const numbers = pathD.match(/-?\d*\.?\d+/g) || [];
  const coords = numbers.map(Number);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let i = 0; i < coords.length - 1; i += 2) {
    const x = coords[i];
    const y = coords[i + 1];
    if (!isNaN(x) && !isNaN(y)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Calculate viewBox string from bounds with padding
 */
function calculateViewBox(bounds) {
  const minX = Math.max(0, bounds.minX - PADDING);
  const minY = Math.max(0, bounds.minY - PADDING);
  const width = (bounds.maxX - bounds.minX) + (PADDING * 2);
  const height = (bounds.maxY - bounds.minY) + (PADDING * 2);
  return `${minX} ${minY} ${width} ${height}`;
}

/**
 * Extract all path d attributes from a group's content
 */
function extractPathsFromGroup(groupContent) {
  const pathRegex = /<path[^>]*\sd="([^"]+)"[^>]*>/g;
  const paths = [];
  let match;
  while ((match = pathRegex.exec(groupContent)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Process the sprite file
 */
function processSprite() {
  console.log('Reading sprite file...');
  let content = fs.readFileSync(SPRITE_PATH, 'utf-8');

  // Match all groups with IDs
  const groupRegex = /<g\s+id="([^"]+)"([^>]*)>([\s\S]*?)<\/g>/g;
  let modified = 0;
  let skipped = 0;

  content = content.replace(groupRegex, (match, id, attrs, innerContent) => {
    // Skip if already has data-viewbox
    if (attrs.includes('data-viewbox')) {
      console.log(`  [skip] ${id} - already has data-viewbox`);
      skipped++;
      return match;
    }

    // Extract paths and calculate bounds
    const paths = extractPathsFromGroup(innerContent);
    if (paths.length === 0) {
      console.log(`  [empty] ${id} - no paths found`);
      return match;
    }

    // Combine bounds from all paths
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pathD of paths) {
      const bounds = getPathBounds(pathD);
      if (bounds) {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }
    }

    if (!isFinite(minX)) {
      console.log(`  [error] ${id} - couldn't calculate bounds`);
      return match;
    }

    const viewBox = calculateViewBox({ minX, minY, maxX, maxY });
    console.log(`  [add] ${id} -> ${viewBox}`);
    modified++;

    // Add data-viewbox attribute
    return `<g id="${id}" data-viewbox="${viewBox}"${attrs}>${innerContent}</g>`;
  });

  // Write back
  fs.writeFileSync(SPRITE_PATH, content);
  console.log(`\nDone! Modified ${modified} groups, skipped ${skipped}`);
}

processSprite();
