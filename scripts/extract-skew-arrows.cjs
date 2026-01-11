/**
 * Extract Skew Arrows from Sprite Sheet
 *
 * Extracts skew arrow variants from arrows-sprite.svg and saves them
 * as individual files with normalized coordinates (viewBox starting at 0,0).
 */

const fs = require('fs');
const path = require('path');

const SPRITE_PATH = path.join(__dirname, '../static/images/arrows-sprite.svg');
const OUTPUT_DIR = path.join(__dirname, '../static/images/arrows');

// Read the sprite file
const spriteContent = fs.readFileSync(SPRITE_PATH, 'utf-8');

// Find all skew arrow groups with actual path content
// Match groups that have a path element inside
const groupRegex = /<g\s+id="([^"]*skew[^"]*)"[^>]*>([\s\S]*?)<\/g>/gi;

let match;
let extractedCount = 0;

while ((match = groupRegex.exec(spriteContent)) !== null) {
  const rawId = match[1];
  const innerContent = match[2].trim();

  // Skip empty groups
  if (!innerContent || !innerContent.includes('<path')) continue;

  // Decode Illustrator's encoding
  let cleanId = rawId
    .replace(/_x5F_/g, '_')
    .replace(/_x2B_/g, '+')
    .replace(/_00000\d+_/g, '');

  // Skip duplicate IDs
  if (cleanId.includes('00000')) continue;

  // Parse the ID
  const idMatch = cleanId.match(/^(pro|anti|dash|static)_(\d+\.\d+)_(radial|nonradial)_skew([+-])$/);
  if (!idMatch) {
    console.log(`Skipping unrecognized ID: ${cleanId}`);
    continue;
  }

  const [, motionType, turns, orientation, skewDir] = idMatch;

  // Extract path data
  const pathMatch = innerContent.match(/<path[^>]*\sd="([^"]+)"[^>]*>/);
  if (!pathMatch) {
    console.log(`No path found for: ${cleanId}`);
    continue;
  }

  const pathData = pathMatch[1];
  const pathElement = pathMatch[0];

  // Parse all coordinates from path to find bounds
  const coords = parsePathCoordinates(pathData);
  if (coords.length === 0) {
    console.log(`Could not parse coordinates for: ${cleanId}`);
    continue;
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  // Add padding
  const padding = 10;
  const offsetX = minX - padding;
  const offsetY = minY - padding;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);

  // Translate path coordinates
  const normalizedPath = translatePath(pathData, -offsetX, -offsetY);

  // Create SVG with the default arrow fill color
  const svg = `<?xml version="1.0" encoding="utf-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" xml:space="preserve"><path d="${normalizedPath}" style="fill:#2e3192"/></svg>`;

  // Determine output path
  const subDir = orientation === 'radial' ? 'from_radial' : 'from_nonradial';
  const fileName = `${motionType}_${turns}_skew${skewDir}.svg`;
  const outputPath = path.join(OUTPUT_DIR, motionType, subDir, fileName);

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(outputPath, svg);
  extractedCount++;
  console.log(`Extracted: ${fileName} (${width}x${height})`);
}

console.log(`\nExtracted ${extractedCount} skew arrows`);

/**
 * Parse path coordinates from SVG path data
 * Returns array of [x, y] pairs
 */
function parsePathCoordinates(pathData) {
  const coords = [];

  // SVG path commands
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

  let currentX = 0, currentY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.slice(1).trim().match(/-?\d+\.?\d*/g)?.map(Number) || [];

    switch (type) {
      case 'M': // Move to (absolute)
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i];
          currentY = args[i + 1];
          coords.push([currentX, currentY]);
        }
        break;
      case 'm': // Move to (relative)
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i];
          currentY += args[i + 1];
          coords.push([currentX, currentY]);
        }
        break;
      case 'L': // Line to (absolute)
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i];
          currentY = args[i + 1];
          coords.push([currentX, currentY]);
        }
        break;
      case 'l': // Line to (relative)
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i];
          currentY += args[i + 1];
          coords.push([currentX, currentY]);
        }
        break;
      case 'C': // Cubic bezier (absolute)
        for (let i = 0; i < args.length; i += 6) {
          coords.push([args[i], args[i + 1]]);
          coords.push([args[i + 2], args[i + 3]]);
          currentX = args[i + 4];
          currentY = args[i + 5];
          coords.push([currentX, currentY]);
        }
        break;
      case 'c': // Cubic bezier (relative)
        for (let i = 0; i < args.length; i += 6) {
          coords.push([currentX + args[i], currentY + args[i + 1]]);
          coords.push([currentX + args[i + 2], currentY + args[i + 3]]);
          currentX += args[i + 4];
          currentY += args[i + 5];
          coords.push([currentX, currentY]);
        }
        break;
      case 'H': // Horizontal line (absolute)
        currentX = args[0];
        coords.push([currentX, currentY]);
        break;
      case 'h': // Horizontal line (relative)
        currentX += args[0];
        coords.push([currentX, currentY]);
        break;
      case 'V': // Vertical line (absolute)
        currentY = args[0];
        coords.push([currentX, currentY]);
        break;
      case 'v': // Vertical line (relative)
        currentY += args[0];
        coords.push([currentX, currentY]);
        break;
      case 'Z':
      case 'z':
        // Close path - no coordinates
        break;
      default:
        // For other commands, just extract coordinate pairs
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            coords.push([args[i], args[i + 1]]);
          }
        }
    }
  }

  return coords;
}

/**
 * Translate all coordinates in a path by offset
 */
function translatePath(pathData, offsetX, offsetY) {
  // Parse and rebuild path with translated coordinates
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

  let result = '';
  let isFirst = true;

  for (const cmd of commands) {
    const type = cmd[0];
    const argsStr = cmd.slice(1).trim();

    // For absolute commands, translate coordinates
    // For relative commands, keep as-is (they're relative to current position)
    if ('MLCSQTAmlcsqta'.includes(type)) {
      const args = argsStr.match(/-?\d+\.?\d*/g) || [];
      const translated = [];

      if ('MLCSQTA'.includes(type)) {
        // Absolute commands - translate all coordinates
        for (let i = 0; i < args.length; i++) {
          const val = parseFloat(args[i]);
          // Even indices are X, odd are Y (for most commands)
          if (type === 'H') {
            translated.push((val + offsetX).toFixed(1));
          } else if (type === 'V') {
            translated.push((val + offsetY).toFixed(1));
          } else if (i % 2 === 0) {
            translated.push((val + offsetX).toFixed(1));
          } else {
            translated.push((val + offsetY).toFixed(1));
          }
        }
      } else {
        // Relative commands - keep as-is
        translated.push(...args);
      }

      result += type + translated.join(',');
    } else if (type === 'H') {
      const val = parseFloat(argsStr) + offsetX;
      result += 'H' + val.toFixed(1);
    } else if (type === 'V') {
      const val = parseFloat(argsStr) + offsetY;
      result += 'V' + val.toFixed(1);
    } else {
      result += cmd;
    }
  }

  return result;
}
