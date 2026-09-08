/**
 * Mandala Prototype — Proof of concept
 *
 * Replicates the animation engine's interpolation math headlessly
 * to compute prop tip paths for a LOOP sequence, then outputs SVG.
 *
 * Usage: node scripts/mandala-prototype.cjs
 */

const fs = require("fs");

// ─── Math constants (from math-constants.ts) ───────────────────────────────

const PI = Math.PI;
const TWO_PI = 2 * PI;
const HALF_PI = PI / 2;

// Grid location angles — canvas Y-axis points DOWN
// E=0, S=90, W=180, N=270(-90)
const LOCATION_ANGLES = {
  e: 0,
  s: HALF_PI,
  w: PI,
  n: -HALF_PI,
  ne: -HALF_PI / 2,
  se: HALF_PI / 2,
  sw: PI - HALF_PI / 2,
  nw: PI + HALF_PI / 2,
  center: 0,
};

// ─── Angle math (from AngleCalculator.ts) ──────────────────────────────────

function normalizeAnglePositive(angle) {
  const norm = angle % TWO_PI;
  return norm < 0 ? norm + TWO_PI : norm;
}

function normalizeAngleSigned(angle) {
  const norm = normalizeAnglePositive(angle);
  return norm > PI ? norm - TWO_PI : norm;
}

function lerpAngle(a, b, t) {
  const d = normalizeAngleSigned(b - a);
  return normalizeAnglePositive(a + d * t);
}

// Orientation → staff angle
function mapOrientationToAngle(ori, centerPathAngle) {
  switch (ori) {
    case "in":
      return normalizeAnglePositive(centerPathAngle + PI);
    case "out":
      return normalizeAnglePositive(centerPathAngle);
    case "clock":
      return normalizeAnglePositive(centerPathAngle + HALF_PI);
    case "counter":
      return normalizeAnglePositive(centerPathAngle - HALF_PI);
    default:
      return 0;
  }
}

// ─── Endpoint calculation (from EndpointCalculator.ts) ─────────────────────

function calculateMotionEndpoints(motion) {
  const startCenterAngle = LOCATION_ANGLES[motion.startLoc] ?? 0;
  const targetCenterAngle = LOCATION_ANGLES[motion.endLoc] ?? 0;

  // Default orientation: "out" if not specified
  const startOri = motion.startOrientation || "out";
  const endOri = motion.endOrientation || "out";

  const startStaffAngle = mapOrientationToAngle(startOri, startCenterAngle);
  const targetStaffAngleFromOri = mapOrientationToAngle(
    endOri,
    targetCenterAngle
  );

  const turns = motion.turns ?? 0;
  const dir = motion.rotDir === "ccw" ? -1 : 1;

  let staffRotationDelta;

  switch (motion.motionType) {
    case "pro": {
      const centerMovement = normalizeAngleSigned(
        targetCenterAngle - startCenterAngle
      );
      const propRotation = dir * turns * PI;
      staffRotationDelta = centerMovement + propRotation; // PRO: same direction
      break;
    }
    case "anti": {
      const centerMovement = normalizeAngleSigned(
        targetCenterAngle - startCenterAngle
      );
      const propRotation = dir * turns * PI;
      staffRotationDelta = -centerMovement + propRotation; // ANTI: opposite direction
      break;
    }
    case "static": {
      if (turns > 0 && motion.rotDir !== "noRotation") {
        staffRotationDelta = dir * turns * PI;
      } else {
        staffRotationDelta = normalizeAngleSigned(
          targetStaffAngleFromOri - startStaffAngle
        );
      }
      break;
    }
    case "dash": {
      if (turns > 0) {
        staffRotationDelta = dir * turns * PI;
      } else {
        staffRotationDelta = normalizeAngleSigned(
          targetStaffAngleFromOri - startStaffAngle
        );
      }
      break;
    }
    case "float": {
      staffRotationDelta = 0;
      break;
    }
    default:
      staffRotationDelta = 0;
  }

  return {
    startCenterAngle,
    targetCenterAngle,
    startStaffAngle,
    staffRotationDelta,
    motionType: motion.motionType,
  };
}

