/**
 * Gate static/models/props/sword.glb against sword.svg and against the registry.
 *
 * The sword is the first prop authored directly at its shipped size, so nothing
 * downstream corrects a bad export: if the builder's SVG conversion drifts, the
 * prop is simply the wrong length in the app. Everything the drawing pins down
 * is re-measured here from the shipped bytes.
 *
 * Run: node scripts/verify-sword-glb.cjs
 */

const path = require("path");

const { Vector3 } = require("three");

const {
  collectScene,
  invariant,
  loadShippedRegistry,
  parseGlb,
} = require("./lib/glb-measure.cjs");

const REPO_ROOT = path.join(__dirname, "..");
const glbPath = path.join(REPO_ROOT, "static", "models", "props", "sword.glb");

// --- sword.svg, the shape authority -------------------------------------
// The drawing spans x 112.5 to 566 with its viewBox center -- the prop pivot --
// at 286.15. Anything below that quotes an svg number is a claim about the
// artwork, not about the builder, so a builder edit that breaks one of these is
// a divergence from the drawing and should fail.
const SVG_SPAN_UNITS = 453.5;
const SVG_PIVOT_X = 286.15;
const AUTHORED_LENGTH_M = 0.8636;
const SVG_TO_M = AUTHORED_LENGTH_M / SVG_SPAN_UNITS;
const svgY = (x) => (x - SVG_PIVOT_X) * SVG_TO_M;
const svgR = (units) => units * SVG_TO_M;

/** A tenth of a millimetre: tight enough to catch a real drift, loose enough
 *  to survive float32 round-tripping through the GLB buffer. */
const TOLERANCE_M = 0.0001;

function near(actual, expected, message) {
  invariant(
    Math.abs(actual - expected) <= TOLERANCE_M,
    `${message}: expected ${expected.toFixed(6)}, got ${actual.toFixed(6)}`
  );
}

const { bytes, document, binary } = parseGlb(glbPath);
const stats = collectScene(document, binary);
const nodes = document.nodes ?? [];
const nodeIndexByName = new Map(nodes.map((node, index) => [node.name, index]));
const materialNames = new Set(
  (document.materials ?? []).map((item) => item.name)
);

// --- Structure ----------------------------------------------------------
const requiredNodes = [
  "TKA_Sword",
  "TKA_Hand_Pivot",
  "TKA_Sword_Pommel",
  "TKA_Sword_Grip",
  "TKA_Sword_Guard",
  "TKA_Sword_Blade",
];
for (const nodeName of requiredNodes) {
  invariant(
    nodeIndexByName.has(nodeName),
    `Required node is missing: ${nodeName}`
  );
}

invariant(bytes.length <= 400_000, `Sword exceeds 400 KB: ${bytes.length}`);
invariant(document.scenes?.length === 1, "Sword must contain exactly one scene");
invariant(
  (document.cameras?.length ?? 0) === 0,
  "QA camera leaked into the GLB"
);
invariant(
  !(document.extensionsUsed ?? []).includes("KHR_lights_punctual"),
  "QA lights leaked into the GLB"
);
invariant(stats.vertexCount <= 20_000, `Too many vertices: ${stats.vertexCount}`);
invariant(
  stats.triangleCount <= 30_000,
  `Too many triangles: ${stats.triangleCount}`
);

// --- The material split sword.svg asks for ------------------------------
//
// The drawing's own comment: hardware recolors to the hand color, the gold
// kevlar wick blade is preserved. prop-model-recolor.ts implements exactly that
// by looking for "Recolor" in the material name, and -- load-bearing -- once ANY
// material carries the marker it leaves every unmarked material alone. Drop the
// marker and the whole sword goes flat blue or red, wick included.
invariant(
  materialNames.has("TKA_Sword_Hardware_Recolor"),
  "Recolorable hardware material is missing; the sword would ignore prop color"
);
invariant(
  materialNames.has("TKA_Sword_Wick"),
  "Gold kevlar wick material is missing"
);
invariant(
  !"TKA_Sword_Wick".includes("Recolor"),
  "The wick must NOT carry the recolor marker; sword.svg preserves the blade"
);
invariant(
  materialNames.size === 2,
  `Unexpected material set: ${[...materialNames].join(", ")}`
);
const wick = (document.materials ?? []).find(
  (material) => material.name === "TKA_Sword_Wick"
);
invariant(
  Number.isInteger(wick.normalTexture?.index),
  "Kevlar weave normal texture is missing; the blade would read as flat paint"
);
invariant(
  (document.images?.length ?? 0) >= 1,
  "Kevlar weave image is not embedded"
);

