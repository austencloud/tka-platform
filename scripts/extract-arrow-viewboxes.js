#!/usr/bin/env node

/**
 * Extract viewBox data from arrow sprite
 * Calculates bounding boxes from path data for each arrow group
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPRITE_FILE = path.join(__dirname, "..", "static", "images", "arrows-sprite.svg");
const OUTPUT_FILE = path.join(__dirname, "..", "static", "images", "arrow-viewboxes.json");

// Simple path parser to extract approximate bounds
function extractPathBounds(pathData) {
  if (!pathData) return null;

  const numbers = pathData.match(/-?\d+\.?\d*/g);
  if (!numbers || numbers.length < 2) return null;

  const coords = numbers.map(Number).filter(n => !isNaN(n));

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  // Parse as x,y pairs (simplified - doesn't handle all SVG path commands perfectly)
  for (let i = 0; i < coords.length - 1; i += 2) {
    const x = coords[i];
    const y = coords[i + 1];
    if (Math.abs(x) < 10000 && Math.abs(y) < 10000) { // Sanity check
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!isFinite(minX)) return null;

  // Add small padding
  const padding = 5;
  return {
    x: Math.floor(minX - padding),
    y: Math.floor(minY - padding),
    width: Math.ceil(maxX - minX + padding * 2),
    height: Math.ceil(maxY - minY + padding * 2)
  };
}

function extractViewBoxes() {
  const content = fs.readFileSync(SPRITE_FILE, "utf-8");

  // Parse as DOM
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(content, { contentType: "image/svg+xml" });
  const doc = dom.window.document;

  const groups = doc.querySelectorAll("g[id]");
  const viewBoxes = {};

  groups.forEach((group) => {
    const id = group.getAttribute("id");
    if (!id) return;

    // Clean up Illustrator's escaped IDs
    const cleanId = id
      .replace(/_x5F_/g, "_")
      .replace(/_x2B_/g, "+")
      .replace(/_x2D_/g, "-");

    // Get all paths in this group
    const paths = group.querySelectorAll("path");
    let combinedBounds = null;

    paths.forEach((pathEl) => {
      const d = pathEl.getAttribute("d");
      const bounds = extractPathBounds(d);
      if (bounds) {
        if (!combinedBounds) {
          combinedBounds = { ...bounds };
        } else {
          combinedBounds.x = Math.min(combinedBounds.x, bounds.x);
          combinedBounds.y = Math.min(combinedBounds.y, bounds.y);
          const maxX = Math.max(combinedBounds.x + combinedBounds.width, bounds.x + bounds.width);
          const maxY = Math.max(combinedBounds.y + combinedBounds.height, bounds.y + bounds.height);
          combinedBounds.width = maxX - combinedBounds.x;
          combinedBounds.height = maxY - combinedBounds.y;
        }
      }
    });

    if (combinedBounds) {
      viewBoxes[cleanId] = `${combinedBounds.x} ${combinedBounds.y} ${combinedBounds.width} ${combinedBounds.height}`;
    }
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(viewBoxes, null, 2));
  console.log(`Extracted viewBoxes for ${Object.keys(viewBoxes).length} arrows`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

extractViewBoxes();