// ─── Interpolation (from PropInterpolator.ts) ──────────────────────────────

function interpolate(endpoints, t) {
  const {
    startCenterAngle,
    targetCenterAngle,
    startStaffAngle,
    staffRotationDelta,
    motionType,
  } = endpoints;

  const staffAngle = normalizeAnglePositive(
    startStaffAngle + staffRotationDelta * t
  );

  if (motionType === "dash") {
    // Cartesian lerp (straight line through center)
    const startX = Math.cos(startCenterAngle);
    const startY = Math.sin(startCenterAngle);
    const endX = Math.cos(targetCenterAngle);
    const endY = Math.sin(targetCenterAngle);
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    return { x, y, staffAngle, isDash: true };
  }

  if (motionType === "static" || motionType === "float") {
    // Hand stays at start position
    const x = Math.cos(startCenterAngle);
    const y = Math.sin(startCenterAngle);
    return { x, y, staffAngle, isDash: false };
  }

  // Arc interpolation (PRO, ANTI)
  const centerAngle = lerpAngle(startCenterAngle, targetCenterAngle, t);
  const x = Math.cos(centerAngle);
  const y = Math.sin(centerAngle);
  return { x, y, staffAngle, isDash: false };
}

// ─── Tip position (from FireTipTracker / PropPositionCalculator) ───────────

function computeTipPosition(handPos, staffAngle, tipOffset, gridRadius) {
  const handX = handPos.x * gridRadius;
  const handY = handPos.y * gridRadius;

  const cosA = Math.cos(staffAngle);
  const sinA = Math.sin(staffAngle);

  // Scale tip offsets so the max tip extent fits within gridRadius.
  // Staff tips are at dx=+-150 in a 950px viewbox where grid radius=150.
  // For the mandala, we want hand path at gridRadius and tips proportional.
  // Max tip reach from prop center = 150 (staff half-length).
  // Scale so tip reach = gridRadius * tipRatio, where tipRatio preserves
  // the visual proportion (staff length = 2x grid radius in the real engine).
  const tipScale = gridRadius / 150;
  const dx = tipOffset.dx * tipScale;
  const dy = tipOffset.dy * tipScale;

  const tipX = handX + (dx * cosA - dy * sinA);
  const tipY = handY + (dx * sinA + dy * cosA);

  return { x: tipX, y: tipY };
}