// --- Size and grip ------------------------------------------------------
near(
  stats.dimensions.y,
  AUTHORED_LENGTH_M,
  "Overall length must match the 34in staff"
);
near(stats.maximum.y, svgY(566), "Blade point sits where the drawing puts it");
near(
  stats.minimum.y,
  svgY(126) - svgR(13.5),
  "Back of the pommel sits where the drawing puts it"
);
near(
  stats.dimensions.x,
  svgR(56),
  "Cross-guard span: bar plus both quillon balls"
);
invariant(
  stats.dimensions.z < stats.dimensions.x * 0.5,
  `Sword must stay flat: ${stats.dimensions.z.toFixed(4)}m deep against ` +
    `${stats.dimensions.x.toFixed(4)}m across`
);

const rootNode = nodes[nodeIndexByName.get("TKA_Sword")];
invariant(
  rootNode.extras?.tka_prop_type === "sword",
  "Root prop metadata is missing"
);
invariant(
  rootNode.extras?.grip_origin === "0,0,0",
  "Root grip metadata is missing"
);
invariant(
  rootNode.extras?.local_long_axis === "+Y",
  "Root axis metadata is missing"
);

const pivotPosition = new Vector3().setFromMatrixPosition(
  stats.worldMatrices.get(nodeIndexByName.get("TKA_Hand_Pivot"))
);
invariant(
  pivotPosition.length() <= 0.00001,
  `Hand pivot drifted: ${pivotPosition.toArray()}`
);

// --- Where each part lands ----------------------------------------------
//
// The parts have to stay in contact. The blade root runs back inside the guard
// and the grip runs up to it; a builder change that opens a gap between any two
// of them is invisible in a wireframe and obvious on the prop.
const bounds = (name) => {
  const found = stats.meshBounds.get(name);
  invariant(found, `No measured bounds for ${name}`);
  return found;
};
const pommel = bounds("TKA_Sword_Pommel");
const grip = bounds("TKA_Sword_Grip");
const guard = bounds("TKA_Sword_Guard");
const blade = bounds("TKA_Sword_Blade");

near(grip.minimum.y, svgY(138), "Grip starts where the drawing's rect starts");
near(grip.maximum.y, svgY(284), "Grip ends where the drawing's rect ends");
invariant(
  pommel.maximum.y >= grip.minimum.y,
  "Pommel has separated from the grip"
);
invariant(
  blade.minimum.y <= guard.maximum.y,
  "Blade root no longer reaches inside the guard"
);
invariant(
  guard.minimum.y <= grip.maximum.y,
  "Guard has separated from the grip"
);
invariant(
  pommel.maximum.x > grip.maximum.x && pommel.maximum.z > grip.maximum.z,
  "Pommel must stand proud of the grip on every axis, or it reads as a bead"
);

// The blade is the reason this prop is not a staff: it has to stay flatter than
// it is wide the whole way, or the lenticular section has become a rod.
const bladeDepth = blade.maximum.z - blade.minimum.z;
const bladeWidth = blade.maximum.x - blade.minimum.x;
near(bladeWidth, svgR(18), "Blade width at the shoulder");
invariant(
  bladeDepth < bladeWidth * 0.75,
  `Blade section is not lenticular: ${bladeDepth.toFixed(4)}m thick against ` +
    `${bladeWidth.toFixed(4)}m wide`
);

// --- The shipped registry -----------------------------------------------
const { resolvePropModel } = loadShippedRegistry(REPO_ROOT);
const resolved = resolvePropModel("SWORD");
invariant(resolved, "SWORD is not registered; it would fall back to procedural");
invariant(
  resolved.entry.modelUrl.endsWith("sword.glb"),
  `SWORD resolves to the wrong model: ${resolved.entry.modelUrl}`
);
invariant(
  resolved.scale === 1 && resolved.entry.gripOffsetY === 0,
  "sword.glb is authored at its shipped size and grip; it needs no correction"
);
invariant(
  resolved.entry.flipLongAxis !== true,
  "The blade already points at +Y; flipping would bury it in the arm"
);

const inches = (metres) => `${(metres * 39.3701).toFixed(2)}in`;
console.log(`sword.glb: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(
  `  ${stats.dimensions.x.toFixed(4)} x ${stats.dimensions.y.toFixed(4)} x ` +
    `${stats.dimensions.z.toFixed(4)} m, ${stats.triangleCount} triangles`
);
console.log(
  `  length ${inches(stats.dimensions.y)}` +
    `, blade ${inches(blade.maximum.y - guard.maximum.y)}` +
    `, hilt ${inches(guard.minimum.y - pommel.minimum.y)}`
);
console.log(
  `  hand at the guard: ${inches(stats.maximum.y)} of blade forward, ` +
    `${inches(-stats.minimum.y)} of hilt back`
);
console.log("  materials: recolorable hardware + preserved gold wick");
console.log("OK");
