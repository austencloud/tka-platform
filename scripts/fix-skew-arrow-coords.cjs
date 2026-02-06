#!/usr/bin/env node
/**
 * Fix Skew Arrow Coordinates
 *
 * Transforms the skew arrow paths from global artboard coordinates
 * to local group-relative coordinates, matching how regular arrows work.
 *
 * The problem: Illustrator exported paths with huge coordinates like M2781.7,267.4
 * The fix: Shift absolute coordinates so paths start near origin (like M181.7,267.4)
 */

const fs = require('fs');
const path = require('path');

const SPRITE_PATH = path.join(__dirname, '../static/images/arrows-sprite.svg');

// Skew arrows that need coordinate fixing
// Format: { id: string, xOffset: number, yOffset: number }
// These offsets will be SUBTRACTED from absolute X,Y coordinates
const SKEW_ARROWS_TO_FIX = [
  {
    id: 'pro_x5F_0.0_x5F_radial_x5F_skew_x2B_',
    xOffset: 2600,
    yOffset: 0,
    description: 'pro 0.0 radial skew+'
  },
  {
    id: 'anti_0.0_radial_skew-',
    xOffset: 3300,
    yOffset: -1800,  // Negative because Y coords are negative in path
    description: 'anti 0.0 radial skew-'
  },
  {
    id: 'anti_x5F_0.0_x5F_nonradial_x5F_skew_x2B_',
    xOffset: 2700,
    yOffset: -2400,  // Negative because Y coords are negative in path
    description: 'anti 0.0 nonradial skew+'
  },
];

/**
 * Transform SVG path data by adjusting absolute coordinates
 * Only modifies absolute commands (M, L, H, V, C, S, Q, T, A)
 * Leaves relative commands (m, l, h, v, c, s, q, t, a) unchanged
 */
function transformPathData(pathD, xOffset, yOffset) {
  // SVG path commands
  const commands = pathD.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!commands) return pathD;

  const transformed = commands.map(cmd => {
    const type = cmd[0];
    const args = cmd.slice(1).trim();

    // Only transform absolute commands (uppercase)
    if (type === type.toLowerCase()) {
      // Relative command - leave unchanged
      return cmd;
    }

    // Parse numbers from the command
    const numbers = args.match(/-?\d*\.?\d+/g);
    if (!numbers) return cmd;

    let newArgs;

    switch (type) {
      case 'M': // Move to (x, y)
      case 'L': // Line to (x, y)
      case 'T': // Smooth quadratic to (x, y)
        // Pairs of x,y coordinates
        newArgs = [];
        for (let i = 0; i < numbers.length; i += 2) {
          const x = parseFloat(numbers[i]) - xOffset;
          const y = parseFloat(numbers[i + 1]) - yOffset;
          newArgs.push(x, y);
        }
        break;

      case 'H': // Horizontal line to (x)
        newArgs = numbers.map(n => parseFloat(n) - xOffset);
        break;

      case 'V': // Vertical line to (y)
        newArgs = numbers.map(n => parseFloat(n) - yOffset);
        break;

      case 'C': // Cubic bezier (x1,y1, x2,y2, x,y)
        newArgs = [];
        for (let i = 0; i < numbers.length; i += 6) {
          newArgs.push(
            parseFloat(numbers[i]) - xOffset,     // x1
            parseFloat(numbers[i + 1]) - yOffset, // y1
            parseFloat(numbers[i + 2]) - xOffset, // x2
            parseFloat(numbers[i + 3]) - yOffset, // y2
            parseFloat(numbers[i + 4]) - xOffset, // x
            parseFloat(numbers[i + 5]) - yOffset  // y
          );
        }
        break;

      case 'S': // Smooth cubic (x2,y2, x,y)
      case 'Q': // Quadratic bezier (x1,y1, x,y)
        newArgs = [];
        for (let i = 0; i < numbers.length; i += 4) {
          newArgs.push(
            parseFloat(numbers[i]) - xOffset,
            parseFloat(numbers[i + 1]) - yOffset,
            parseFloat(numbers[i + 2]) - xOffset,
            parseFloat(numbers[i + 3]) - yOffset
          );
        }
        break;

      case 'A': // Arc (rx,ry, rotation, large-arc, sweep, x,y)
        newArgs = [];
        for (let i = 0; i < numbers.length; i += 7) {
          newArgs.push(
            numbers[i],     // rx (no transform)
            numbers[i + 1], // ry (no transform)
            numbers[i + 2], // rotation (no transform)
            numbers[i + 3], // large-arc flag (no transform)
            numbers[i + 4], // sweep flag (no transform)
            parseFloat(numbers[i + 5]) - xOffset, // x
            parseFloat(numbers[i + 6]) - yOffset  // y
          );
        }
        break;

      default:
        // Unknown command, leave unchanged
        return cmd;
    }

    return type + newArgs.join(',');
  });

  return transformed.join('');
}