function generateMandalaPath(
  beats,
  hand,
  tipOffset,
  gridRadius,
  samplesPerBeat
) {
  const points = [];

  // Chain staff angles across beats: each beat's start staff angle =
  // previous beat's end staff angle. This prevents junction gaps.
  let prevEndStaffAngle = null;

  for (const beat of beats) {
    const motion =
      hand === "left"
        ? {
            motionType: beat.leftMotionType,
            rotDir: beat.leftRotDir,
            startLoc: beat.leftStartLoc,
            endLoc: beat.leftEndLoc,
            startOrientation: beat.leftStartOri || "out",
            endOrientation: beat.leftEndOri || "out",
            turns: beat.leftTurns ?? 0,
          }
        : {
            motionType: beat.rightMotionType,
            rotDir: beat.rightRotDir,
            startLoc: beat.rightStartLoc,
            endLoc: beat.rightEndLoc,
            startOrientation: beat.rightStartOri || "out",
            endOrientation: beat.rightEndOri || "out",
            turns: beat.rightTurns ?? 0,
          };

    // Skip float (no movement, no rotation = single point)
    if (motion.motionType === "float") continue;

    const endpoints = calculateMotionEndpoints(motion);

    // Override start staff angle with previous beat's end angle (chaining)
    if (prevEndStaffAngle !== null) {
      // Recompute staffRotationDelta relative to the chained start angle
      const originalEndStaffAngle = normalizeAnglePositive(
        endpoints.startStaffAngle + endpoints.staffRotationDelta
      );
      endpoints.startStaffAngle = prevEndStaffAngle;

      // For motions with explicit turns, recompute delta from turns
      if ((motion.turns ?? 0) > 0 && motion.rotDir !== "noRotation") {
        const dir = motion.rotDir === "ccw" ? -1 : 1;
        const turnsRotation = dir * (motion.turns ?? 0) * PI;
        if (motion.motionType === "pro") {
          const centerMovement = normalizeAngleSigned(
            endpoints.targetCenterAngle - endpoints.startCenterAngle
          );
          endpoints.staffRotationDelta = centerMovement + turnsRotation;
        } else if (motion.motionType === "anti") {
          const centerMovement = normalizeAngleSigned(
            endpoints.targetCenterAngle - endpoints.startCenterAngle
          );
          endpoints.staffRotationDelta = -centerMovement + turnsRotation;
        } else {
          endpoints.staffRotationDelta = turnsRotation;
        }
      } else {
        // No turns: compute shortest path to the orientation-derived end angle
        endpoints.staffRotationDelta = normalizeAngleSigned(
          originalEndStaffAngle - prevEndStaffAngle
        );
      }
    }

    // Track end staff angle for next beat
    prevEndStaffAngle = normalizeAnglePositive(
      endpoints.startStaffAngle + endpoints.staffRotationDelta
    );

    // Adaptive sampling: more samples for high-turn motions
    const turnCount = motion.turns ?? 0;
    const samples = Math.max(
      samplesPerBeat,
      samplesPerBeat * Math.ceil(Math.max(1, turnCount))
    );

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const handPos = interpolate(endpoints, t);
      const tip = computeTipPosition(
        handPos,
        handPos.staffAngle,
        tipOffset,
        gridRadius
      );
      points.push(tip);
    }
  }

  return points;
}

function pointsToSVGPath(points) {
  if (points.length < 2) return "";

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  // Use Catmull-Rom to Bezier conversion for smooth curves
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to cubic bezier control points
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

// ─── Generate SVG ──────────────────────────────────────────────────────────

function generateMandalaSVG(sequence, options = {}) {
  const {
    size = 400,
    gridRadius = 150,
    strokeWidth = 1.5,
    samplesPerBeat = 64,
    showGridDots = true,
    style = "stroke", // "stroke" or "filled"
  } = options;

  // Staff tip offsets (bilateral: 2 tips)
  const tipLeft = { dx: -150, dy: 0 };
  const tipRight = { dx: 150, dy: 0 };

  const beats = sequence.beats;

  // Generate paths for each hand + tip combination
  const leftLeftPoints = generateMandalaPath(
    beats,
    "left",
    tipLeft,
    gridRadius,
    samplesPerBeat
  );
  const leftRightPoints = generateMandalaPath(
    beats,
    "left",
    tipRight,
    gridRadius,
    samplesPerBeat
  );
  const rightLeftPoints = generateMandalaPath(
    beats,
    "right",
    tipLeft,
    gridRadius,
    samplesPerBeat
  );
  const rightRightPoints = generateMandalaPath(
    beats,
    "right",
    tipRight,
    gridRadius,
    samplesPerBeat
  );

  const leftLeftD = pointsToSVGPath(leftLeftPoints);
  const leftRightD = pointsToSVGPath(leftRightPoints);
  const rightLeftD = pointsToSVGPath(rightLeftPoints);
  const rightRightD = pointsToSVGPath(rightRightPoints);

  const center = size / 2;

  // Grid dot positions
  const gridDots = showGridDots
    ? Object.entries(LOCATION_ANGLES).map(([loc, angle]) => {
        if (loc === "center") return { x: 0, y: 0 };
        return {
          x: Math.cos(angle) * gridRadius,
          y: Math.sin(angle) * gridRadius,
        };
      })
    : [];

  const leftColor = "#2e3192";
  const rightColor = "#ed1c24";

  const fillLeft =
    style === "filled"
      ? `fill="rgba(46,49,146,0.15)" stroke="${leftColor}"`
      : `fill="none" stroke="${leftColor}"`;
  const fillRight =
    style === "filled"
      ? `fill="rgba(237,28,36,0.15)" stroke="${rightColor}"`
      : `fill="none" stroke="${rightColor}"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d0d1a" rx="8"/>
  <g transform="translate(${center}, ${center})">
    ${gridDots.map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3" fill="rgba(255,255,255,0.3)"/>`).join("\n    ")}
    ${leftLeftD ? `<path d="${leftLeftD}" ${fillLeft} stroke-width="${strokeWidth}" stroke-linecap="round"/>` : ""}
    ${leftRightD ? `<path d="${leftRightD}" ${fillLeft} stroke-width="${strokeWidth}" stroke-linecap="round"/>` : ""}
    ${rightLeftD ? `<path d="${rightLeftD}" ${fillRight} stroke-width="${strokeWidth}" stroke-linecap="round"/>` : ""}
    ${rightRightD ? `<path d="${rightRightD}" ${fillRight} stroke-width="${strokeWidth}" stroke-linecap="round"/>` : ""}
  </g>
