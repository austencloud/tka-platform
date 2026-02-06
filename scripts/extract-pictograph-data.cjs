#!/usr/bin/env node
/**
 * Extract Pictograph Data for Cloud Functions
 *
 * Parses CSV files and outputs JSON that Cloud Functions can use directly.
 * This avoids porting the CSV loading infrastructure to Cloud Functions.
 *
 * Usage: node scripts/extract-pictograph-data.js
 * Output: deployment/functions/data/pictographs.json
 */

const fs = require('fs');
const path = require('path');

const CSV_DIR = path.join(__dirname, '../static/data/pictographs');
const OUTPUT_DIR = path.join(__dirname, '../deployment/functions/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pictographs.json');

/**
 * Parse CSV content into rows
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    // Only include rows with valid letter data
    if (row.letter && row.letter.trim()) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Transform CSV row to simplified pictograph data
 */
function transformRow(row) {
  return {
    letter: row.letter,
    startPosition: row.startPosition,
    endPosition: row.endPosition,
    timing: row.timing,
    direction: row.direction,
    blue: {
      motionType: row.blueMotionType,
      rotationDirection: row.blueRotationDirection,
      startLocation: row.blueStartLocation,
      endLocation: row.blueEndLocation,
    },
    red: {
      motionType: row.redMotionType,
      rotationDirection: row.redRotationDirection,
      startLocation: row.redStartLocation,
      endLocation: row.redEndLocation,
    },
  };
}

async function main() {
  console.log('Extracting pictograph data for Cloud Functions...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const output = {
    extractedAt: new Date().toISOString(),
    gridModes: {}
  };

  // Process each CSV file
  const files = [
    { name: 'DiamondPictographDataframe.csv', mode: 'diamond' },
    { name: 'BoxPictographDataframe.csv', mode: 'box' },
  ];

  for (const file of files) {
    const filePath = path.join(CSV_DIR, file.name);

    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${file.name} (not found)`);
      continue;
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(csvContent);
    const pictographs = rows.map(transformRow);

    output.gridModes[file.mode] = pictographs;
    console.log(`  ${file.mode}: ${pictographs.length} pictographs`);
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`\nOutput written to: ${OUTPUT_FILE}`);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
