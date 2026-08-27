/**
 * SVG Path Parser
 *
 * Converts SVG path commands to Canvas 2D drawing operations.
 * Supports all standard SVG path commands:
 * - M/m: moveTo
 * - L/l: lineTo
 * - H/h: horizontal lineTo
 * - V/v: vertical lineTo
 * - C/c: cubic bezier
 * - S/s: smooth cubic bezier
 * - Q/q: quadratic bezier
 * - T/t: smooth quadratic bezier
 * - A/a: arc
 * - Z/z: closePath
 */

export interface PathCommand {
  cmd: string;
  args: number[];
}

/**
 * Draw a path from parsed commands onto a Canvas 2D context
 *
 * @param ctx - Canvas 2D rendering context
 * @param commands - Array of parsed path commands
 * @param offsetX - X offset for positioning
 * @param offsetY - Y offset for positioning
 * @param scale - Scale factor (default 1)
 */
export function drawPathCommands(
  ctx: CanvasRenderingContext2D,
  commands: PathCommand[],
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = 1
): void {
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let lastControlX = 0;
  let lastControlY = 0;
  let lastCommand = "";

  ctx.beginPath();

  for (const { cmd, args } of commands) {
    const isRelative = cmd === cmd.toLowerCase();
    const command = cmd.toUpperCase();

    // Helper to get absolute coordinates
    const abs = (relX: number, relY: number): [number, number] => {
      if (isRelative) {
        return [currentX + relX, currentY + relY];
      }
      return [relX, relY];
    };

    // Transform coordinates with offset and scale
    const tx = (x: number): number => (x + offsetX) * scale;
    const ty = (y: number): number => (y + offsetY) * scale;

    switch (command) {
      case "M": {
        // MoveTo
        const [x, y] = abs(args[0] ?? 0, args[1] ?? 0);
        ctx.moveTo(tx(x), ty(y));
        currentX = x;
        currentY = y;
        startX = x;
        startY = y;

        // Additional coordinate pairs are treated as lineTo
        for (let i = 2; i < args.length; i += 2) {
          const [lx, ly] = abs(args[i] ?? 0, args[i + 1] ?? 0);
          ctx.lineTo(tx(lx), ty(ly));
          currentX = lx;
          currentY = ly;
        }
        break;
      }

      case "L": {
        // LineTo
        for (let i = 0; i < args.length; i += 2) {
          const [x, y] = abs(args[i] ?? 0, args[i + 1] ?? 0);
          ctx.lineTo(tx(x), ty(y));
          currentX = x;
          currentY = y;
        }
        break;
      }

      case "H": {
        // Horizontal LineTo
        for (const arg of args) {
          const x = isRelative ? currentX + arg : arg;
          ctx.lineTo(tx(x), ty(currentY));
          currentX = x;
        }
        break;
      }

      case "V": {
        // Vertical LineTo
        for (const arg of args) {
          const y = isRelative ? currentY + arg : arg;
          ctx.lineTo(tx(currentX), ty(y));
          currentY = y;
        }
        break;
      }

      case "C": {
        // Cubic Bezier
        for (let i = 0; i < args.length; i += 6) {
          const [cp1x, cp1y] = abs(args[i] ?? 0, args[i + 1] ?? 0);
          const [cp2x, cp2y] = abs(args[i + 2] ?? 0, args[i + 3] ?? 0);
          const [x, y] = abs(args[i + 4] ?? 0, args[i + 5] ?? 0);

          ctx.bezierCurveTo(tx(cp1x), ty(cp1y), tx(cp2x), ty(cp2y), tx(x), ty(y));

          lastControlX = cp2x;
          lastControlY = cp2y;
          currentX = x;
          currentY = y;
        }
        break;
      }

      case "S": {
        // Smooth Cubic Bezier
        for (let i = 0; i < args.length; i += 4) {
          // First control point is reflection of last control point
          let cp1x: number, cp1y: number;
          if (lastCommand === "C" || lastCommand === "S") {
            cp1x = 2 * currentX - lastControlX;
            cp1y = 2 * currentY - lastControlY;
          } else {
            cp1x = currentX;
            cp1y = currentY;
          }

          const [cp2x, cp2y] = abs(args[i] ?? 0, args[i + 1] ?? 0);
          const [x, y] = abs(args[i + 2] ?? 0, args[i + 3] ?? 0);

          ctx.bezierCurveTo(tx(cp1x), ty(cp1y), tx(cp2x), ty(cp2y), tx(x), ty(y));

          lastControlX = cp2x;
          lastControlY = cp2y;
          currentX = x;
          currentY = y;
        }
        break;
      }

      case "Q": {
        // Quadratic Bezier
        for (let i = 0; i < args.length; i += 4) {
          const [cpx, cpy] = abs(args[i] ?? 0, args[i + 1] ?? 0);
          const [x, y] = abs(args[i + 2] ?? 0, args[i + 3] ?? 0);

          ctx.quadraticCurveTo(tx(cpx), ty(cpy), tx(x), ty(y));

          lastControlX = cpx;
          lastControlY = cpy;
          currentX = x;
          currentY = y;
        }
        break;
      }

      case "T": {
        // Smooth Quadratic Bezier
        for (let i = 0; i < args.length; i += 2) {
          // Control point is reflection of last control point
          let cpx: number, cpy: number;
          if (lastCommand === "Q" || lastCommand === "T") {
            cpx = 2 * currentX - lastControlX;
            cpy = 2 * currentY - lastControlY;
          } else {
            cpx = currentX;
            cpy = currentY;
          }

          const [x, y] = abs(args[i] ?? 0, args[i + 1] ?? 0);

          ctx.quadraticCurveTo(tx(cpx), ty(cpy), tx(x), ty(y));

          lastControlX = cpx;
          lastControlY = cpy;
          currentX = x;
          currentY = y;
        }
        break;
      }

      case "A": {
        // Arc - complex, convert to bezier curves
        for (let i = 0; i < args.length; i += 7) {
          const rx = args[i] ?? 0;
          const ry = args[i + 1] ?? 0;
          const xAxisRotation = args[i + 2] ?? 0;
          const largeArcFlag = args[i + 3] ?? 0;
          const sweepFlag = args[i + 4] ?? 0;
          const [x, y] = abs(args[i + 5] ?? 0, args[i + 6] ?? 0);

          const curves = arcToBezier(
            currentX, currentY,
            x, y,
            rx, ry,
            xAxisRotation,
            largeArcFlag !== 0,
            sweepFlag !== 0
          );

          for (const curve of curves) {
            ctx.bezierCurveTo(
              tx(curve.x1), ty(curve.y1),
              tx(curve.x2), ty(curve.y2),
              tx(curve.x), ty(curve.y)
            );
          }

          currentX = x;
          currentY = y;
        }
        break;
      }

      case "Z": {
        // Close path
        ctx.closePath();
        currentX = startX;
        currentY = startY;
        break;
      }
    }

    lastCommand = command;
  }
}

