#!/usr/bin/env node
/**
 * Normalize Arrow Sprite for Position Independence
 *
 * Transforms the arrow sprite so arrows can be freely moved in Illustrator
 * without affecting rendering in the app.
 *
 * How it works:
 * - Wraps each arrow's paths with a <g transform="translate(-minX, -minY)">
 * - Adds data-viewbox="0 0 width height" to each arrow group
 * - Updates outer transform to maintain visual position in Illustrator
 *
 * Result: Loader uses data-viewbox (normalized), inner transform shifts paths to match
 */

const fs = require('fs');
const path = require('path');

const SPRITE_PATH = path.join(__dirname, '../apps/scribe/static/images/arrows-sprite.svg');
const BACKUP_PATH = path.join(__dirname, '../apps/scribe/static/images/arrows-sprite-backup.svg');
const PADDING = 5;

/**
 * Parse path d attribute to extract coordinate bounds
 */
function getPathBounds(pathD) {
  // Extract all numbers from the path
  const numbers = pathD.match(/-?\d*\.?\d+/g) || [];
  const coords = numbers.map(Number);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // Simple coordinate extraction - pairs of numbers
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
 * Extract all path d attributes from content
 */
function extractPathsFromContent(content) {
  const pathRegex = /<path[^>]*\sd="([^"]+)"[^>]*>/g;
  const paths = [];
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Parse transform="translate(x, y)" or transform="translate(x,y)"
 */
function parseTranslate(transformAttr) {
  if (!transformAttr) return { x: 0, y: 0 };
  const match = transformAttr.match(/translate\s*\(\s*(-?[\d.]+)\s*,?\s*(-?[\d.]+)\s*\)/);
  if (!match) return { x: 0, y: 0 };
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
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

  let content = originalContent;

  // Match groups with IDs that have content (paths inside)
  // Captures: 1=id, 2=transform attr or empty, 3=other attrs, 4=inner content
  const groupRegex = /<g\s+id="([^"]+)"(\s+transform="[^"]*")?([^>]*)>([\s\S]*?)<\/g>/g;

  let modified = 0;
  let skipped = 0;

  content = content.replace(groupRegex, (match, id, transformAttr, otherAttrs, innerContent) => {
    // Skip if already has data-viewbox (already processed)
    if (otherAttrs && otherAttrs.includes('data-viewbox')) {
      console.log(`  [skip] ${id} - already has data-viewbox`);
      skipped++;
      return match;
    }

    // Skip if inner content already has a wrapper group with transform
    if (innerContent.trim().startsWith('<g transform="translate(')) {
      console.log(`  [skip] ${id} - already wrapped`);
      skipped++;
      return match;
    }

    // Extract paths and calculate bounds
    const paths = extractPathsFromContent(innerContent);
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

    // Calculate normalized viewBox (starts at 0,0 with padding)
    const width = (maxX - minX) + (PADDING * 2);
    const height = (maxY - minY) + (PADDING * 2);
    const dataViewBox = `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`;

    // Calculate inner transform to normalize paths to (0,0)
    const innerOffsetX = -(minX - PADDING);
    const innerOffsetY = -(minY - PADDING);
    const innerTransform = `translate(${innerOffsetX.toFixed(1)}, ${innerOffsetY.toFixed(1)})`;

    // Parse existing outer transform and update to maintain visual position
    const existingTranslate = parseTranslate(transformAttr);
    const newOuterX = existingTranslate.x + minX - PADDING;
    const newOuterY = existingTranslate.y + minY - PADDING;
    const newOuterTransform = `translate(${newOuterX.toFixed(1)}, ${newOuterY.toFixed(1)})`;

    // Build the new group
    const wrappedContent = `\n\t<g transform="${innerTransform}">${innerContent}</g>\n`;

    console.log(`  [normalize] ${id}`);
    console.log(`      bounds: (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
    console.log(`      viewBox: ${dataViewBox}`);
    console.log(`      outer transform: ${newOuterTransform}`);

    modified++;

    return `<g id="${id}" data-viewbox="${dataViewBox}" transform="${newOuterTransform}"${otherAttrs || ''}>${wrappedContent}</g>`;
  });

  // Write back
  fs.writeFileSync(SPRITE_PATH, content);
  console.log(`\nDone! Modified ${modified} groups, skipped ${skipped}`);
  console.log(`Original backed up to: ${BACKUP_PATH}`);
}

// Run
processSprite();