/**
 * Calculate viewBox from transformed path bounds
 */
function calculateViewBox(pathD) {
  const numbers = pathD.match(/-?\d*\.?\d+/g);
  if (!numbers) return '0 0 300 300';

  const coords = numbers.map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // Simple bounds estimation from all numbers (pairs as x,y)
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

  if (!isFinite(minX)) return '0 0 300 300';

  // Add padding
  const padding = 10;
  minX = Math.floor(minX - padding);
  minY = Math.floor(minY - padding);
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);

  return `${minX} ${minY} ${width} ${height}`;
}

function main() {
  console.log('Reading sprite file...');
  let svg = fs.readFileSync(SPRITE_PATH, 'utf8');

  for (const arrow of SKEW_ARROWS_TO_FIX) {
    console.log(`\nProcessing: ${arrow.description} (${arrow.id})`);

    // Find the group with this ID
    const groupRegex = new RegExp(
      `(<g\\s+id="${arrow.id}"[^>]*>)([\\s\\S]*?)(</g>)`,
      'i'
    );

    const match = svg.match(groupRegex);
    if (!match) {
      console.log(`  WARNING: Group not found: ${arrow.id}`);
      continue;
    }

    const [fullMatch, openTag, innerContent, closeTag] = match;

    // Find path within the group (might be wrapped in inner <g>)
    const pathRegex = /<path[^>]*\sd="([^"]+)"[^>]*\/?>/i;
    const pathMatch = innerContent.match(pathRegex);

    if (!pathMatch) {
      console.log(`  WARNING: No path found in group`);
      continue;
    }

    const originalPath = pathMatch[1];
    console.log(`  Original path starts: ${originalPath.substring(0, 50)}...`);

    // Transform the path coordinates
    const transformedPath = transformPathData(originalPath, arrow.xOffset, arrow.yOffset);
    console.log(`  Transformed path starts: ${transformedPath.substring(0, 50)}...`);

    // Calculate new viewBox
    const newViewBox = calculateViewBox(transformedPath);
    console.log(`  New viewBox: ${newViewBox}`);

    // Build new group content (without inner transform wrapper)
    const newPath = `<path class="st0" d="${transformedPath}"/>`;

    // Update the opening tag with data-viewbox
    let newOpenTag = openTag;
    // Remove old data-viewbox if present
    newOpenTag = newOpenTag.replace(/\s*data-viewbox="[^"]*"/, '');
    // Add new data-viewbox before the closing >
    newOpenTag = newOpenTag.replace(/>$/, ` data-viewbox="${newViewBox}">`);

    // Replace in SVG
    const newGroup = `${newOpenTag}\n\t${newPath}\n${closeTag}`;
    svg = svg.replace(fullMatch, newGroup);

    console.log(`  Done!`);
  }

  // Write the updated SVG
  console.log('\nWriting updated sprite file...');
  fs.writeFileSync(SPRITE_PATH, svg);
  console.log('Complete!');
}

main();
