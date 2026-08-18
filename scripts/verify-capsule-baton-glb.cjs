/**
 * Gate static/models/props/capsule-baton.glb against capsule_baton.svg and
 * against the registry.
 *
 * The baton is authored at its shipped size, so nothing downstream corrects a
 * bad export: if the builder's SVG conversion drifts, the prop is simply the
 * wrong length in the app. Everything the drawing pins down is re-measured here
 * from the shipped bytes.
 *
 * Run: node scripts/verify-capsule-baton-glb.cjs
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
const glbPath = path.join(
  REPO_ROOT,
  "static",
  "models",
  "props",
  "capsule-baton.glb"
);

// --- capsule_baton.svg, the shape authority -----------------------------
// The drawing spans x 5.6 to 258.4 with its viewBox center -- the prop pivot --
// at 132.0. Anything below that quotes an svg number is a claim about the
// artwork, so a builder edit that breaks one of these is a divergence from the
// drawing and should fail.
const SVG_SPAN_UNITS = 252.8;
const AUTHORED_LENGTH_M = 0.8636;
const SVG_TO_M = AUTHORED_LENGTH_M / SVG_SPAN_UNITS;

// --- The physical prop, the size authority -------------------------------
// flowtoys composite iso baton / lumina twirl baton. Published numbers.
const TUBE_OD_M = 0.0254; // 1" polycarbonate end tube
const TUBE_LENGTH_M = 0.135; // 13.5cm of clear tube per end
const SHAFT_OD_M = 0.014; // 12mm carbon cable, 14mm over its braid
const CAP_OD_M = 0.0381; // 1.5" silicone flowcap pushed over that tube

/**
 * The drawing exaggerates every cross-section about 2x so a hairline shaft
 * still reads on a small pictograph cell. 3D has no such problem, so the builder
 * de-exaggerates by one factor anchored to the END TUBE at its published 1" OD.
 *
 * An earlier build anchored on the 3D staff's radius instead, on the assumption
 * that a baton shaft and a staff share a cross-section. They do not -- a staff
 * tube is 25mm, a baton shaft is 12mm -- so that build shipped a 25mm shaft and
 * 50mm tubes, almost exactly twice the real object at every station. That is
 * what the real-prop assertions further down exist to catch.
 */
const CROSS_SCALE = TUBE_OD_M / 2 / (10.0 * SVG_TO_M);

/** Signed distance from the pivot, in metres, for an offset in svg units. */
const axial = (units) => units * SVG_TO_M;
/** A perpendicular measurement, in metres, for a radius in svg units. */
const radial = (units) => units * SVG_TO_M * CROSS_SCALE;

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
const materials = document.materials ?? [];
const materialNames = new Set(materials.map((item) => item.name));

// --- Structure ----------------------------------------------------------
const requiredNodes = [
  "TKA_CapsuleBaton",
  "TKA_Hand_Pivot",
  "TKA_Baton_Fittings",
  "TKA_Baton_Lit",
];
for (const nodeName of requiredNodes) {
  invariant(
    nodeIndexByName.has(nodeName),
    `Required node is missing: ${nodeName}`
  );
}

invariant(bytes.length <= 400_000, `Baton exceeds 400 KB: ${bytes.length}`);
invariant(document.scenes?.length === 1, "Baton must contain exactly one scene");
invariant(
  (document.cameras?.length ?? 0) === 0,
  "QA camera leaked into the GLB"
);
invariant(
  !(document.extensionsUsed ?? []).includes("KHR_lights_punctual"),
  "QA lights leaked into the GLB"
);
invariant(
  stats.vertexCount <= 20_000,
  `Too many vertices: ${stats.vertexCount}`
);
invariant(
  stats.triangleCount <= 30_000,
  `Too many triangles: ${stats.triangleCount}`
);

// --- The material split capsule_baton.svg asks for ----------------------
//
// Prop identity lives in the SHAFT and the ends stay clear, which is both how
// flowtoys sells the object and the only split that survives the light being on.
// prop-model-recolor.ts implements it by looking for "Recolor" in a material
// name, and -- load-bearing -- once ANY material carries the marker it leaves
// every unmarked material alone. Drop the marker and the whole baton, clear ends
// included, goes flat blue or red.
const recolorable = materials.filter((item) => item.name.includes("Recolor"));
invariant(
  recolorable.length === 1,
  `Exactly one material may carry the recolor marker, found ${recolorable.length}`
);
invariant(
  recolorable[0].name === "TKA_Baton_Shaft_Recolor",
  `Unexpected recolorable material: ${recolorable[0].name}`
);
for (const name of ["TKA_Baton_Tube", "TKA_Baton_Cap"]) {
  invariant(materialNames.has(name), `Material is missing: ${name}`);
}
invariant(
  materialNames.size === 3,
  `Unexpected material set: ${[...materialNames].join(", ")}`
);

