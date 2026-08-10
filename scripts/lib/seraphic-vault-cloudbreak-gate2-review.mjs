import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";


const REVISION = "olive-cloudbreak-r2";
const REVISION_SUFFIX = "r2";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlbJson(buffer) {
  invariant(buffer.readUInt32LE(0) === 0x46546c67, "Graybox GLB has invalid magic");
  invariant(buffer.readUInt32LE(4) === 2, "Graybox GLB must use glTF 2.0");
  invariant(buffer.readUInt32LE(8) === buffer.length, "Graybox GLB length is invalid");
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function generateOliveCloudbreakGate2Review({ root }) {
  const specDirectory = path.resolve(
    root,
    "docs/superpowers/specs/seraphic-vault"
  );
  const baseName = `seraphic-vault-gate2-cloudbreak-${REVISION_SUFFIX}`;
  const paths = {
    coordinate: path.join(specDirectory, `${baseName}-coordinate-manifest.json`),
    verification: path.join(specDirectory, `${baseName}-verification.json`),
    desktop: path.join(specDirectory, `${baseName}-desktop.png`),
    portrait: path.join(specDirectory, `${baseName}-portrait.png`),
    landscapePhone: path.join(specDirectory, `${baseName}-landscape-phone.png`),
    overview: path.join(specDirectory, `${baseName}-overview.png`),
    profile: path.join(specDirectory, `${baseName}-profile.png`),
    blend: path.resolve(root, `blender/olive_cloudbreak_graybox_${REVISION_SUFFIX}.blend`),
    glb: path.resolve(
      root,
      `static/models/celestial/review/olive-cloudbreak-graybox-${REVISION_SUFFIX}.glb`
    ),
    contactSheet: path.join(specDirectory, `${baseName}-contact-sheet.png`),
    report: path.join(specDirectory, `${baseName}-report.json`),
  };

  const [
    coordinateBuffer,
    verificationBuffer,
    desktopBuffer,
    portraitBuffer,
    landscapePhoneBuffer,
    overviewBuffer,
    profileBuffer,
    blendBuffer,
    glbBuffer,
  ] = await Promise.all([
    readFile(paths.coordinate),
    readFile(paths.verification),
    readFile(paths.desktop),
    readFile(paths.portrait),
    readFile(paths.landscapePhone),
    readFile(paths.overview),
    readFile(paths.profile),
    readFile(paths.blend),
    readFile(paths.glb),
  ]);

  const coordinate = JSON.parse(coordinateBuffer.toString("utf8"));
  const verification = JSON.parse(verificationBuffer.toString("utf8"));
  invariant(coordinate.revision === REVISION, "Coordinate revision does not match Gate 2");
  invariant(verification.revision === REVISION, "Verification revision does not match Gate 2");
  invariant(
    coordinate.checks.every((check) => check.passed),
    "Coordinate manifest contains a failed check"
  );
  invariant(
    Object.values(verification.checks).every((check) => check.passed),
    "Blender verification contains a failed check"
  );

  const gltf = readGlbJson(glbBuffer);
  const roleCounts = {};
  const elementIds = new Set();
  for (const node of gltf.nodes ?? []) {
    const role = node.extras?.tka_role;
    const element = node.extras?.tka_element;
    if (role) roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    if (element) elementIds.add(element);
  }
  const glbChecks = {
    sceneCount: gltf.scenes?.length ?? 0,
    cameraCount: gltf.cameras?.length ?? 0,
    gate2MeshNodes: (gltf.nodes ?? []).filter(
      (node) => Number(node.extras?.tka_gate) === 2 && Number.isInteger(node.mesh)
    ).length,
    roleCounts,
    elementIds: [...elementIds].sort(),
  };
  invariant(glbChecks.sceneCount === 1, "Graybox GLB must contain one scene");
  invariant(glbChecks.cameraCount === 0, "Registered cameras leaked into the review GLB");
  invariant(glbChecks.roleCounts["graybox-landmass"] === 1, "Graybox GLB lost the landmass");
  invariant(
    glbChecks.roleCounts["graybox-performance-zone"] === 1,
    "Graybox GLB lost the performance terrace"
  );
  invariant(glbChecks.roleCounts["graybox-lagoon"] === 1, "Graybox GLB lost the lagoon");
  invariant(glbChecks.roleCounts["graybox-olive-trunk"] === 2, "Graybox GLB lost an olive tree");
  invariant(glbChecks.roleCounts["graybox-distant-mesa"] === 4, "Graybox GLB lost a mesa");
  invariant(glbChecks.roleCounts["graybox-far-sun"] === 1, "Graybox GLB lost the far sun");
  invariant(glbChecks.gate2MeshNodes >= 22, "Graybox GLB lost spatial proof geometry");

  const canvas = sharp({
    create: {
      width: 2560,
      height: 1440,
      channels: 4,
      background: "#102033",
    },
  });
  const panel = async (buffer, width, height) =>
    sharp(buffer)
      .resize(width, height, { fit: "contain", background: "#15283a" })
      .png()
      .toBuffer();
  const panels = {
    desktop: { left: 40, top: 122, width: 1460, height: 821 },
    portrait: { left: 1540, top: 122, width: 420, height: 747 },
    landscapePhone: { left: 2000, top: 122, width: 520, height: 223 },
    overview: { left: 2000, top: 390, width: 520, height: 293 },
    profile: { left: 2000, top: 728, width: 520, height: 293 },
  };
  const images = await Promise.all([
    panel(desktopBuffer, panels.desktop.width, panels.desktop.height),
    panel(portraitBuffer, panels.portrait.width, panels.portrait.height),
    panel(
      landscapePhoneBuffer,
      panels.landscapePhone.width,
      panels.landscapePhone.height
    ),
    panel(overviewBuffer, panels.overview.width, panels.overview.height),
    panel(profileBuffer, panels.profile.width, panels.profile.height),
  ]);

  const point = (panelDefinition, [x, y]) => [
    panelDefinition.left + ((x + 1) / 2) * panelDefinition.width,
    panelDefinition.top + ((1 - y) / 2) * panelDefinition.height,
  ];
  const desktopProjection = coordinate.cameraPresets.desktop.projections;
  const highMesaIndex = coordinate.distantMesas.findIndex(
    (mesa) => mesa.id === "high-olive"
  );
  const callouts = [
    [point(panels.desktop, desktopProjection.stage), "1", "DRY PERFORMANCE TERRACE"],
    [point(panels.desktop, desktopProjection.lagoon), "2", "ONE RIGHT-EDGE LAGOON"],
    [point(panels.desktop, desktopProjection.sun), "3", "FAR SUN"],
    [
      point(panels.desktop, desktopProjection.mesas[highMesaIndex]),
      "4",
      "HIGH OLIVE MESA",
    ],
  ];
  const calloutSvg = callouts
    .map(
      ([[x, y], number, label]) =>
        `<g><circle cx="${x}" cy="${y}" r="16" fill="#ffd99b" stroke="#102033" stroke-width="3"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="number">${number}</text><text x="${x + 22}" y="${y + 5}" class="callout">${escapeXml(label)}</text></g>`
    )
    .join("");
  const border = (definition) =>
    `<rect x="${definition.left}" y="${definition.top}" width="${definition.width}" height="${definition.height}" fill="none" stroke="#7194aa" stroke-width="2"/>`;

  const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">
  <style>
    text { font-family: Arial, sans-serif; fill: #f5f0df; }
    .title { font-size: 38px; font-weight: 700; letter-spacing: 1.1px; }
    .subtitle { font-size: 18px; fill: #b7cad6; }
    .label { font-size: 15px; font-weight: 700; fill: #ffd99b; letter-spacing: .7px; }
    .callout { font-size: 15px; font-weight: 700; paint-order: stroke; stroke: #102033; stroke-width: 5px; }
    .number { font-size: 14px; font-weight: 800; fill: #183047; }
    .route-title { font-size: 16px; font-weight: 700; fill: #fff2d3; }
    .route-body { font-size: 14px; fill: #a9c0ce; }
    .check { font-size: 15px; font-weight: 700; fill: #b7e4bd; }
  </style>
  <text x="40" y="52" class="title">OLIVE CLOUDBREAK · GATE 2 · PLAYABLE GRAYBOX</text>
  <text x="40" y="84" class="subtitle">One continuous landmass, a dry center, one lagoon, two olives, four natural mesas, and one far sun.</text>
  <text x="1500" y="111" text-anchor="end" class="label">DESKTOP · 16:9 · 48°</text>
  <text x="1960" y="111" text-anchor="end" class="label">PORTRAIT · 375×667 · 64°</text>
  <text x="2520" y="111" text-anchor="end" class="label">LANDSCAPE PHONE · 960×412 · 46°</text>
  <text x="2520" y="379" text-anchor="end" class="label">OVERVIEW · CONTINUOUS LIMESTONE SHELF</text>
  <text x="2520" y="717" text-anchor="end" class="label">PROFILE · HEIGHT AND SUN DEPTH</text>
  ${Object.values(panels).map(border).join("")}
  ${calloutSvg}
  <line x1="40" y1="1064" x2="2520" y2="1064" stroke="#45667a"/>
  <text x="40" y="1104" class="route-title">1 · GROUNDING</text>
  <text x="40" y="1132" class="route-body">The shelf extends beyond the camera frame.</text>
  <text x="520" y="1104" class="route-title">2 · OPEN STAGE</text>
  <text x="520" y="1132" class="route-body">The performer owns the dry center.</text>
  <text x="1000" y="1104" class="route-title">3 · ONE LAGOON</text>
  <text x="1000" y="1132" class="route-body">Water stays at the outer right edge.</text>
  <text x="1480" y="1104" class="route-title">4 · DEEP SKY</text>
  <text x="1480" y="1132" class="route-body">Mesas step upward without touching the sun.</text>
  <text x="2040" y="1104" class="route-title">5 · WHOLE COMPOSITION</text>
  <text x="2040" y="1132" class="route-body">Every element reads as one celestial location.</text>
  <rect x="40" y="1180" width="2480" height="104" rx="14" fill="#173049" stroke="#45667a"/>
  <text x="68" y="1222" class="check">✓ COORDINATE PARITY</text>
  <text x="390" y="1222" class="check">✓ DRY-CENTER COLLISION</text>
  <text x="780" y="1222" class="check">✓ CAMERA COMPOSITION</text>
  <text x="1160" y="1222" class="check">✓ SUN CLEAR OF MESAS</text>
  <text x="1515" y="1222" class="check">✓ OLIVES CLEAR HERO BAND</text>
  <text x="68" y="1260" class="subtitle">Graybox review: scale, spatial continuity, elevations, silhouettes, and camera framing. Materials and atmosphere belong to Gate 3.</text>
  <text x="40" y="1360" class="subtitle">Revision 2 moves only the high olive mesa laterally. The approved shelf, terrace, lagoon, trees, remaining mesas, and sun depth are unchanged.</text>
</svg>`);

  await canvas
    .composite([
      { input: images[0], left: panels.desktop.left, top: panels.desktop.top },
      { input: images[1], left: panels.portrait.left, top: panels.portrait.top },
      {
        input: images[2],
        left: panels.landscapePhone.left,
        top: panels.landscapePhone.top,
      },
      { input: images[3], left: panels.overview.left, top: panels.overview.top },
      { input: images[4], left: panels.profile.left, top: panels.profile.top },
      { input: overlay, left: 0, top: 0 },
    ])
    .png()
    .toFile(paths.contactSheet);

  const contactSheetBuffer = await readFile(paths.contactSheet);
  const artifactBuffers = {
    [path.relative(root, paths.blend).replaceAll("\\", "/")]: blendBuffer,
    [path.relative(root, paths.coordinate).replaceAll("\\", "/")]: coordinateBuffer,
    [path.relative(root, paths.glb).replaceAll("\\", "/")]: glbBuffer,
    [path.relative(root, paths.desktop).replaceAll("\\", "/")]: desktopBuffer,
    [path.relative(root, paths.portrait).replaceAll("\\", "/")]: portraitBuffer,
    [path.relative(root, paths.landscapePhone).replaceAll("\\", "/")]: landscapePhoneBuffer,
    [path.relative(root, paths.overview).replaceAll("\\", "/")]: overviewBuffer,
    [path.relative(root, paths.profile).replaceAll("\\", "/")]: profileBuffer,
    [path.relative(root, paths.verification).replaceAll("\\", "/")]: verificationBuffer,
    [path.relative(root, paths.contactSheet).replaceAll("\\", "/")]: contactSheetBuffer,
  };
  const artifactDigests = Object.fromEntries(
    Object.entries(artifactBuffers).map(([artifactPath, buffer]) => [
      artifactPath,
      { bytes: buffer.length, sha256: sha256(buffer) },
    ])
  );
  const report = {
    generatedAt: new Date().toISOString(),
    sceneId: "seraphic-vault",
    gateId: "playable-graybox",
    revision: REVISION,
    sourceGateApproval: "QhANUCIS6yZH6RaAMz5Z",
    artifacts: artifactDigests,
    glb: glbChecks,
    checks: [
      { name: "artifact-digest", passed: true, evidence: artifactDigests },
      {
        name: "collision",
        passed: verification.checks.collision.passed,
        evidence: verification.checks.collision.evidence,
      },
      {
        name: "coordinate-parity",
        passed: verification.checks["coordinate-parity"].passed,
        evidence: verification.checks["coordinate-parity"].evidence,
      },
      {
        name: "registered-camera-layout",
        passed: verification.checks["registered-camera-layout"].passed,
        evidence: verification.checks["registered-camera-layout"].evidence,
      },
      {
        name: "solar-silhouette-clearance",
        passed: verification.checks["solar-silhouette-clearance"].passed,
        evidence: verification.checks["solar-silhouette-clearance"].evidence,
      },
      {
        name: "hero-band-clearance",
        passed: verification.checks["hero-band-clearance"].passed,
        evidence: verification.checks["hero-band-clearance"].evidence,
      },
      {
        name: "review-glb-structure",
        passed: true,
        evidence: glbChecks,
      },
    ],
    fixedCameraAdaptation: {
      firstPersonWalk: "Exempt. Celestial is a fixed-camera performance background.",
      routeDuration: "Exempt. The reviewed route is an attention sequence, not locomotion.",
      sequenceParity: "Exempt. This environment carries no selected museum performance sequence.",
    },
  };
  invariant(report.checks.every((check) => check.passed), "Gate 2 report contains a failed check");
  await writeFile(paths.report, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify(
      {
        contactSheet: paths.contactSheet,
        report: paths.report,
        checks: report.checks.map(({ name, passed }) => ({ name, passed })),
      },
      null,
      2
    )}\n`
  );
}
