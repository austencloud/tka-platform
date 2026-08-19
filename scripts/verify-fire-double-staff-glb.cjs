/**
 * Gate static/models/props/fire-double-staff.glb against fire_double_staff.svg,
 * against the published dimensions of the physical prop, and against the
 * registry.
 *
 * The staff is authored at its shipped size, so nothing downstream corrects a
 * bad export: if the builder drifts, the prop is simply the wrong object in the
 * app. Everything the drawing and the spec sheet pin down is re-measured here
 * from the shipped bytes.
 *
 * Run: node scripts/verify-fire-double-staff-glb.cjs
 */

const fs = require("fs");
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
  "fire-double-staff.glb"
);

// Stations come from scripts/fire-double-staff-stations.json, which the SVG
// generator emits. Hardcoding them here would be a third copy of the same
// table, and three copies is how the drawing, the lathe and this file each
// ended up asserting a different prop on the capsule baton.
//
// The drawing's UNIT stations carry a 1.15x cross exaggeration so a 16mm tube
// still reads on a pictograph cell. The generator publishes the unexaggerated
// millimetres alongside them, and 3D is built from those, so this file measures
// against millimetres and never has to undo anything.
const STATIONS = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, "scripts", "fire-double-staff-stations.json"),
    "utf8"
  )
);

const MM = 0.001;
const AUTHORED_LENGTH_M = STATIONS.length_mm * MM;
const HALF_LENGTH_M = STATIONS.half_length_mm * MM;
const KNOT_LENGTH_M = STATIONS.knot_length_mm * MM;
const KNOT_MOUTH_M = HALF_LENGTH_M - KNOT_LENGTH_M;
const GRIP_HALF_M = STATIONS.grip_half_mm * MM;
const TRACKED_TIP_M = STATIONS.tracked_tip_mm * MM;

// --- The physical prop, the size authority -------------------------------
// Sacred Flow Art's Kevlar Double Staff Pro, 35.5in / 90cm: a 5/8in 7075-T6
// aluminium tube, overgrip through the middle, and a kevlar monkey fist at each
// end. The wick was measured off their own product photography after rotating
// the staff level and reading its silhouette column by column.
const TUBE_OD_M = STATIONS.tube_od_mm * MM;
const GRIP_OD_M = STATIONS.grip_od_mm * MM;
const KNOT_OD_M = STATIONS.knot_od_mm * MM;

/** A tenth of a millimetre: tight enough to catch a real drift, loose enough
 *  to survive float32 round-tripping through the GLB buffer. */
const TOLERANCE_M = 0.0001;

function near(actual, expected, message) {
  invariant(
    Math.abs(actual - expected) <= TOLERANCE_M,
    `${message}: expected ${expected.toFixed(6)}, got ${actual.toFixed(6)}`
  );
}

/** Two millimetres: the wick is woven rope, not a lathe, so its measured extent
 *  lands near its nominal diameter rather than exactly on it. */
const REAL_TOLERANCE_M = 0.002;

