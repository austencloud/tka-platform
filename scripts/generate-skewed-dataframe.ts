/**
 * Skewed Pictograph Dataframe Generator
 *
 * Generates SkewedPictographDataframe.csv by applying skew operations to
 * existing Diamond and Box pictographs.
 *
 * Skew = modified shift that crosses grid boundary (cardinal <-> intercardinal)
 *
 * Run with: npx tsx scripts/generate-skewed-dataframe.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Location types
type CardinalLocation = "n" | "e" | "s" | "w";
type IntercardinalLocation = "ne" | "se" | "sw" | "nw";
type Location = CardinalLocation | IntercardinalLocation;

// Grid location cycle (8 positions, 45° apart)
const LOCATION_CYCLE: Location[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

const CARDINAL_LOCATIONS = new Set<Location>(["n", "e", "s", "w"]);
const INTERCARDINAL_LOCATIONS = new Set<Location>(["ne", "se", "sw", "nw"]);

type SkewDir = "+" | "-" | "";
type MotionType = "pro" | "anti" | "static" | "dash" | "float";

interface PictographRow {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotionType: MotionType;
  blueRotationDirection: string;
  blueStartLocation: Location;
  blueEndLocation: Location;
  redMotionType: MotionType;
  redRotationDirection: string;
  redStartLocation: Location;
  redEndLocation: Location;
}

interface SkewedRow extends PictographRow {
  blueSkewDir: SkewDir;
  redSkewDir: SkewDir;
}

// Helper to get index in location cycle
function getLocationIndex(loc: Location): number {
  return LOCATION_CYCLE.indexOf(loc);
}

// Apply skew to a location (cross grid boundary)
function applySkew(loc: Location, skewDir: "+" | "-"): Location {
  const idx = getLocationIndex(loc);
  const offset = skewDir === "+" ? 1 : -1;
  const newIdx = (idx + offset + 8) % 8;
  return LOCATION_CYCLE[newIdx];
}

// Check if location is cardinal
function isCardinal(loc: Location): boolean {
  return CARDINAL_LOCATIONS.has(loc);
}

// Check if a motion is shiftable (can have skew applied)
function isShiftableMotion(motionType: MotionType): boolean {
  // Only pro and anti motions can be skew (not static, dash, or float)
  return motionType === "pro" || motionType === "anti";
}

// Check if a motion crosses grid boundary (cardinal <-> intercardinal)
function crossesBoundary(start: Location, end: Location): boolean {
  return isCardinal(start) !== isCardinal(end);
}

// Calculate angular steps between two locations (0-4, where 4 = opposite)
function getAngularSteps(start: Location, end: Location): number {
  const startIdx = getLocationIndex(start);
  const endIdx = getLocationIndex(end);
  const diff = Math.abs(endIdx - startIdx);
  // Return the shorter path (clockwise or counterclockwise)
  return Math.min(diff, 8 - diff);
}

// Determine what motion type a start->end movement actually is
function determineMotionType(
  start: Location,
  end: Location,
  originalType: MotionType
): MotionType | null {
  if (start === end) {
    return "static";
  }

  const steps = getAngularSteps(start, end);

  // 4 steps = 180° = dash (opposite)
  if (steps === 4) {
    return "dash";
  }

  // 1-2 steps = 45°-90° = shift-like motion (pro/anti)
  // Keep the original rotation type (pro vs anti)
  if (steps === 1 || steps === 2) {
    return originalType === "pro" || originalType === "anti"
      ? originalType
      : null;
  }

  // 3 steps = 135° - this is a valid skewed motion for pro/anti
  if (steps === 3) {
    return originalType === "pro" || originalType === "anti"
      ? originalType
      : null;
  }

  return null;
}

// Validate that a skewed motion is still valid
function isValidSkewedMotion(
  start: Location,
  end: Location,
  claimedType: MotionType
): boolean {
  const actualType = determineMotionType(start, end, claimedType);

  // If motion became a dash but we claim it's pro/anti, that's invalid
  if (
    actualType === "dash" &&
    (claimedType === "pro" || claimedType === "anti")
  ) {
    return false;
  }

  // If motion became static but we claim it's something else, invalid
  if (actualType === "static" && claimedType !== "static") {
    return false;
  }

  return actualType !== null;
}

// Derive end position name from hand locations
function deriveEndPosition(blue: Location, red: Location): string {
  // Map of (blue, red) -> position
  const positionMap: Record<string, string> = {
    // Alpha positions (180°)
    "s,n": "alpha1",
    "sw,ne": "alpha2",
    "w,e": "alpha3",
    "nw,se": "alpha4",
    "n,s": "alpha5",
    "ne,sw": "alpha6",
    "e,w": "alpha7",
    "se,nw": "alpha8",

    // Beta positions (0°)
    "n,n": "beta1",
    "ne,ne": "beta2",
    "e,e": "beta3",
    "se,se": "beta4",
    "s,s": "beta5",
    "sw,sw": "beta6",
    "w,w": "beta7",
    "nw,nw": "beta8",

    // Gamma positions (90°)
    "w,n": "gamma1",
    "nw,ne": "gamma2",
    "n,e": "gamma3",
    "ne,se": "gamma4",
    "e,s": "gamma5",
    "se,sw": "gamma6",
    "s,w": "gamma7",
    "sw,nw": "gamma8",
    "e,n": "gamma9",
    "se,ne": "gamma10",
    "s,e": "gamma11",
    "sw,se": "gamma12",
    "w,s": "gamma13",
    "nw,sw": "gamma14",
    "n,w": "gamma15",
    "ne,nw": "gamma16",

    // Zeta positions (135°)
    "sw,n": "zeta1",
    "w,ne": "zeta2",
    "nw,e": "zeta3",
    "n,se": "zeta4",
    "ne,s": "zeta5",
    "e,sw": "zeta6",
    "se,w": "zeta7",
    "s,nw": "zeta8",
    "se,n": "zeta9",
    "s,ne": "zeta10",
    "sw,e": "zeta11",
    "w,se": "zeta12",
    "nw,s": "zeta13",
    "n,sw": "zeta14",
    "ne,w": "zeta15",
    "e,nw": "zeta16",

    // Eta positions (45°)
    "nw,n": "eta1",
    "n,ne": "eta2",
    "ne,e": "eta3",
    "e,se": "eta4",
    "se,s": "eta5",
    "s,sw": "eta6",
    "sw,w": "eta7",
    "w,nw": "eta8",
    "ne,n": "eta9",
    "e,ne": "eta10",
    "se,e": "eta11",
    "s,se": "eta12",
    "sw,s": "eta13",
    "w,sw": "eta14",
    "nw,w": "eta15",
    "n,nw": "eta16",
  };

  const key = `${blue},${red}`;
  return positionMap[key] || `unknown_${key}`;
}

// Parse CSV row
function parseRow(line: string, header: string[]): PictographRow | null {
  const values = line.split(",");
  if (values.length !== header.length) return null;

  const row: Record<string, string> = {};
  header.forEach((col, i) => (row[col] = values[i]));

  return {
    letter: row.letter,
    startPosition: row.startPosition,
    endPosition: row.endPosition,
    timing: row.timing,
    direction: row.direction,
    blueMotionType: row.blueMotionType as MotionType,
    blueRotationDirection: row.blueRotationDirection,
    blueStartLocation: row.blueStartLocation as Location,
    blueEndLocation: row.blueEndLocation as Location,
    redMotionType: row.redMotionType as MotionType,
    redRotationDirection: row.redRotationDirection,
    redStartLocation: row.redStartLocation as Location,
    redEndLocation: row.redEndLocation as Location,
  };
}

// Generate skewed variants from a base pictograph
function generateSkewedVariants(base: PictographRow): SkewedRow[] {
  const variants: SkewedRow[] = [];

  const blueCanSkew = isShiftableMotion(base.blueMotionType);
  const redCanSkew = isShiftableMotion(base.redMotionType);

  // If neither hand can skew, no variants possible
  if (!blueCanSkew && !redCanSkew) return [];

  // Generate all combinations of skew directions
  const blueOptions: SkewDir[] = blueCanSkew ? ["+", "-"] : [""];
  const redOptions: SkewDir[] = redCanSkew ? ["+", "-"] : [""];

  for (const blueSkewDir of blueOptions) {
    for (const redSkewDir of redOptions) {
      // Skip the case where neither hand skews
      if (blueSkewDir === "" && redSkewDir === "") continue;

      // Calculate new end locations
      const newBlueEnd =
        blueSkewDir !== ""
          ? applySkew(base.blueEndLocation, blueSkewDir)
          : base.blueEndLocation;

      const newRedEnd =
        redSkewDir !== ""
          ? applySkew(base.redEndLocation, redSkewDir)
          : base.redEndLocation;

      // Verify at least one hand crosses boundary (that's what makes it "skewed")
      const blueCrosses =
        blueSkewDir !== "" &&
        crossesBoundary(base.blueStartLocation, newBlueEnd);
      const redCrosses =
        redSkewDir !== "" && crossesBoundary(base.redStartLocation, newRedEnd);

      if (!blueCrosses && !redCrosses) continue;

      // Derive the new end position
      const newEndPosition = deriveEndPosition(newBlueEnd, newRedEnd);

      // Skip if we get an unknown position
      if (newEndPosition.startsWith("unknown_")) {
        console.warn(
          `Unknown position for ${newBlueEnd},${newRedEnd} from ${base.letter}`
        );
        continue;
      }

      variants.push({
        ...base,
        blueEndLocation: newBlueEnd,
        redEndLocation: newRedEnd,
        endPosition: newEndPosition,
        blueSkewDir,
        redSkewDir,
      });
    }
  }

  return variants;
}

// Convert row to CSV line
function toCSVLine(row: SkewedRow): string {
  return [
    row.letter,
    row.startPosition,
    row.endPosition,
    row.timing,
    row.direction,
    row.blueMotionType,
    row.blueRotationDirection,
    row.blueSkewDir,
    row.blueStartLocation,
    row.blueEndLocation,
    row.redMotionType,
    row.redRotationDirection,
    row.redSkewDir,
    row.redStartLocation,
    row.redEndLocation,
  ].join(",");
}

// Main
function main() {
  const staticDir = path.join(__dirname, "..", "static", "data", "pictographs");
  const diamondPath = path.join(staticDir, "DiamondPictographDataframe.csv");
  const boxPath = path.join(staticDir, "BoxPictographDataframe.csv");
  const outputPath = path.join(staticDir, "SkewedPictographDataframe.csv");

  // Read input files
  const diamondContent = fs.readFileSync(diamondPath, "utf-8");
  const boxContent = fs.readFileSync(boxPath, "utf-8");

  const header = [
    "letter",
    "startPosition",
    "endPosition",
    "timing",
    "direction",
    "blueMotionType",
    "blueRotationDirection",
    "blueStartLocation",
    "blueEndLocation",
    "redMotionType",
    "redRotationDirection",
    "redStartLocation",
    "redEndLocation",
  ];

  // Parse rows
  const parseFile = (content: string): PictographRow[] => {
    const lines = content.split("\n").filter((l) => l.trim());
    return lines
      .slice(1)
      .map((line) => parseRow(line, header))
      .filter((r): r is PictographRow => r !== null);
  };

  const diamondRows = parseFile(diamondContent);
  const boxRows = parseFile(boxContent);

  console.log(`Loaded ${diamondRows.length} Diamond rows`);
  console.log(`Loaded ${boxRows.length} Box rows`);

  // Generate skewed variants
  const allVariants: SkewedRow[] = [];

  for (const row of [...diamondRows, ...boxRows]) {
    const variants = generateSkewedVariants(row);
    allVariants.push(...variants);
  }

  console.log(`Generated ${allVariants.length} skewed variants`);

  // Deduplicate (some may be identical from Diamond vs Box)
  const seen = new Set<string>();
  const uniqueVariants = allVariants.filter((v) => {
    const key = toCSVLine(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Unique variants: ${uniqueVariants.length}`);

  // Write output
  const outputHeader =
    "letter,startPosition,endPosition,timing,direction,blueMotionType,blueRotationDirection,blueSkewDir,blueStartLocation,blueEndLocation,redMotionType,redRotationDirection,redSkewDir,redStartLocation,redEndLocation";
  const outputLines = [outputHeader, ...uniqueVariants.map(toCSVLine)];

  fs.writeFileSync(outputPath, outputLines.join("\n"), "utf-8");
  console.log(`Wrote ${uniqueVariants.length} rows to ${outputPath}`);

  // Stats
  const byLetter = new Map<string, number>();
  const byEndPosition = new Map<string, number>();

  for (const v of uniqueVariants) {
    byLetter.set(v.letter, (byLetter.get(v.letter) || 0) + 1);
    byEndPosition.set(v.endPosition, (byEndPosition.get(v.endPosition) || 0) + 1);
  }

  console.log("\nVariants by letter (top 10):");
  [...byLetter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([letter, count]) => console.log(`  ${letter}: ${count}`));

  console.log("\nVariants by end position:");
  [...byEndPosition.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([pos, count]) => console.log(`  ${pos}: ${count}`));
}

main();
