// Enumerate every valid quarter-turn (turns: 0.25) semantic arrow state,
// derive its end orientation from MCP-backed canon physics, cross-check the
// shipped orientation algebra (@tka/render-core), map each state to its
// resolver asset identity, and emit the proposed equivalence classes with
// their outstanding geometric proof obligations.
//
// Canon (MCP get_term_definition "turns" / "orientation", 2026-08-23):
//   - turns are ADDITIONAL rotation beyond the motion's base behavior;
//     1 turn = 180deg, so 0.25 = 45deg = one orientation state.
//   - pro at 0 turns preserves orientation; anti at 0 turns switches it;
//     dash at 0 turns is pure translation (relative orientation switches);
//     static at 0 turns preserves orientation.
//   => quarter end orientation: pro/static = start rotated 45deg in the
//      prop's rotation direction; anti/dash = switch(start) rotated 45deg in
//      the prop's rotation direction.
//
// Output: docs/research/quarter-arrows/quarter-turn-state-space.json
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const renderCore = require(join(ROOT, "packages/render-core/dist/index.js"));
const { calculateOrientations, resolveFullArrowAssetPath } = renderCore;

// RADIAL cycle in the shipped index order (+1 index = 45deg CCW prop rotation
// in the SVG screen frame; verified against orientation-angle.ts bijection:
// staffAngle = centerPathAngle + PI - k * PI/4).
const RADIAL = ["in", "clockIn", "clock", "clockOut", "out", "counterOut", "counter", "counterIn"];
const CENTER = ["centerN", "centerNE", "centerE", "centerSE", "centerS", "centerSW", "centerW", "centerNW"];

const idx = (o) => RADIAL.indexOf(o);
const at = (i) => RADIAL[((i % 8) + 8) % 8];
const switchOri = (o) => at(idx(o) + 4);

/** Canon physics end orientation for relative-orientation quarter states. */
function canonEnd(motionType, rotationDirection, startOri) {
  const base = motionType === "anti" || motionType === "dash" ? 4 : 0;
  // CW prop rotation = -1 index step (RADIAL +1 index is CCW on screen).
  const turnStep = rotationDirection === "cw" ? -1 : 1;
  return at(idx(startOri) + base + turnStep);
}

/** Canon physics for static-at-center: absolute orientation rotates 45deg. */
function canonCenterEnd(rotationDirection, startOri) {
  const i = CENTER.indexOf(startOri);
  // CENTER cycle +1 index = clockwise on screen (N -> NE with y-down).
  const step = rotationDirection === "cw" ? 1 : -1;
  return CENTER[(((i + step) % 8) + 8) % 8];
}

// Representative locations per handpath family (diamond grid), so the shipped
// calculateOrientations can be called with fully-formed motion input.
const LOCATIONS = {
  shiftCw: { startLocation: "n", endLocation: "e" },
  shiftCcw: { startLocation: "n", endLocation: "w" },
  self: { startLocation: "n", endLocation: "n" },
  opposite: { startLocation: "n", endLocation: "s" },
  hashOut: { startLocation: "c", endLocation: "n" },
  hashIn: { startLocation: "n", endLocation: "c" },
};

const states = [];
let id = 0;

function pushState(s) {
  states.push({ id: `q${String(++id).padStart(3, "0")}`, turns: 0.25, ...s });
}

// --- pro / anti relative (shift paths; skew is an art axis, not an algebra axis)
for (const motionType of ["pro", "anti"]) {
  for (const rotationDirection of ["cw", "ccw"]) {
    // pro: handpath matches rotation; anti: handpath opposes it
    const handpath =
      (motionType === "pro") === (rotationDirection === "cw") ? "shiftCw" : "shiftCcw";
    for (const startOrientation of RADIAL) {
      pushState({ motionType, rotationDirection, startOrientation, handpath });
    }
  }
}

// --- static relative (self path)
for (const rotationDirection of ["cw", "ccw"]) {
  for (const startOrientation of RADIAL) {
    pushState({ motionType: "static", rotationDirection, startOrientation, handpath: "self" });
  }
}

// --- dash relative (opposite path)
for (const rotationDirection of ["cw", "ccw"]) {
  for (const startOrientation of RADIAL) {
    pushState({ motionType: "dash", rotationDirection, startOrientation, handpath: "opposite" });
  }
}

// --- dash hash-in (perimeter -> center): relative start, center-absolute end.
for (const rotationDirection of ["cw", "ccw"]) {
  for (const startOrientation of RADIAL) {
    pushState({ motionType: "dash", rotationDirection, startOrientation, handpath: "hashIn" });
  }
}

// --- dash hash-out (center -> perimeter): center-absolute start.
for (const rotationDirection of ["cw", "ccw"]) {
  for (const startOrientation of CENTER) {
    pushState({ motionType: "dash", rotationDirection, startOrientation, handpath: "hashOut" });
  }
}

// --- static at center (self path, center-absolute both ends)
for (const rotationDirection of ["cw", "ccw"]) {
  for (const startOrientation of CENTER) {
    pushState({ motionType: "static", rotationDirection, startOrientation, handpath: "self" });
  }
}

// ---------------------------------------------------------------------------
// Derive end orientations + shipped-algebra cross-check + asset identity
// ---------------------------------------------------------------------------
let agreements = 0;
const disagreements = [];
const openQuestions = [];