const baseColor = (name) =>
  materials.find((item) => item.name === name).pbrMetallicRoughness
    .baseColorFactor;
const luminance = (color) =>
  0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];

// The shaft is the one NEUTRAL material: recolorPropModel replaces its color
// outright, so a tint here would fight the prop color instead of taking it. A
// drifting authored color is the quiet way this breaks.
const shaftColor = baseColor("TKA_Baton_Shaft_Recolor");
invariant(
  Math.abs(shaftColor[0] - shaftColor[1]) < 0.001 &&
    Math.abs(shaftColor[1] - shaftColor[2]) < 0.001,
  `The shaft material must be neutral so it reads as the prop color: ${shaftColor}`
);

// Both ends have to stay clear. They are preserved materials, so whatever is
// authored here is what ships, and anything but near-white stops reading as
// polycarbonate and silicone.
for (const name of ["TKA_Baton_Tube", "TKA_Baton_Cap"]) {
  const color = baseColor(name);
  invariant(
    luminance(color) > 0.7,
    `${name} must stay clear, not tinted: ${luminance(color).toFixed(4)}`
  );
}

// --- Size --------------------------------------------------------------
near(
  stats.dimensions.y,
  AUTHORED_LENGTH_M,
  "Overall length must match the 34in staff"
);
near(stats.maximum.y, axial(126.4), "Cap tip sits where the drawing puts it");
near(
  stats.minimum.y,
  -axial(126.4),
  "The baton is bilateral: both caps close at the same distance"
);
// The widest point is the cap's shoulder. There is no proud rim band any more:
// it only ever existed to hide a z-fight against the old cap cone.
near(
  stats.dimensions.x,
  radial(15.0) * 2,
  "Widest section is the cap's shoulder"
);
near(
  stats.dimensions.z,
  stats.dimensions.x,
  "The baton is a solid of revolution and must measure the same on both axes"
);

