#!/usr/bin/env node

/**
 * Convert sprite from <symbol> to visible <g> groups
 * This makes the sprite editable in Illustrator
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPRITE_FILE = path.join(__dirname, "..", "static", "images", "arrows-sprite.svg");

// Grid layout
const GRID_COLS = 7;
const CELL_WIDTH = 350;
const CELL_HEIGHT = 350;

function convert() {
  const content = fs.readFileSync(SPRITE_FILE, "utf-8");

  // Extract all symbols with regex
  const symbolRegex = /<symbol\s+id="([^"]+)"\s+viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g;
  const symbols = [];
  let match;

  while ((match = symbolRegex.exec(content)) !== null) {
    symbols.push({
      id: match[1],
      viewBox: match[2],
      content: match[3].trim()
    });
  }

  console.log(`Found ${symbols.length} symbols to convert`);

  // Generate groups in a grid layout
  const groups = [];
  let row = 0;
  let col = 0;

  for (const symbol of symbols) {
    const x = col * CELL_WIDTH;
    const y = row * CELL_HEIGHT;

    // Parse viewBox for centering
    const vbParts = symbol.viewBox.split(/\s+/).map(Number);
    const vbWidth = vbParts[2] || 100;
    const vbHeight = vbParts[3] || 100;

    const offsetX = (CELL_WIDTH - vbWidth) / 2;
    const offsetY = (CELL_HEIGHT - vbHeight) / 2;

    groups.push(`  <g id="${symbol.id}" data-viewbox="${symbol.viewBox}" transform="translate(${x + offsetX}, ${y + offsetY})">
    ${symbol.content}
  </g>`);

    col++;
    if (col >= GRID_COLS) {
      col = 0;
      row++;
    }
  }

  const totalWidth = GRID_COLS * CELL_WIDTH;
  const totalHeight = (row + 1) * CELL_HEIGHT;

  const newSprite = `<?xml version="1.0" encoding="utf-8"?>
<!--
  TKA Arrow Sprite

  Edit this file directly in Adobe Illustrator.
  Each arrow is a named group (layer) that you can select and edit.
  Save (Ctrl+S) and refresh the browser to see changes.

  Naming convention: {motionType}_{turns}_{orientation}[_skew+/-]
  Examples: pro_0.0_radial, anti_1.5_nonradial, dash_2.0_radial_skew+

  Converted: ${new Date().toISOString()}
  Total groups: ${symbols.length}
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
${groups.join("\n\n")}
</svg>
`;

  fs.writeFileSync(SPRITE_FILE, newSprite);
  console.log(`Sprite converted: ${totalWidth} x ${totalHeight} canvas`);
  console.log(`Groups arranged in ${row + 1} rows of ${GRID_COLS} columns`);
}

convert();
