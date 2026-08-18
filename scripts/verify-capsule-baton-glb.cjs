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

/**
 * The drawing exaggerates every cross-section about 2x so a hairline shaft
 * still reads on a small pictograph cell. 3D has no such problem, so the
 * builder de-exaggerates by one factor anchored to the 3D staff's own radius
 * (STAFF_DIAMETER_CM 2.5 x CM_TO_UNITS 0.01, halved). Silhouette preserved,
 * proportions real.
 */
const STAFF_RADIUS_M = 0.0125;
const CROSS_SCALE = STAFF_RADIUS_M / (5.0 * SVG_TO_M);

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
  "TKA_Baton_Grip",
  "TKA_Baton_Lit",
  "TKA_Baton_Vents",
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
// The 2D artwork puts prop identity in the LIT ENDS and keeps the hardware
// silver. prop-model-recolor.ts implements the same split by looking for
// "Recolor" in a material name, and -- load-bearing -- once ANY material
// carries the marker it leaves every unmarked material alone. Drop the marker
// and the whole baton goes flat blue or red, silver hardware included.
const recolorable = materials.filter((item) => item.name.includes("Recolor"));
invariant(
  recolorable.length === 1,
  `Exactly one material may carry the recolor marker, found ${recolorable.length}`
);
invariant(
  recolorable[0].name === "TKA_Baton_LED_Recolor",
  `Unexpected recolorable material: ${recolorable[0].name}`
);
for (const name of [
  "TKA_Baton_Hardware",
  "TKA_Baton_Grip",
  "TKA_Baton_Vent",
]) {
  invariant(materialNames.has(name), `Material is missing: ${name}`);
}
invariant(
  materialNames.size === 4,
  `Unexpected material set: ${[...materialNames].join(", ")}`
);

const baseColor = (name) =>
  materials.find((item) => item.name === name).pbrMetallicRoughness
    .baseColorFactor;
const luminance = (color) =>
  0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];

// The lit section is the only NEUTRAL material: recolorPropModel replaces the
// color outright, so a tint here would fight the prop color instead of taking
// it. A drifting authored color is the quiet way this breaks.
const litColor = baseColor("TKA_Baton_LED_Recolor");
invariant(
  Math.abs(litColor[0] - litColor[1]) < 0.001 &&
    Math.abs(litColor[1] - litColor[2]) < 0.001,
  `The lit material must be neutral so it reads as the prop color: ${litColor}`
);

// The grip is the one thing that has to stay legible against the hardware, or
// the middle of the prop reads as one undifferentiated silver tube.
const gripLuminance = luminance(baseColor("TKA_Baton_Grip"));
const hardwareLuminance = luminance(baseColor("TKA_Baton_Hardware"));
invariant(
  gripLuminance < hardwareLuminance * 0.6,
  `Grip must read darker than the hardware: ${gripLuminance.toFixed(4)} ` +
    `against ${hardwareLuminance.toFixed(4)}`
);

// --- Size and grip ------------------------------------------------------
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
// The widest point is the cap RIM, not the cap: the rim follows the cap's taper
// at a fixed 0.9mm margin, because a constant-radius band around a cone puts its
// flat ends nearly tangent to the cone and the intersection renders as a ragged
// line rather than a circle.
near(
  stats.dimensions.x,
  (radial(11.7) + 0.0009) * 2,
  "Widest section is the cap rim, proud of the drawing's cap radius"
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
  rootNode.extras?.recolor_material === "TKA_Baton_LED_Recolor",
  "Root recolor metadata does not name the marked material"
);

// prop-tip-geometry-3d.ts copies this number as CAPSULE_BATON_REACH_M. The
// glow reads from the middle of each cap, not from the closed end, so tracking
// the mesh end would float the effect about 32mm past the prop.
near(
  rootNode.extras?.tracked_tip_y ?? 0,
  axial(117.0),
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
const grip = bounds("TKA_Baton_Grip");
const lit = bounds("TKA_Baton_Lit");
const vents = bounds("TKA_Baton_Vents");

near(grip.maximum.y, axial(30.0), "Grip ends where the drawing's rect ends");
near(grip.minimum.y, -axial(30.0), "Grip is centred on the hand");
// Only the rubber sleeve is in this group. Its two end rings are silver in the
// drawing, so they ship with the hardware and stand proud of the sleeve there.
near(grip.maximum.x, radial(6.3), "Grip sleeve matches the drawing's rect");
invariant(
  fittings.maximum.x > grip.maximum.x,
  "Grip end rings must stand proud of the sleeve, or the grip reads as a stripe"
);
invariant(
  fittings.maximum.y > grip.maximum.y,
  "Shaft no longer runs past the grip"
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
invariant(
  vents.maximum.y < lit.maximum.y && vents.minimum.y > lit.minimum.y,
  "Vents must sit inside the tube, not past a cap"
);
near(
  vents.maximum.x,
  radial(10.0) + 0.0003,
  "Vents sit a third of a millimetre proud of the tube wall"
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
    `, shaft dia ${inches(radial(5.0) * 2)}` +
    `, cap dia ${inches(radial(11.7) * 2)}`
);
console.log(
  `  hand at the middle: ${inches(stats.maximum.y)} to each cap tip, ` +
    `tracked glow at ${inches(rootNode.extras.tracked_tip_y)}`
);
console.log("  materials: recolorable lit ends + preserved silver hardware");
console.log("OK");
