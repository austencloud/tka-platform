#!/usr/bin/env node
/**
 * Extract Individual Arrow SVGs from Sprite
 *
 * Parses the arrow sprite and extracts each arrow with content
 * to its own individual SVG file.
 */

const fs = require('fs');
const path = require('path');

const SPRITE_PATH = path.join(__dirname, '../apps/scribe/static/images/arrows-sprite.svg');
const OUTPUT_DIR = path.join(__dirname, '../apps/scribe/static/images/arrows');

// Normalize Illustrator's XML entity encoding in IDs
function normalizeId(id) {
  return id
    .replace(/_x5F_/g, '_')
    .replace(/_x2B_/g, '+')
    .replace(/_x2D_/g, '-')
    .replace(/_00000\d+_?/g, '');
}

// Parse arrow ID to get motion type and filename
function parseArrowId(normalizedId) {
  // Pattern: {motionType}_{turns}_{orientation}[_skew+/-]
  // Examples: pro_0.0_radial, anti_1.5_nonradial, pro_0.0_radial_skew+
  const match = normalizedId.match(/^(pro|anti|dash|static|float)_?(.*)$/);
  if (!match) return null;

  const motionType = match[1];
  const rest = match[2] || '';

  // For float, there's no rest
  if (motionType === 'float' && !rest) {
    return { motionType, filename: 'float.svg' };
  }

  // Build filename from the rest
  const filename = rest ? `${rest}.svg` : `${motionType}.svg`;

  return { motionType, filename };
}

// Calculate bounding box from path data
function getPathBounds(pathD) {
  const numbers = pathD.match(/-?\d*\.?\d+/g) || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = parseFloat(numbers[i]);
    const y = parseFloat(numbers[i + 1]);
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

// Extract path content and calculate viewBox
function extractGroupContent(groupContent) {
  // Find all path elements
  const pathMatches = groupContent.match(/<path[^>]*d="([^"]+)"[^>]*\/?>/g);
  if (!pathMatches || pathMatches.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // Calculate combined bounds from all paths
  for (const pathTag of pathMatches) {
    const dMatch = pathTag.match(/d="([^"]+)"/);
    if (dMatch) {
      const bounds = getPathBounds(dMatch[1]);
      if (bounds) {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }
    }
  }

  if (!isFinite(minX)) return null;

  // Add padding
  const padding = 5;
  minX = Math.floor(minX - padding);
  minY = Math.floor(minY - padding);
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);

  // Clean up path content (remove extra whitespace, normalize)
  let paths = pathMatches.map(p => {
    // Ensure path has fill attribute
    if (!p.includes('fill=')) {
      p = p.replace('<path', '<path fill="#2E3192"');
    }
    return p.trim();
  }).join('\n  ');

  return {
    viewBox: `${minX} ${minY} ${width} ${height}`,
    width,
    height,
    paths
  };
}

function main() {
  console.log('Reading sprite file...');
  const spriteContent = fs.readFileSync(SPRITE_PATH, 'utf8');

  // Extract style block for fill colors
  const styleMatch = spriteContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styleBlock = styleMatch ? styleMatch[0] : '';

  // Find all groups with IDs
  const groupRegex = /<g\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/gi;
  let match;
  let extracted = 0;
  let skipped = 0;

  const arrows = [];

  while ((match = groupRegex.exec(spriteContent)) !== null) {
    const rawId = match[1];
    const groupContent = match[2];

    // Normalize the ID
    const normalizedId = normalizeId(rawId);

    // Parse to get motion type and filename
    const parsed = parseArrowId(normalizedId);
    if (!parsed) {
      continue;
    }

    // Extract content
    const content = extractGroupContent(groupContent);
    if (!content) {
      skipped++;
      continue;
    }

    arrows.push({
      rawId,
      normalizedId,
      motionType: parsed.motionType,
      filename: parsed.filename,
      content
    });
  }

  console.log(`Found ${arrows.length} arrows with content, ${skipped} empty placeholders`);

  // Write individual files
  for (const arrow of arrows) {
    const dir = path.join(OUTPUT_DIR, arrow.motionType);
    const filepath = path.join(dir, arrow.filename);

    // Create SVG file
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${arrow.content.viewBox}" width="${arrow.content.width}" height="${arrow.content.height}">
  ${arrow.content.paths}
</svg>`;

    fs.writeFileSync(filepath, svg);
    console.log(`  Created: ${arrow.motionType}/${arrow.filename}`);
    extracted++;
  }

  console.log(`\nExtracted ${extracted} arrow SVG files to ${OUTPUT_DIR}`);
}

main();
