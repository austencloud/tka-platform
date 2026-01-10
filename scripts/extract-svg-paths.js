#!/usr/bin/env node
/**
 * Extract SVG Path Data from Arrow Sprites
 *
 * Parses the arrows-sprite.svg file and extracts path data for each arrow symbol.
 * Outputs JSON that can be used by Canvas 2D and WebGL renderers to draw arrows
 * directly without parsing SVG at runtime.
 *
 * Usage:
 *   node scripts/extract-svg-paths.js
 *
 * Output:
 *   src/lib/shared/render/data/arrow-paths.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Input and output paths
const SPRITE_PATH = join(projectRoot, 'static/images/arrows-sprite.svg');
const OUTPUT_DIR = join(projectRoot, 'src/lib/shared/render/data');
const OUTPUT_PATH = join(OUTPUT_DIR, 'arrow-paths.json');

/**
 * Parse SVG path data string into commands
 * Converts "M 0,0 L 10,20 C 30,40 50,60 70,80" into structured commands
 */
function parsePathCommands(d) {
  if (!d || typeof d !== 'string') return [];

  const commands = [];
  // Regex to match SVG path commands and their arguments
  const pathRegex = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;

  let match;
  while ((match = pathRegex.exec(d)) !== null) {
    const command = match[1];
    const argsStr = match[2].trim();

    // Parse numeric arguments
    const args = argsStr
      .split(/[\s,]+/)
      .filter(s => s.length > 0)
      .map(s => parseFloat(s));

    commands.push({ cmd: command, args });
  }

  return commands;
}

/**
 * Extract transform values from transform attribute
 * Handles "translate(x, y)" format
 */
function parseTransform(transformStr) {
  if (!transformStr) return { x: 0, y: 0 };

  const translateMatch = transformStr.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (translateMatch) {
    return {
      x: parseFloat(translateMatch[1]),
      y: parseFloat(translateMatch[2])
    };
  }
  return { x: 0, y: 0 };
}

/**
 * Parse viewBox string into object
 */
function parseViewBox(viewBoxStr) {
  if (!viewBoxStr) return null;

  const parts = viewBoxStr.split(/\s+/).map(s => parseFloat(s));
  if (parts.length === 4) {
    return {
      x: parts[0],
      y: parts[1],
      width: parts[2],
      height: parts[3]
    };
  }
  return null;
}

/**
 * Simple XML attribute parser
 */
function getAttributes(tag) {
  const attrs = {};
  // Match attribute="value" or attribute='value'
  const attrRegex = /(\w[\w-]*)\s*=\s*["']([^"']*)["']/g;
  let match;
  while ((match = attrRegex.exec(tag)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

/**
 * Extract arrow data from SVG content
 */
function extractArrowData(svgContent) {
  const arrows = {};

  // Find all <g> elements with id attribute
  const groupRegex = /<g\s+([^>]*)>([\s\S]*?)<\/g>/g;
  let groupMatch;

  while ((groupMatch = groupRegex.exec(svgContent)) !== null) {
    const groupAttrs = getAttributes(groupMatch[1]);
    const groupContent = groupMatch[2];

    // Skip groups without id
    if (!groupAttrs.id) continue;

    const arrowId = groupAttrs.id;
    const transform = parseTransform(groupAttrs.transform);
    const viewBox = parseViewBox(groupAttrs['data-viewbox']);

    // Extract all paths within this group
    const paths = [];
    const pathRegex = /<path\s+([^>]*)\/?\s*>/g;
    let pathMatch;

    while ((pathMatch = pathRegex.exec(groupContent)) !== null) {
      const pathAttrs = getAttributes(pathMatch[1]);
      const d = pathAttrs.d;

      if (d) {
        paths.push({
          d: d,
          commands: parsePathCommands(d),
          class: pathAttrs.class || null,
          fill: pathAttrs.fill || null
        });
      }
    }

    // Only include arrows that have paths
    if (paths.length > 0) {
      arrows[arrowId] = {
        id: arrowId,
        transform,
        viewBox,
        paths
      };
    }
  }

  return arrows;
}

/**
 * Extract CSS styles from SVG
 */
function extractStyles(svgContent) {
  const styles = {};
  const styleMatch = svgContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);

  if (styleMatch) {
    const styleContent = styleMatch[1];
    // Parse CSS rules like .st0{fill:#2E3192;}
    const ruleRegex = /\.(\w+)\s*\{([^}]+)\}/g;
    let ruleMatch;

    while ((ruleMatch = ruleRegex.exec(styleContent)) !== null) {
      const className = ruleMatch[1];
      const properties = {};

      // Parse individual properties
      const propRegex = /([\w-]+)\s*:\s*([^;]+);?/g;
      let propMatch;
      while ((propMatch = propRegex.exec(ruleMatch[2])) !== null) {
        properties[propMatch[1]] = propMatch[2].trim();
      }

      styles[className] = properties;
    }
  }

  return styles;
}

/**
 * Main extraction function
 */
function main() {
  console.log('Extracting SVG path data from arrow sprites...\n');

  // Read the sprite file
  let svgContent;
  try {
    svgContent = readFileSync(SPRITE_PATH, 'utf-8');
    console.log(`Read ${SPRITE_PATH}`);
  } catch (err) {
    console.error(`Failed to read sprite file: ${err.message}`);
    process.exit(1);
  }

  // Extract styles
  const styles = extractStyles(svgContent);
  console.log(`Extracted ${Object.keys(styles).length} CSS classes`);

  // Extract arrow data
  const arrows = extractArrowData(svgContent);
  const arrowCount = Object.keys(arrows).length;
  console.log(`Extracted ${arrowCount} arrow symbols`);

  // Apply CSS class fills to paths
  let pathsWithClass = 0;
  for (const arrow of Object.values(arrows)) {
    for (const path of arrow.paths) {
      if (path.class && styles[path.class]) {
        path.fill = styles[path.class].fill || path.fill;
        pathsWithClass++;
      }
    }
  }
  console.log(`Applied CSS fills to ${pathsWithClass} paths`);

  // Create output
  const output = {
    version: '1.0',
    generated: new Date().toISOString(),
    sourceFile: 'static/images/arrows-sprite.svg',
    styles,
    arrows
  };

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUTPUT_PATH}`);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total arrows: ${arrowCount}`);

  // Group by type
  const types = {};
  for (const id of Object.keys(arrows)) {
    const type = id.split('_')[0]; // pro, anti, float, dash
    types[type] = (types[type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(types)) {
    console.log(`  ${type}: ${count}`);
  }

  // Count total path commands
  let totalCommands = 0;
  for (const arrow of Object.values(arrows)) {
    for (const path of arrow.paths) {
      totalCommands += path.commands.length;
    }
  }
  console.log(`Total path commands: ${totalCommands}`);
}

main();