</svg>`;
}

// ─── Expand seed beats into full LOOP cycle ────────────────────────────────

// For a halved rotated LOOP: rotate all grid locations by 180° for the second half
const ROTATION_180 = {
  n: "s",
  s: "n",
  e: "w",
  w: "e",
  ne: "sw",
  sw: "ne",
  nw: "se",
  se: "nw",
  center: "center",
};

function rotateLoc(loc) {
  return ROTATION_180[loc] || loc;
}

function expandHalvedRotatedLoop(seedBeats) {
  // Full cycle = seed beats + same beats with all locations rotated 180°
  const rotatedBeats = seedBeats.map((beat) => ({
    ...beat,
    leftStartLoc: rotateLoc(beat.leftStartLoc),
    leftEndLoc: rotateLoc(beat.leftEndLoc),
    rightStartLoc: rotateLoc(beat.rightStartLoc),
    rightEndLoc: rotateLoc(beat.rightEndLoc),
  }));
  return [...seedBeats, ...rotatedBeats];
}

// ─── Generate decomposed SVG (left only, right only, or combined) ──────────

function generateDecomposedSVG(sequence, options = {}) {
  const {
    size = 500,
    gridRadius = 80,
    strokeWidth = 2,
    samplesPerBeat = 64,
    showGridDots = true,
    show = "both", // "left", "right", or "both"
  } = options;

  const tipLeft = { dx: -150, dy: 0 };
  const tipRight = { dx: 150, dy: 0 };
  const beats = sequence.beats;
  const center = size / 2;

  const leftColor = "#2e3192";
  const rightColor = "#ed1c24";

  // Generate paths
  const paths = [];

  if (show === "left" || show === "both") {
    const leftLeftPoints = generateMandalaPath(
      beats,
      "left",
      tipLeft,
      gridRadius,
      samplesPerBeat
    );
    const leftRightPoints = generateMandalaPath(
      beats,
      "left",
      tipRight,
      gridRadius,
      samplesPerBeat
    );
    const leftLeftD = pointsToSVGPath(leftLeftPoints);
    const leftRightD = pointsToSVGPath(leftRightPoints);
    if (leftLeftD)
      paths.push(
        `<path d="${leftLeftD}" fill="none" stroke="${leftColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
      );
    if (leftRightD)
      paths.push(
        `<path d="${leftRightD}" fill="none" stroke="${leftColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
      );
  }

  if (show === "right" || show === "both") {
    const rightLeftPoints = generateMandalaPath(
      beats,
      "right",
      tipLeft,
      gridRadius,
      samplesPerBeat
    );
    const rightRightPoints = generateMandalaPath(
      beats,
      "right",
      tipRight,
      gridRadius,
      samplesPerBeat
    );
    const rightLeftD = pointsToSVGPath(rightLeftPoints);
    const rightRightD = pointsToSVGPath(rightRightPoints);
    if (rightLeftD)
      paths.push(
        `<path d="${rightLeftD}" fill="none" stroke="${rightColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
      );
    if (rightRightD)
      paths.push(
        `<path d="${rightRightD}" fill="none" stroke="${rightColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
      );
  }

  // Grid dots
  const gridDots = showGridDots
    ? Object.entries(LOCATION_ANGLES).map(([loc, angle]) => {
        if (loc === "center") return { x: 0, y: 0 };
        return {
          x: Math.cos(angle) * gridRadius,
          y: Math.sin(angle) * gridRadius,
        };
      })
    : [];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d0d1a" rx="12"/>
  <g transform="translate(${center}, ${center})">
    ${gridDots.map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3.5" fill="rgba(255,255,255,0.25)"/>`).join("\n    ")}
    ${paths.join("\n    ")}
  </g>