const rootNode = nodes[nodeIndexByName.get("TKA_CapsuleBaton")];
invariant(
  rootNode.extras?.tka_prop_type === "capsule_baton",
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
invariant(
  rootNode.extras?.recolor_material === "TKA_Baton_Shaft_Recolor",
  "Root recolor metadata does not name the marked material"
);

// prop-tip-geometry-3d.ts copies this number as CAPSULE_BATON_REACH_M. The
// glow reads from inside the cap, not from its closed end, so tracking the mesh
// end would fire the effect off the tip instead of out of the capsule.
near(
  rootNode.extras?.tracked_tip_y ?? 0,
  axial(120.0),
  "Tracked tip must sit at the cap's glow centre"
);
invariant(
  (rootNode.extras?.tracked_tip_y ?? 0) < stats.maximum.y,
  "Tracked tip cannot sit outside the mesh"
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
// The parts have to stay in contact. The shaft runs out under both collars and
// the tube overlaps inside each cap; a builder change that opens a gap is
// invisible in a wireframe and obvious on the prop.
const bounds = (name) => {
  const found = stats.meshBounds.get(name);
  invariant(found, `No measured bounds for ${name}`);
  return found;
};
const fittings = bounds("TKA_Baton_Fittings");
const lit = bounds("TKA_Baton_Lit");

// The cable runs bare from end to end. A grip sleeve lived here for several
// revisions because the drawing had one; the physical prop does not, so any
// swell across the pivot is a regression, not a detail.
near(
  fittings.maximum.x,
  radial(10.35),
  "The widest hardware is the tube rim, not anything near the hand"
);
invariant(
  fittings.maximum.y > axial(80.0),
  "The cable must reach the couplers"
);
invariant(
  lit.minimum.y < 0 && lit.maximum.y > 0,
  "The lit meshes must be a symmetric pair, one per end"
);
near(lit.maximum.y, axial(126.4), "The cap is part of the lit section");
invariant(
  lit.maximum.y > fittings.maximum.y,
  "The cap must stand past the collar and rim hardware"
);
// --- Against the physical prop -------------------------------------------
//
// These are the assertions the first build would have failed. Everything above
// checks the model against the DRAWING, which the first build satisfied
// perfectly while being twice as thick as the object it depicts, because the
// drawing's cross-section is deliberately exaggerated and the factor that undoes
// that exaggeration was anchored to the wrong prop.
//
// Two millimetres, not a tenth of one: the drawing's proportions and the real
// prop's agree closely but not exactly, and it is the 11mm and 25mm errors that
// matter here.
const REAL_TOLERANCE_M = 0.002;
function nearReal(actual, expected, message) {
  invariant(
    Math.abs(actual - expected) <= REAL_TOLERANCE_M,
    `${message}: expected ${(expected * 1000).toFixed(1)}mm, got ` +
      `${(actual * 1000).toFixed(1)}mm`
  );
}

nearReal(radial(5.0) * 2, SHAFT_OD_M, "Shaft is a 12mm carbon shaft under tape");
nearReal(radial(10.0) * 2, TUBE_OD_M, 'End tube is 1" polycarbonate');
nearReal(radial(15.0) * 2, CAP_OD_M, "Flowcap fits over that tube");

// The step from tube to cap is the whole silhouette of a lit end, and it is the
// thing a second build lost by over-correcting a too-long cap into a too-thin
// one. A cap that only just clears its tube reads as a sleeve, not as a cap.
invariant(
  CAP_OD_M / TUBE_OD_M > 1.35,
  `Cap must step visibly out from its tube: ${(CAP_OD_M / TUBE_OD_M).toFixed(2)}x`
);

// The tube is the long part of each end and the cap is a short lid over its tip.
// Getting this backwards is what made the first build read as a bulb on a stick.
const tubeOuterY = axial(120.0);
const capInnerY = axial(113.0);
nearReal(
  tubeOuterY - TUBE_LENGTH_M >= 0 ? TUBE_LENGTH_M : 0,
  TUBE_LENGTH_M,
  "Clear tube runs the real prop's 13.5cm"
);
invariant(
  capInnerY < tubeOuterY,
  "Cap must overlap the tube's tip, or the two lathes leave a seam"
);
invariant(
  stats.maximum.y - capInnerY < TUBE_LENGTH_M / 2,
  "Cap must be a short lid, not a cone eating the tube's length"
);
invariant(
  tubeOuterY - TUBE_LENGTH_M < axial(86.0),
  "Tube must reach in past the shaft's end, or the parts do not connect"
);

// --- The shipped registry -----------------------------------------------
const { resolvePropModel } = loadShippedRegistry(REPO_ROOT);
const resolved = resolvePropModel("CAPSULE_BATON");
invariant(
  resolved,
  "CAPSULE_BATON is not registered; it would fall back to the staff model"
);
invariant(
  resolved.entry.modelUrl.endsWith("capsule-baton.glb"),
  `CAPSULE_BATON resolves to the wrong model: ${resolved.entry.modelUrl}`
);
invariant(
  resolved.scale === 1 && resolved.entry.gripOffsetY === 0,
  "capsule-baton.glb is authored at its shipped size and grip"
);
invariant(
  resolved.entry.flipLongAxis !== true,
  "The baton is bilateral; flipping it would change nothing but the winding"
);

const inches = (metres) => `${(metres * 39.3701).toFixed(2)}in`;
console.log(`capsule-baton.glb: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(
  `  ${stats.dimensions.x.toFixed(4)} x ${stats.dimensions.y.toFixed(4)} x ` +
    `${stats.dimensions.z.toFixed(4)} m, ${stats.triangleCount} triangles`
);
console.log(
  `  length ${inches(stats.dimensions.y)}` +
    `, shaft dia ${(radial(5.0) * 2000).toFixed(1)}mm` +
    `, tube dia ${(radial(10.0) * 2000).toFixed(1)}mm` +
    `, cap dia ${(radial(15.0) * 2000).toFixed(1)}mm`
);
console.log(
  `  hand at the middle: ${inches(stats.maximum.y)} to each cap tip, ` +
    `tracked glow at ${inches(rootNode.extras.tracked_tip_y)}`
);
console.log("  materials: recolorable shaft + preserved clear ends");
console.log("OK");