function nearReal(actual, expected, message) {
  invariant(
    Math.abs(actual - expected) <= REAL_TOLERANCE_M,
    `${message}: expected ${(expected * 1000).toFixed(1)}mm, got ` +
      `${(actual * 1000).toFixed(1)}mm`
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
  "TKA_FireDoubleStaff",
  "TKA_Hand_Pivot",
  "TKA_FireStaff_Metal",
  "TKA_FireStaff_Wicks",
];
for (const nodeName of requiredNodes) {
  invariant(
    nodeIndexByName.has(nodeName),
    `Required node is missing: ${nodeName}`
  );
}

invariant(bytes.length <= 900_000, `Staff exceeds 900 KB: ${bytes.length}`);
invariant(document.scenes?.length === 1, "Staff must contain exactly one scene");
invariant(
  (document.cameras?.length ?? 0) === 0,
  "QA camera leaked into the GLB"
);
invariant(
  !(document.extensionsUsed ?? []).includes("KHR_lights_punctual"),
  "QA lights leaked into the GLB"
);
// A woven monkey fist is genuinely more geometry than a lathe. Two of them are
// most of this budget, and it is still an order of magnitude under a scene.
invariant(
  stats.vertexCount <= 24_000,
  `Too many vertices: ${stats.vertexCount}`
);
invariant(
  stats.triangleCount <= 36_000,
  `Too many triangles: ${stats.triangleCount}`
);

// --- The material split fire_double_staff.svg asks for ------------------
//
// Prop identity lives in the TUBE. Anodized aluminium is the part these staffs
// are actually sold in colours of, and it is the part a performer sees spinning.
// Kevlar is never blue or red, so the wick is preserved, and so is the gold
// thumb band -- a band that took the hand colour would stop marking anything.
//
// prop-model-recolor.ts implements the split by looking for "Recolor" in a
// material name, and -- load-bearing -- once ANY material carries the marker it
// leaves every unmarked material alone. Drop the marker and the whole staff,
// wicks included, goes flat blue or red.
const recolorable = materials.filter((item) => item.name.includes("Recolor"));
invariant(
  recolorable.length === 1,
  `Exactly one material may carry the recolor marker, found ${recolorable.length}`
);
invariant(
  recolorable[0].name === "TKA_FireStaff_Tube_Recolor",
  `Unexpected recolorable material: ${recolorable[0].name}`
);
for (const name of ["TKA_FireStaff_Wick", "TKA_FireStaff_ThumbBand"]) {
  invariant(materialNames.has(name), `Material is missing: ${name}`);
}
invariant(
  materialNames.size === 3,
  `Unexpected material set: ${[...materialNames].join(", ")}`
);

const baseColor = (name) =>
  materials.find((item) => item.name === name).pbrMetallicRoughness
    .baseColorFactor;

// The tube is the one NEUTRAL material: recolorPropModel replaces its colour
// outright, so a tint here would fight the prop colour instead of taking it. A
// drifting authored colour is the quiet way this breaks.
const tubeColor = baseColor("TKA_FireStaff_Tube_Recolor");
invariant(
  Math.abs(tubeColor[0] - tubeColor[1]) < 0.001 &&
    Math.abs(tubeColor[1] - tubeColor[2]) < 0.001,
  `The tube material must be neutral so it reads as the prop colour: ${tubeColor}`
);

// The wick is preserved, so whatever is authored here is what ships on both
// hands. Kevlar is warm and unsaturated; a grey wick reads as steel wool and a
// saturated one reads as a toy.
for (const name of ["TKA_FireStaff_Wick", "TKA_FireStaff_ThumbBand"]) {
  const color = baseColor(name);
  invariant(
    color[0] > color[1] && color[1] > color[2],
    `${name} must stay warm kevlar, not neutral or cool: ${color}`
  );
}

// --- Size --------------------------------------------------------------
near(
  stats.dimensions.y,
  AUTHORED_LENGTH_M,
  "Overall length must match the 35.5in model"
);
near(
  stats.maximum.y,
  HALF_LENGTH_M,
  "The wick closes where the spec sheet ends the staff"
);
near(
  stats.minimum.y,
  -HALF_LENGTH_M,
  "The staff is bilateral: both wicks close at the same distance"
);
nearReal(stats.dimensions.x, KNOT_OD_M, "Widest section is the wick");
nearReal(
  stats.dimensions.z,
  stats.dimensions.x,
  "The wick is a ball and must measure the same on both perpendicular axes"
);

const rootNode = nodes[nodeIndexByName.get("TKA_FireDoubleStaff")];
invariant(
  rootNode.extras?.tka_prop_type === "fire_double_staff",
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
  rootNode.extras?.recolor_material === "TKA_FireStaff_Tube_Recolor",
  "Root recolor metadata does not name the marked material"
);

// The flame sits ON the wick, not off its far face. An emitter that tracked the
// mesh end would throw fire from a point 37mm past the burning part.
near(
  rootNode.extras?.tracked_tip_y ?? 0,
  TRACKED_TIP_M,
  "Tracked tip must sit at the wick's centre"
);
invariant(
  STATIONS.tracked_tip_mm > (HALF_LENGTH_M - KNOT_LENGTH_M) * 1000 &&
    STATIONS.tracked_tip_mm < STATIONS.half_length_mm,
  "Tracked tip must sit inside the wick, where the fuel is"
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
const bounds = (name) => {
  const found = stats.meshBounds.get(name);
  invariant(found, `No measured bounds for ${name}`);
  return found;
};
const metal = bounds("TKA_FireStaff_Metal");
const wicks = bounds("TKA_FireStaff_Wicks");

invariant(
  wicks.minimum.y < 0 && wicks.maximum.y > 0,
  "The wicks must be a symmetric pair, one per end"
);
near(
  wicks.maximum.y,
  HALF_LENGTH_M,
  "The wick is what closes the end of the staff"
);
invariant(
  wicks.maximum.y > metal.maximum.y,
  "The wick must stand past the ferrule, not sit inside it"
);
// The tube runs on INSIDE the wick, which is what the wick is bolted to. A tube
// that stops at the mouth leaves the knot floating on nothing.
invariant(
  metal.maximum.y > KNOT_MOUTH_M,
  "The tube must run into the wick, not stop at its mouth"
);
// A wick that reached over the grip would be a burn. The bounds of the wick
// PAIR straddle the pivot, so this is the station that has to hold, not a mesh
// extent: the mouth of the wick sits well outboard of where the hand ends.
invariant(
  KNOT_MOUTH_M > GRIP_HALF_M + 0.05,
  `The wick must clear the grip by a clear margin: mouth at ` +
    `${(KNOT_MOUTH_M * 1000).toFixed(0)}mm, grip ends at ` +
    `${(GRIP_HALF_M * 1000).toFixed(0)}mm`
);

// --- Against the physical prop -------------------------------------------
//
// Everything above checks the model against the DRAWING. These check it against
// the object, which is the pair of assertions the capsule baton's first build
// passed and failed respectively: it matched its artwork perfectly while being
// twice the real prop at every station.
// The widest metal is the thumb band riding on the overgrip. Everything metal
// stays close to the tube: a fitting that approached the wick would read as a
// second knot and break the staff's silhouette.
nearReal(
  metal.maximum.x * 2,
  GRIP_OD_M * 1.10,
  "The thumb band is the widest metal, and it is tape on a grip"
);
invariant(
  metal.maximum.x * 2 < KNOT_OD_M * 0.5,
  `No metal fitting may rival the wick: ${(metal.maximum.x * 2000).toFixed(1)}mm`
);
nearReal(
  wicks.maximum.x - wicks.minimum.x,
  KNOT_OD_M,
  "Wick is a 54mm kevlar monkey fist"
);

// The wick keeps the object's own aspect: 74mm long across 54mm wide. Applying
// the drawing's cross exaggeration to width only would inverted this to 0.9 and
// the wick would read as a bead, which is exactly how it went wrong in 2D.
const knotAspect = KNOT_LENGTH_M / KNOT_OD_M;
invariant(
  knotAspect > 1.25 && knotAspect < 1.5,
  `Wick must stay longer than it is wide: ${knotAspect.toFixed(2)}`
);
// The step from tube to wick is the entire silhouette of a fire staff. A wick
// that only just clears its tube reads as a bulge, not as a knot.
const wickStep = (wicks.maximum.x - wicks.minimum.x) / TUBE_OD_M;
invariant(
  wickStep > 3.0,
  `Wick must step visibly out from its tube: ${wickStep.toFixed(2)}x`
);
// The grip covers the middle and the tube runs bare to each wick. A grip that
// reached the ends would be a contact staff, and a grip too short to hold both
// hands is not a double staff at all.
const gripFraction = GRIP_HALF_M / HALF_LENGTH_M;
invariant(
  gripFraction > 0.4 && gripFraction < 0.55,
  `Grip must cover the middle of the staff, not the ends: ${gripFraction.toFixed(2)}`
);
invariant(
  GRIP_OD_M > TUBE_OD_M && GRIP_OD_M < TUBE_OD_M * 1.4,
  "Overgrip stands proud of the tube without turning it into a handle"
);

// --- The shipped registry -----------------------------------------------
const { resolvePropModel } = loadShippedRegistry(REPO_ROOT);
const resolved = resolvePropModel("FIRE_DOUBLE_STAFF");
invariant(
  resolved,
  "FIRE_DOUBLE_STAFF is not registered; it would fall back to the staff model"
);
invariant(
  resolved.entry.modelUrl.endsWith("fire-double-staff.glb"),
  `FIRE_DOUBLE_STAFF resolves to the wrong model: ${resolved.entry.modelUrl}`
);
invariant(
  resolved.scale === 1 && resolved.entry.gripOffsetY === 0,
  "fire-double-staff.glb is authored at its shipped size and grip"
);
invariant(
  resolved.entry.flipLongAxis !== true,
  "The staff is bilateral; flipping it would change nothing but the winding"
);

const inches = (metres) => `${(metres * 39.3701).toFixed(2)}in`;
console.log(`fire-double-staff.glb: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(
  `  ${stats.dimensions.x.toFixed(4)} x ${stats.dimensions.y.toFixed(4)} x ` +
    `${stats.dimensions.z.toFixed(4)} m, ${stats.triangleCount} triangles`
);
console.log(
  `  length ${inches(stats.dimensions.y)}` +
    `, tube dia ${STATIONS.tube_od_mm}mm` +
    `, grip dia ${STATIONS.grip_od_mm}mm` +
    `, wick ${STATIONS.knot_od_mm}x${STATIONS.knot_length_mm}mm`
);
console.log(
  `  hand at the middle: ${inches(stats.maximum.y)} to each wick, ` +
    `tracked flame at ${inches(rootNode.extras.tracked_tip_y)}`
);
console.log("  materials: recolorable tube + preserved kevlar wick and thumb band");
console.log("OK");