/**
 * Convert SVG arc parameters to bezier curves
 * Based on the SVG arc implementation algorithm
 */
function arcToBezier(
  x1: number, y1: number,
  x2: number, y2: number,
  rx: number, ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean
): Array<{ x1: number; y1: number; x2: number; y2: number; x: number; y: number }> {
  const curves: Array<{ x1: number; y1: number; x2: number; y2: number; x: number; y: number }> = [];

  // Handle degenerate cases
  if (rx === 0 || ry === 0) {
    return [{ x1: x2, y1: y2, x2: x2, y2: y2, x: x2, y: y2 }];
  }

  const sinPhi = Math.sin(phi * Math.PI / 180);
  const cosPhi = Math.cos(phi * Math.PI / 180);

  // Step 1: Compute (x1', y1')
  const x1p = cosPhi * (x1 - x2) / 2 + sinPhi * (y1 - y2) / 2;
  const y1p = -sinPhi * (x1 - x2) / 2 + cosPhi * (y1 - y2) / 2;

  // Correct radii if necessary
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  // Step 2: Compute (cx', cy')
  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
  sq = Math.sqrt(sq) * (largeArc === sweep ? -1 : 1);

  const cxp = sq * rx * y1p / ry;
  const cyp = sq * -ry * x1p / rx;

  // Step 3: Compute (cx, cy) from (cx', cy')
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 4: Compute theta1 and dtheta
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);

  if (!sweep && dtheta > 0) {
    dtheta -= Math.PI * 2;
  } else if (sweep && dtheta < 0) {
    dtheta += Math.PI * 2;
  }

  // Generate bezier curves for the arc
  const segments = Math.ceil(Math.abs(dtheta) / (Math.PI / 2));
  const delta = dtheta / segments;

  for (let i = 0; i < segments; i++) {
    const t1 = theta1 + i * delta;
    const t2 = theta1 + (i + 1) * delta;

    const alpha = Math.sin(delta) * (Math.sqrt(4 + 3 * Math.pow(Math.tan(delta / 2), 2)) - 1) / 3;

    const cos1 = Math.cos(t1);
    const sin1 = Math.sin(t1);
    const cos2 = Math.cos(t2);
    const sin2 = Math.sin(t2);

    const p1x = cx + rx * cosPhi * cos1 - ry * sinPhi * sin1;
    const p1y = cy + rx * sinPhi * cos1 + ry * cosPhi * sin1;
    const p2x = cx + rx * cosPhi * cos2 - ry * sinPhi * sin2;
    const p2y = cy + rx * sinPhi * cos2 + ry * cosPhi * sin2;

    const dx1 = -rx * cosPhi * sin1 - ry * sinPhi * cos1;
    const dy1 = -rx * sinPhi * sin1 + ry * cosPhi * cos1;
    const dx2 = -rx * cosPhi * sin2 - ry * sinPhi * cos2;
    const dy2 = -rx * sinPhi * sin2 + ry * cosPhi * cos2;

    curves.push({
      x1: p1x + alpha * dx1,
      y1: p1y + alpha * dy1,
      x2: p2x - alpha * dx2,
      y2: p2y - alpha * dy2,
      x: p2x,
      y: p2y
    });
  }

  return curves;
}

/**
 * Calculate angle between two vectors
 */
function angle(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
}

/**
 * Parse an SVG path "d" attribute string into commands
 *
 * @param d - SVG path data string
 * @returns Array of parsed path commands
 */
export function parsePathData(d: string): PathCommand[] {
  if (!d || typeof d !== "string") return [];

  const commands: PathCommand[] = [];
  const pathRegex = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;

  let match;
  while ((match = pathRegex.exec(d)) !== null) {
    const command = match[1] ?? "";
    const argsStr = (match[2] ?? "").trim();

    // Parse numeric arguments
    const args = argsStr
      .split(/[\s,]+/)
      .filter(s => s.length > 0)
      .map(s => parseFloat(s))
      .filter(n => !isNaN(n));

    commands.push({ cmd: command, args });
  }

  return commands;
}

/**
 * Apply a color transformation to a fill color
 * Used to change arrow colors from default blue to red, etc.
 *
 * @param originalColor - Original fill color (hex or rgb)
 * @param targetColor - Target color to transform to
 * @returns Transformed color string
 */
export function transformColor(originalColor: string, targetColor: string): string {
  // Simple replacement for now - can be enhanced with HSL manipulation
  return targetColor;
}
