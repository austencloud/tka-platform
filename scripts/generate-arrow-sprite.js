#!/usr/bin/env node

/**
 * Arrow Sprite Generator
 *
 * Consolidates all individual arrow SVG files into a single sprite file.
 * Each arrow becomes a <g> group with an ID - visible and editable in Illustrator.
 *
 * Run: node scripts/generate-arrow-sprite.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARROWS_DIR = path.join(__dirname, "..", "static", "images", "arrows");
const OUTPUT_FILE = path.join(__dirname, "..", "static", "images", "arrows-sprite.svg");

const MOTION_TYPES = ["pro", "anti", "dash", "static"];
const ORIENTATIONS = ["radial", "nonradial"];
const SKEWS = ["skew+", "skew-"];
const TURNS = ["0.0", "0.5", "1.0", "1.5", "2.0", "2.5", "3.0"];

// Grid layout for Illustrator visibility
const GRID_COLS = 7; // 7 turn values per row
const CELL_WIDTH = 350;
const CELL_HEIGHT = 350;

function extractSvgContent(svgText) {
  const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 100 100";

  const innerMatch = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const innerContent = innerMatch ? innerMatch[1].trim() : "";

  return { viewBox, innerContent };
}

function generateSymbolId(motionType, turns, orientation, skew = null) {
  let id = `${motionType}_${turns}_${orientation}`;
  if (skew) {
    id += `_${skew}`;
  }
  return id;
}

function loadArrowFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return extractSvgContent(content);
  } catch (e) {
    return null;
  }
}

function generateSprite() {
  const groups = [];
  let loadedCount = 0;
  let placeholderCount = 0;
  let currentRow = 0;
  let currentCol = 0;

  console.log("Generating arrow sprite with visible groups...\n");

  // Helper to add a group at the current grid position
  function addGroup(id, viewBox, innerContent, isPlaceholder = false) {
    const x = currentCol * CELL_WIDTH;
    const y = currentRow * CELL_HEIGHT;

    // Parse viewBox to get dimensions for centering
    const vbParts = viewBox.split(/\s+/).map(Number);
    const vbWidth = vbParts[2] || 100;
    const vbHeight = vbParts[3] || 100;

    // Center the arrow in its cell
    const offsetX = (CELL_WIDTH - vbWidth) / 2;
    const offsetY = (CELL_HEIGHT - vbHeight) / 2;

    if (isPlaceholder) {
      // Empty placeholder - just a labeled rectangle
      groups.push(`  <g id="${id}" data-viewbox="${viewBox}" transform="translate(${x + offsetX}, ${y + offsetY})">
    <!-- Placeholder -->
  </g>`);
    } else {
      groups.push(`  <g id="${id}" data-viewbox="${viewBox}" transform="translate(${x + offsetX}, ${y + offsetY})">
    ${innerContent}
  </g>`);
    }

    // Advance grid position
    currentCol++;
    if (currentCol >= GRID_COLS) {
      currentCol = 0;
      currentRow++;
    }
  }

  // Load special arrows first
  const specialArrows = [
    { file: "float.svg", id: "float" },
    { file: "dash.svg", id: "dash_base" },
    { file: "still.svg", id: "still" },
  ];

  for (const { file, id } of specialArrows) {
    const filePath = path.join(ARROWS_DIR, file);
    const data = loadArrowFile(filePath);
    if (data && data.innerContent) {
      addGroup(id, data.viewBox, data.innerContent);
      console.log(`  + ${id} (special)`);
      loadedCount++;
    }
  }

  // Start new row for main arrows
  if (currentCol !== 0) {
    currentCol = 0;
    currentRow++;
  }

  // Load turn-based arrows for each motion type
  for (const motionType of MOTION_TYPES) {
    for (const orientation of ORIENTATIONS) {
      // Add section label (optional - helps organize in Illustrator)
      console.log(`\n  [${motionType} - ${orientation}]`);

      // Standard (no skew)
      for (const turns of TURNS) {
        const fileName = `${motionType}_${turns}.svg`;
        const filePath = path.join(ARROWS_DIR, motionType, `from_${orientation}`, fileName);
        const symbolId = generateSymbolId(motionType, turns, orientation);

        const data = loadArrowFile(filePath);
        if (data && data.innerContent) {
          addGroup(symbolId, data.viewBox, data.innerContent);
          console.log(`  + ${symbolId}`);
          loadedCount++;
        } else {
          addGroup(symbolId, "0 0 100 100", "", true);
          console.log(`  ? ${symbolId} (placeholder)`);
          placeholderCount++;
        }
      }

      // New row after each orientation
      if (currentCol !== 0) {
        currentCol = 0;
        currentRow++;
      }

      // Skew variants
      for (const skew of SKEWS) {
        for (const turns of TURNS) {
          const fileName = `${motionType}_${turns}.svg`;
          const filePath = path.join(ARROWS_DIR, motionType, `from_${orientation}_${skew}`, fileName);
          const symbolId = generateSymbolId(motionType, turns, orientation, skew);

          const data = loadArrowFile(filePath);
          if (data && data.innerContent) {
            addGroup(symbolId, data.viewBox, data.innerContent);
            console.log(`  + ${symbolId}`);
            loadedCount++;
          } else {
            addGroup(symbolId, "0 0 100 100", "", true);
            console.log(`  ? ${symbolId} (skew placeholder)`);
            placeholderCount++;
          }
        }

        // New row after each skew variant
        if (currentCol !== 0) {
          currentCol = 0;
          currentRow++;
        }
      }
    }
  }

  // Calculate total canvas size
  const totalWidth = GRID_COLS * CELL_WIDTH;
  const totalHeight = (currentRow + 1) * CELL_HEIGHT;

  // Generate the final sprite file
  const spriteContent = `<?xml version="1.0" encoding="utf-8"?>
<!--
  TKA Arrow Sprite

  Edit this file directly in Adobe Illustrator.
  Each arrow is a named group (layer) that you can select and edit.
  Save (Ctrl+S) and refresh the browser to see changes.

  Naming convention: {motionType}_{turns}_{orientation}[_skew+/-]
  Examples: pro_0.0_radial, anti_1.5_nonradial, dash_2.0_radial_skew+

  Generated: ${new Date().toISOString()}
  Arrows loaded: ${loadedCount}
  Placeholders: ${placeholderCount}
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
${groups.join("\n\n")}
</svg>
`;

  fs.writeFileSync(OUTPUT_FILE, spriteContent);

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Sprite generated: ${OUTPUT_FILE}`);
  console.log(`  Canvas: ${totalWidth} x ${totalHeight}`);
  console.log(`  Loaded: ${loadedCount} arrows`);
  console.log(`  Placeholders: ${placeholderCount}`);
  console.log(`  Total groups: ${groups.length}`);
}

generateSprite();