for (const s of states) {
  const isCenterStart = s.startOrientation.startsWith("center");
  const crossesRepresentation = s.handpath === "hashIn" || s.handpath === "hashOut";

  if (!isCenterStart && !crossesRepresentation) {
    s.endOrientationCanon = canonEnd(s.motionType, s.rotationDirection, s.startOrientation);
  } else if (isCenterStart && s.handpath === "self") {
    s.endOrientationCanon = canonCenterEnd(s.rotationDirection, s.startOrientation);
  } else {
    // hash-in / hash-out cross the relative<->absolute representation
    // boundary; canon end-orientation representation is an open question.
    s.endOrientationCanon = null;
    openQuestions.push(
      `${s.id} ${s.motionType} ${s.handpath} from ${s.startOrientation}: end orientation crosses the relative/absolute boundary`
    );
  }

  const loc = LOCATIONS[s.handpath];
  const shipped = calculateOrientations({
    motionType: s.motionType,
    turns: 0.25,
    rotationDirection: s.rotationDirection,
    startLocation: loc.startLocation,
    endLocation: loc.endLocation,
    startOrientation: s.startOrientation,
  });
  s.endOrientationShipped = shipped.endOrientation;

  if (s.endOrientationCanon !== null) {
    if (s.endOrientationCanon === s.endOrientationShipped) agreements++;
    else
      disagreements.push(
        `${s.id} ${s.motionType} ${s.rotationDirection} from ${s.startOrientation}: canon ${s.endOrientationCanon}, shipped ${s.endOrientationShipped}`
      );
  }

  s.assetPath = resolveFullArrowAssetPath({
    motionType: s.motionType,
    startOrientation: s.startOrientation,
    turns: 0.25,
  });
}

// ---------------------------------------------------------------------------
// Equivalence classes: states sharing one asset file. Each class records the
// geometric proof obligations the review lab must discharge before the
// collapse is trusted.
// ---------------------------------------------------------------------------
const classes = new Map();
for (const s of states) {
  const c = classes.get(s.assetPath) ?? { assetPath: s.assetPath, members: [], obligations: new Set() };
  c.members.push(s.id);
  classes.set(s.assetPath, c);
}
for (const c of classes.values()) {
  const members = c.members.map((mid) => states.find((s) => s.id === mid));
  const dirs = new Set(members.map((m) => m.rotationDirection));
  const starts = new Set(members.map((m) => m.startOrientation));
  if (dirs.size > 1)
    c.obligations.add("mirror transform must flip chirality exactly (cw vs ccw members share this art)");
  const startList = [...starts];
  const oppositePairs = startList.filter((o) => startList.includes(o.startsWith("center") ? o : switchOri(o)) && !o.startsWith("center"));
  if (oppositePairs.length > 0)
    c.obligations.add(
      `180deg-rotation identity must hold (opposite start orientations share this art: ${startList.join(", ")})`
    );
  c.obligations.add("rotation placement per grid location handled by placement frame (verify per location in lab)");
  c.obligations = [...c.obligations];
}

// ---------------------------------------------------------------------------
// Fixture check: the 24-step SpiroAnim Club loop must chain cleanly through
// the shipped algebra (stored orientations are engine/geometry-faithful).
// ---------------------------------------------------------------------------
const fixturePath = join(ROOT, "docs/research/spiroanim/editor-v9-quarter-turn-club-loop.json");
let fixtureReport = null;
try {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  let ok = 0;
  const bad = [];
  for (const step of fixture.steps) {
    for (const color of ["blue", "red"]) {
      const m = step.motions[color];
      const shipped = calculateOrientations({
        motionType: m.motionType,
        turns: m.turns,
        rotationDirection: m.rotationDirection,
        startLocation: m.startLocation,
        endLocation: m.endLocation,
        startOrientation: m.startOrientation,
      });
      if (shipped.endOrientation === m.endOrientation) ok++;
      else
        bad.push(
          `step ${step.stepNumber} ${color}: stored ${m.endOrientation}, shipped ${shipped.endOrientation}`
        );
    }
  }
  fixtureReport = { motions: ok + bad.length, agree: ok, disagreements: bad };
} catch (e) {
  fixtureReport = { error: e.message };
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
const OUT_DIR = join(ROOT, "docs/research/quarter-arrows");
mkdirSync(OUT_DIR, { recursive: true });
const out = {
  generated: "scripts/quarter-arrows/enumerate-states.mjs",
  canonSource:
    "MCP get_term_definition('turns') + get_term_definition('orientation'), 2026-08-23",
  stateCount: states.length,
  algebraAgreement: { agreements, disagreements },
  openQuestions,
  invalidByConstruction: [
    "pro or anti at center (shift requires a perimeter arc)",
    "turns 0.25 with rotationDirection noRotation",
    "float with numeric 0.25 (float is turns: 'fl')",
    "traveling static / self-path dash",
    "center-orientation tokens away from center",
    "end orientations that disagree with the orientation algebra",
  ],
  classes: [...classes.values()].map((c) => ({
    assetPath: c.assetPath,
    memberCount: c.members.length,
    members: c.members,
    obligations: c.obligations,
  })),
  states,
  fixture: fixtureReport,
};
const outPath = join(OUT_DIR, "quarter-turn-state-space.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`States enumerated: ${states.length}`);
console.log(
  `Canon vs shipped algebra: ${agreements} agree, ${disagreements.length} disagree`
);
if (disagreements.length) console.log(disagreements.slice(0, 10).join("\n"));
console.log(`Open questions: ${openQuestions.length} (hash representation boundary)`);
console.log(`Asset classes: ${classes.size}`);
for (const c of classes.values())
  console.log(`  ${String(c.members.length).padStart(3)} states -> ${c.assetPath}`);
console.log(
  `Fixture: ${fixtureReport.error ?? `${fixtureReport.agree}/${fixtureReport.motions} motions agree`}`
);
if (fixtureReport.disagreements?.length)
  console.log(fixtureReport.disagreements.join("\n"));
console.log(`\nWrote ${outPath}`);