</svg>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

// ─── Diagnostic: per-beat path with junction analysis ──────────────────────

function generateBeatByBeatSVG(sequence, hand, options = {}) {
  const {
    size = 500,
    gridRadius = 80,
    strokeWidth = 2,
    samplesPerBeat = 64,
    showGridDots = true,
  } = options;

  const tipLeft = { dx: -150, dy: 0 };
  const tipRight = { dx: 150, dy: 0 };
  const beats = sequence.beats;
  const center = size / 2;

  // Beat colors for visual distinction
  const beatColors = [
    "#4488ff",
    "#22cc88",
    "#ff8844",
    "#cc44ff",
    "#ffcc22",
    "#44cccc",
  ];

  const paths = [];
  const junctionPoints = [];
  const diagnostics = [];
  let prevEndStaffAngle = null;

  for (let b = 0; b < beats.length; b++) {
    const beat = beats[b];
    const motion =
      hand === "left"
        ? {
            motionType: beat.leftMotionType,
            rotDir: beat.leftRotDir,
            startLoc: beat.leftStartLoc,
            endLoc: beat.leftEndLoc,
            startOrientation: beat.leftStartOri || "out",
            endOrientation: beat.leftEndOri || "out",
            turns: beat.leftTurns ?? 0,
          }
        : {
            motionType: beat.rightMotionType,
            rotDir: beat.rightRotDir,
            startLoc: beat.rightStartLoc,
            endLoc: beat.rightEndLoc,
            startOrientation: beat.rightStartOri || "out",
            endOrientation: beat.rightEndOri || "out",
            turns: beat.rightTurns ?? 0,
          };

    if (motion.motionType === "float") continue;

    const endpoints = calculateMotionEndpoints(motion);

    // Chain staff angles across beats
    if (prevEndStaffAngle !== null) {
      const originalEndStaffAngle = normalizeAnglePositive(
        endpoints.startStaffAngle + endpoints.staffRotationDelta
      );
      endpoints.startStaffAngle = prevEndStaffAngle;
      if ((motion.turns ?? 0) > 0 && motion.rotDir !== "noRotation") {
        const dir = motion.rotDir === "ccw" ? -1 : 1;
        const turnsRotation = dir * (motion.turns ?? 0) * PI;
        if (motion.motionType === "pro") {
          const centerMovement = normalizeAngleSigned(
            endpoints.targetCenterAngle - endpoints.startCenterAngle
          );
          endpoints.staffRotationDelta = centerMovement + turnsRotation;
        } else if (motion.motionType === "anti") {
          const centerMovement = normalizeAngleSigned(
            endpoints.targetCenterAngle - endpoints.startCenterAngle
          );
          endpoints.staffRotationDelta = -centerMovement + turnsRotation;
        } else {
          endpoints.staffRotationDelta = turnsRotation;
        }
      } else {
        endpoints.staffRotationDelta = normalizeAngleSigned(
          originalEndStaffAngle - prevEndStaffAngle
        );
      }
    }
    prevEndStaffAngle = normalizeAnglePositive(
      endpoints.startStaffAngle + endpoints.staffRotationDelta
    );

    const samples = Math.max(
      samplesPerBeat,
      samplesPerBeat * Math.ceil(Math.max(1, motion.turns ?? 0))
    );

    const beatPoints = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const handPos = interpolate(endpoints, t);
      // Right tip only for clarity
      const tip = computeTipPosition(
        handPos,
        handPos.staffAngle,
        tipRight,
        gridRadius
      );
      beatPoints.push(tip);
    }

    // Diagnostic: log start/end of each beat
    const startPt = beatPoints[0];
    const endPt = beatPoints[beatPoints.length - 1];
    diagnostics.push({
      beat: b + 1,
      letter: beat.letter,
      motionType: motion.motionType,
      startLoc: motion.startLoc,
      endLoc: motion.endLoc,
      startTip: { x: startPt.x.toFixed(2), y: startPt.y.toFixed(2) },
      endTip: { x: endPt.x.toFixed(2), y: endPt.y.toFixed(2) },
      startStaffAngle: ((endpoints.startStaffAngle * 180) / PI).toFixed(1),
      endStaffAngle: (
        ((endpoints.startStaffAngle + endpoints.staffRotationDelta) * 180) /
        PI
      ).toFixed(1),
    });

    // Junction: mark start point of each beat
    junctionPoints.push(startPt);

    const d = pointsToSVGPath(beatPoints);
    const col = beatColors[b % beatColors.length];
    if (d)
      paths.push(
        `<path d="${d}" fill="none" stroke="${col}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
      );
  }

  // Grid dots
  const gridDots = showGridDots
    ? Object.entries(LOCATION_ANGLES).map(([loc, angle]) => {
        if (loc === "center") return { x: 0, y: 0 };
        return {
          x: Math.cos(angle) * gridRadius,
          y: Math.sin(angle) * gridRadius,
        };
      })
    : [];

  // Junction markers (red circles)
  const junctionMarkers = junctionPoints.map(
    (p) =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#ff3333" stroke="white" stroke-width="1"/>`
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d0d1a" rx="12"/>
  <g transform="translate(${center}, ${center})">
    ${gridDots.map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3.5" fill="rgba(255,255,255,0.25)"/>`).join("\n    ")}
    ${paths.join("\n    ")}
    ${junctionMarkers.join("\n    ")}
  </g>
</svg>`;

  return { svg, diagnostics };
}

// ─── Convert Firestore step format to our beat format ──────────────────────

function firestoreStepsToBeats(steps) {
  return steps
    .filter((s) => s.motions) // skip start position
    .map((s) => {
      const b = s.motions.left || {};
      const r = s.motions.right || {};
      // Map rotationDirection strings
      const mapRotDir = (rd) => {
        if (rd === "clockwise" || rd === "cw") return "cw";
        if (rd === "counter_clockwise" || rd === "ccw") return "ccw";
        return "noRotation";
      };
      return {
        letter: s.letter,
        leftMotionType: b.motionType || "static",
        leftRotDir: mapRotDir(b.rotationDirection),
        leftStartLoc: b.startLocation || "center",
        leftEndLoc: b.endLocation || b.startLocation || "center",
        leftStartOri: b.startOrientation || "out",
        leftEndOri: b.endOrientation || "out",
        leftTurns: typeof b.turns === "number" ? b.turns : 0,
        rightMotionType: r.motionType || "static",
        rightRotDir: mapRotDir(r.rotationDirection),
        rightStartLoc: r.startLocation || "center",
        rightEndLoc: r.endLocation || r.startLocation || "center",
        rightStartOri: r.startOrientation || "out",
        rightEndOri: r.endOrientation || "out",
        rightTurns: typeof r.turns === "number" ? r.turns : 0,
      };
    });
}

// ─── Main ──────────────────────────────────────────────────────────────────

// Load from Firestore export
const firestoreSeq = JSON.parse(
  fs.readFileSync("scripts/test-sequence.json", "utf-8")
);
const fullBeats = firestoreStepsToBeats(firestoreSeq.steps);
const seq = { beats: fullBeats, seedWord: firestoreSeq.word };
const rawSeq = {
  beats: fullBeats,
  handPathFamily: firestoreSeq.loopType + " LOOP",
};

console.log(
  `Generating mandala for: ${firestoreSeq.word} (${firestoreSeq.loopType})`
);
console.log(`Beats: ${fullBeats.length}`);

// ─── Tip inset comparison ──────────────────────────────────────────────────

function generateWithTipInset(sequence, insetAmount, options = {}) {
  const {
    size = 500,
    gridRadius = 80,
    strokeWidth = 2,
    samplesPerBeat = 64,
    showGridDots = true,
  } = options;

  // Staff tip at 150, inset moves it toward center
  const tipLeft = { dx: -(150 - insetAmount), dy: 0 };
  const tipRight = { dx: 150 - insetAmount, dy: 0 };
  const beats = sequence.beats;
  const center = size / 2;

  const leftColor = "#2e3192";
  const rightColor = "#ed1c24";
  const paths = [];

  // Left-hand paths
  const leftLeftPoints = generateMandalaPath(
    beats,
    "left",
    tipLeft,
    gridRadius,
    samplesPerBeat
  );
  const leftRightPoints = generateMandalaPath(
    beats,
    "left",
    tipRight,
    gridRadius,
    samplesPerBeat
  );
  const leftLeftD = pointsToSVGPath(leftLeftPoints);
  const leftRightD = pointsToSVGPath(leftRightPoints);
  if (leftLeftD)
    paths.push(
      `<path d="${leftLeftD}" fill="none" stroke="${leftColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
    );
  if (leftRightD)
    paths.push(
      `<path d="${leftRightD}" fill="none" stroke="${leftColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
    );

  // Right-hand paths
  const rightLeftPoints = generateMandalaPath(
    beats,
    "right",
    tipLeft,
    gridRadius,
    samplesPerBeat
  );
  const rightRightPoints = generateMandalaPath(
    beats,
    "right",
    tipRight,
    gridRadius,
    samplesPerBeat
  );
  const rightLeftD = pointsToSVGPath(rightLeftPoints);
  const rightRightD = pointsToSVGPath(rightRightPoints);
  if (rightLeftD)
    paths.push(
      `<path d="${rightLeftD}" fill="none" stroke="${rightColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
    );
  if (rightRightD)
    paths.push(
      `<path d="${rightRightD}" fill="none" stroke="${rightColor}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"/>`
    );

  const gridDots = showGridDots
    ? Object.entries(LOCATION_ANGLES).map(([loc, angle]) => {
        if (loc === "center") return { x: 0, y: 0 };
        return {
          x: Math.cos(angle) * gridRadius,
          y: Math.sin(angle) * gridRadius,
        };
      })
    : [];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d0d1a" rx="12"/>
  <g transform="translate(${center}, ${center})">
    ${gridDots.map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3.5" fill="rgba(255,255,255,0.25)"/>`).join("\n    ")}
    ${paths.join("\n    ")}
  </g>
</svg>`;
}

const svgOpts = {
  size: 500,
  gridRadius: 80,
  strokeWidth: 2,
  samplesPerBeat: 64,
  showGridDots: true,
};

// Generate diagnostic beat-by-beat view
const leftDiag = generateBeatByBeatSVG(seq, "left", svgOpts);

console.log("\n=== LEFT HAND BEAT JUNCTIONS ===");
for (const d of leftDiag.diagnostics) {
  console.log(
    `Beat ${d.beat} (${d.letter}, ${d.motionType}): ${d.startLoc} → ${d.endLoc}`
  );
  console.log(`  Staff angle: ${d.startStaffAngle}° → ${d.endStaffAngle}°`);
  console.log(
    `  Tip start: (${d.startTip.x}, ${d.startTip.y})  Tip end: (${d.endTip.x}, ${d.endTip.y})`
  );
}

// Check gaps between beats
console.log("\n=== JUNCTION GAPS ===");
for (let i = 0; i < leftDiag.diagnostics.length - 1; i++) {
  const end = leftDiag.diagnostics[i];
  const start = leftDiag.diagnostics[i + 1];
  const dx = parseFloat(start.startTip.x) - parseFloat(end.endTip.x);
  const dy = parseFloat(start.startTip.y) - parseFloat(end.endTip.y);
  const gap = Math.sqrt(dx * dx + dy * dy).toFixed(2);
  console.log(
    `Beat ${end.beat} end → Beat ${start.beat} start: gap = ${gap}px (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)})`
  );
}

// Generate tip inset comparison
const insets = [0, 5, 10, 15, 20, 30];
const insetSvgs = insets.map((inset) => ({
  inset,
  svg: generateWithTipInset(seq, inset, svgOpts),
}));

// Also generate the decomposed view alongside (using 10px inset as default)
const bestInsetOpts = { ...svgOpts };
const leftSvg = generateDecomposedSVG(seq, { ...bestInsetOpts, show: "left" });
const rightSvg = generateDecomposedSVG(seq, {
  ...bestInsetOpts,
  show: "right",
});
const combinedSvg = generateDecomposedSVG(seq, {
  ...bestInsetOpts,
  show: "both",
});

// Beat color legend
const beatColors = [
  "#4488ff",
  "#22cc88",
  "#ff8844",
  "#cc44ff",
  "#ffcc22",
  "#44cccc",
];
const legend = seq.beats
  .map(
    (b, i) =>
      `<span style="color:${beatColors[i % beatColors.length]}; margin-right: 16px;">Beat ${i + 1}: ${b.letter} (${b.leftMotionType})</span>`
  )
  .join("");

const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { background: #111; color: #eee; font-family: system-ui; padding: 40px 20px; margin: 0; }
  h1 { text-align: center; color: #ccc; font-size: 28px; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 15px; }
  .section-title { text-align: center; color: #999; font-size: 20px; margin: 30px 0 10px; }
  .legend { text-align: center; margin-bottom: 20px; font-size: 14px; }
  .row { display: flex; align-items: center; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 30px; }
  .panel { text-align: center; }
  .panel h3 { margin: 12px 0 4px; font-size: 18px; }
  .panel p { margin: 0; color: #666; font-size: 13px; }
  .blue-label { color: #4466cc; }
  .red-label { color: #cc4444; }
  .combined-label { color: #ccc; }
  .operator { font-size: 48px; color: #444; font-weight: 300; line-height: 500px; }
</style>
</head>
<body>
<h1>${seq.seedWord}</h1>
<p class="subtitle">${rawSeq.handPathFamily} &mdash; ${rawSeq.beats.length}-beat seed expanded to ${fullBeats.length}-beat loop</p>

<h2 class="section-title">Tip Inset Comparison</h2>
<p style="text-align:center;color:#888;font-size:14px;margin-bottom:24px;">Tracking point moved inward from the exact staff tip. 0 = exact tip (dx=150), 10 = 10px inward (dx=140), etc.</p>
<div class="row" style="gap: 16px;">
${insetSvgs
  .map(
    ({ inset, svg }) => `
  <div class="panel">
    ${svg}
    <h3 style="color:#ccc;">${inset === 0 ? "Exact tip (0px)" : inset + "px inset"}</h3>
    <p>dx = ${150 - inset}</p>
  </div>
`
  )
  .join("")}
</div>

<h2 class="section-title">Left Hand: Beat-by-Beat Diagnostic</h2>
<div class="legend">${legend}</div>
<p style="text-align:center;color:#ff3333;font-size:13px;">Red dots = beat junction points (where discontinuities occur)</p>
<div class="row">
  <div class="panel">
    ${leftDiag.svg}
    <h3 class="blue-label">Left Hand, Right Tip — Color per Beat</h3>
  </div>
</div>

<h2 class="section-title">Final Mandala</h2>
<div class="row">
  <div class="panel">
    ${leftSvg}
    <h3 class="blue-label">Left Hand</h3>
  </div>
  <div class="operator">+</div>
  <div class="panel">
    ${rightSvg}
    <h3 class="red-label">Right Hand</h3>
  </div>
  <div class="operator">=</div>
  <div class="panel">
    ${combinedSvg}
    <h3 class="combined-label">Mandala</h3>
  </div>
</div>
</body>
</html>`;

fs.writeFileSync("scripts/mandala-output.html", html);
console.log("\nOutput written to scripts/mandala-output.html");
