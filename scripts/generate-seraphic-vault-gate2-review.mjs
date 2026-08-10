#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();

if (process.argv.includes("--cloudbreak")) {
  const { generateOliveCloudbreakGate2Review } = await import(
    "./lib/seraphic-vault-cloudbreak-gate2-review.mjs"
  );
  await generateOliveCloudbreakGate2Review({ root });
  process.exit(0);
}

const specDirectory = path.resolve(
  root,
  "docs/superpowers/specs/seraphic-vault"
);
const paths = {
  desktop: path.join(specDirectory, "seraphic-vault-gate2-desktop.png"),
  portrait: path.join(specDirectory, "seraphic-vault-gate2-portrait.png"),
  landscape: path.join(specDirectory, "seraphic-vault-gate2-landscape-phone.png"),
  overview: path.join(specDirectory, "seraphic-vault-gate2-overview.png"),
  profile: path.join(specDirectory, "seraphic-vault-gate2-profile.png"),
  coordinate: path.join(specDirectory, "seraphic-vault-gate2-coordinate-manifest.json"),
  verification: path.join(specDirectory, "seraphic-vault-gate2-verification.json"),
  blend: path.resolve(root, "blender/seraphic_vault_phase2_graybox.blend"),
  glb: path.resolve(
    root,
    "static/models/celestial/review/seraphic-vault-phase2-graybox.glb"
  ),
  contactSheet: path.join(specDirectory, "seraphic-vault-gate2-contact-sheet.png"),
  report: path.join(specDirectory, "seraphic-vault-gate2-report.json"),
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
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

const [
  coordinateBuffer,
  verificationBuffer,
  blendBuffer,
  glbBuffer,
  desktopBuffer,
  portraitBuffer,
  landscapeBuffer,
  overviewBuffer,
  profileBuffer,
] = await Promise.all([
  readFile(paths.coordinate),
  readFile(paths.verification),
  readFile(paths.blend),
  readFile(paths.glb),
  readFile(paths.desktop),
  readFile(paths.portrait),
  readFile(paths.landscape),
  readFile(paths.overview),
  readFile(paths.profile),
]);

const coordinate = JSON.parse(coordinateBuffer.toString("utf8"));
const verification = JSON.parse(verificationBuffer.toString("utf8"));
const gltf = readGlbJson(glbBuffer);
const platformIds = new Set(
  (gltf.nodes ?? [])
    .map((node) => node.extras?.tka_platform)
    .filter(Boolean)
);
const atmosphereGuideIds = new Set(
  (gltf.nodes ?? [])
    .map((node) => node.extras?.tka_atmosphere_guide)
    .filter(Boolean)
);
const solarRoles = Object.groupBy(
  (gltf.nodes ?? []).filter((node) => String(node.extras?.tka_role ?? "").startsWith("graybox-solar-")),
  (node) => node.extras.tka_role
);
const glbChecks = {
  sceneCount: gltf.scenes?.length ?? 0,
  cameraCount: gltf.cameras?.length ?? 0,
  platformIds: [...platformIds].sort(),
  atmosphereGuideIds: [...atmosphereGuideIds].sort(),
  solarNodes: Object.fromEntries(
    Object.entries(solarRoles).map(([role, nodes]) => [role, nodes.length])
  ),
  gate2MeshNodes: (gltf.nodes ?? []).filter(
    (node) => Number(node.extras?.tka_gate) === 2 && Number.isInteger(node.mesh)
  ).length,
};
invariant(glbChecks.sceneCount === 1, "Graybox GLB must contain one scene");
invariant(glbChecks.cameraCount === 0, "Registered cameras leaked into the review GLB");
invariant(glbChecks.platformIds.length === 4, "Graybox GLB lost a platform family");
invariant(glbChecks.atmosphereGuideIds.length === 6, "Graybox GLB lost a cloud-field guide");
invariant(glbChecks.solarNodes["graybox-solar-core"] === 1, "Graybox GLB lost the solar core");
invariant(glbChecks.solarNodes["graybox-solar-aureole"] === 2, "Graybox GLB lost a solar aureole ring");
invariant(glbChecks.solarNodes["graybox-solar-ray"] === 16, "Graybox GLB lost a solar ray");
invariant(glbChecks.gate2MeshNodes >= 20, "Graybox GLB lost primitive silhouette geometry");

const canvas = sharp({
  create: {
    width: 2560,
    height: 1440,
    channels: 4,
    background: "#07182c",
  },
});

async function panel(buffer, width, height) {
  return sharp(buffer)
    .resize(width, height, { fit: "contain", background: "#0b2037" })
    .png()
    .toBuffer();
}

const desktopPanel = { left: 40, top: 118, width: 1500, height: 844 };
const portraitPanel = { left: 1580, top: 118, width: 420, height: 747 };
const landscapePanel = { left: 2040, top: 118, width: 480, height: 206 };
const overviewPanel = { left: 2040, top: 370, width: 480, height: 270 };
const profilePanel = { left: 2040, top: 686, width: 480, height: 270 };

const composites = await Promise.all([
  panel(desktopBuffer, desktopPanel.width, desktopPanel.height),
  panel(portraitBuffer, portraitPanel.width, portraitPanel.height),
  panel(landscapeBuffer, landscapePanel.width, landscapePanel.height),
  panel(overviewBuffer, overviewPanel.width, overviewPanel.height),
  panel(profileBuffer, profilePanel.width, profilePanel.height),
]);

const callout = (x, y, number, label, align = "start") => {
  const labelX = align === "end" ? x - 18 : x + 18;
  return `<g><circle cx="${x}" cy="${y}" r="15" fill="#ffd38a" stroke="#07182c" stroke-width="3"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="number">${number}</text><text x="${labelX}" y="${y + 5}" text-anchor="${align}" class="callout">${label}</text></g>`;
};

const desktopPoint = (ndcX, ndcY) => [
  desktopPanel.left + ((ndcX + 1) / 2) * desktopPanel.width,
  desktopPanel.top + ((1 - ndcY) / 2) * desktopPanel.height,
];
const [brokenX, brokenY] = desktopPoint(-0.77, -0.55);
const [twinX, twinY] = desktopPoint(0.78, -0.34);
const [erodedX, erodedY] = desktopPoint(-0.52, 0.2);
const [crownX, crownY] = desktopPoint(0.52, 0.42);

const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">
  <style>
    text { font-family: Arial, sans-serif; fill: #eef6ff; }
    .title { font-size: 38px; font-weight: 700; letter-spacing: 1.2px; }
    .subtitle { font-size: 18px; fill: #a9c7e1; }
    .label { font-size: 15px; font-weight: 700; fill: #ffd38a; letter-spacing: .7px; }
    .callout { font-size: 16px; font-weight: 700; paint-order: stroke; stroke: #07182c; stroke-width: 5px; }
    .number { font-size: 14px; font-weight: 800; fill: #102947; }
    .body { font-size: 16px; fill: #c8dcef; }
    .check { font-size: 15px; font-weight: 700; fill: #a9e6c2; }
    .platform { font-size: 17px; font-weight: 700; fill: #fff4d7; }
    .detail { font-size: 14px; fill: #9ebbd5; }
  </style>
  <text x="40" y="52" class="title">SERAPHIC VAULT · GATE 2 · ATMOSPHERIC GRAYBOX</text>
  <text x="40" y="83" class="subtitle">Four silhouette families, layered cloud massing, and a solar aureole projected against the real Meshy feather shell.</text>
  <text x="1540" y="108" text-anchor="end" class="label">DESKTOP · 16:9 · 48°</text>
  <text x="2000" y="108" text-anchor="end" class="label">PORTRAIT · 375×667 · 78°</text>
  <text x="2520" y="108" text-anchor="end" class="label">LANDSCAPE PHONE · 960×412 · 32°</text>
  <text x="2520" y="360" text-anchor="end" class="label">TOP VIEW · DESKTOP TRANSFORMS</text>
  <text x="2520" y="676" text-anchor="end" class="label">PROFILE · DESKTOP TRANSFORMS</text>
  <rect x="${desktopPanel.left}" y="${desktopPanel.top}" width="${desktopPanel.width}" height="${desktopPanel.height}" fill="none" stroke="#5d83a9" stroke-width="2"/>
  <rect x="${portraitPanel.left}" y="${portraitPanel.top}" width="${portraitPanel.width}" height="${portraitPanel.height}" fill="none" stroke="#5d83a9" stroke-width="2"/>
  <rect x="${landscapePanel.left}" y="${landscapePanel.top}" width="${landscapePanel.width}" height="${landscapePanel.height}" fill="none" stroke="#5d83a9" stroke-width="2"/>
  <rect x="${overviewPanel.left}" y="${overviewPanel.top}" width="${overviewPanel.width}" height="${overviewPanel.height}" fill="none" stroke="#5d83a9" stroke-width="2"/>
  <rect x="${profilePanel.left}" y="${profilePanel.top}" width="${profilePanel.width}" height="${profilePanel.height}" fill="none" stroke="#5d83a9" stroke-width="2"/>
  ${callout(brokenX, brokenY, 1, "BROKEN VIGIL")}
  ${callout(twinX, twinY, 2, "TWIN CHOIR", "end")}
  ${callout(erodedX, erodedY, 3, "ERODED HALO")}
  ${callout(crownX, crownY, 4, "CLOUD CROWN", "end")}
  <line x1="40" y1="1000" x2="2520" y2="1000" stroke="#345a7d"/>
  <text x="40" y="1040" class="platform">1 · BROKEN VIGIL</text>
  <text x="40" y="1067" class="detail">Near-distance fragment · one broken feather arc · 30% of hero-stage width</text>
  <text x="650" y="1040" class="platform">2 · TWIN CHOIR</text>
  <text x="650" y="1067" class="detail">Middle-distance deck · two spires · 18% of hero-stage width</text>
  <text x="1260" y="1040" class="platform">3 · ERODED HALO</text>
  <text x="1260" y="1067" class="detail">Far ring ruin · narrow solid core with a 10% cloud envelope</text>
  <text x="1910" y="1040" class="platform">4 · CLOUD CROWN</text>
  <text x="1910" y="1067" class="detail">Deep-distance crown · abstract 6% silhouette</text>
  <rect x="40" y="1120" width="2480" height="116" rx="14" fill="#0d2946" stroke="#345a7d"/>
  <text x="68" y="1156" class="label">SPATIAL READ</text>
  <text x="68" y="1187" class="body">The eye begins at the central feather vault, catches the two lower flank platforms, then finds the smaller ring and crown beyond the ribs.</text>
  <text x="68" y="1217" class="body">Responsive transforms preserve that order without letting solid stone cross the hero band or the real feather silhouettes.</text>
  <text x="40" y="1296" class="check">✓ PROJECTION PARITY</text>
  <text x="310" y="1296" class="check">✓ SHELL COLLISION</text>
  <text x="565" y="1296" class="check">✓ REAL FEATHER CLEARANCE</text>
  <text x="885" y="1296" class="check">✓ SIX CLOUD LAYERS</text>
  <text x="1160" y="1296" class="check">✓ SOLAR AUREOLE</text>
  <text x="40" y="1352" class="subtitle">Review only: primitive platform and cloud massing, distance, silhouette, and solar focal read. Materials, sculpting, and the floor design belong to later gates.</text>
</svg>`);

await canvas
  .composite([
    { input: composites[0], left: desktopPanel.left, top: desktopPanel.top },
    { input: composites[1], left: portraitPanel.left, top: portraitPanel.top },
    { input: composites[2], left: landscapePanel.left, top: landscapePanel.top },
    { input: composites[3], left: overviewPanel.left, top: overviewPanel.top },
    { input: composites[4], left: profilePanel.left, top: profilePanel.top },
    { input: overlay, left: 0, top: 0 },
  ])
  .png()
  .toFile(paths.contactSheet);

const contactSheetBuffer = await readFile(paths.contactSheet);
const artifactBuffers = {
  [relative(paths.blend)]: blendBuffer,
  [relative(paths.coordinate)]: coordinateBuffer,
  [relative(paths.glb)]: glbBuffer,
  [relative(paths.desktop)]: desktopBuffer,
  [relative(paths.portrait)]: portraitBuffer,
  [relative(paths.landscape)]: landscapeBuffer,
  [relative(paths.overview)]: overviewBuffer,
  [relative(paths.profile)]: profileBuffer,
  [relative(paths.verification)]: verificationBuffer,
  [relative(paths.contactSheet)]: contactSheetBuffer,
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
  sourceGateApproval: "EiR6GvhtzW1A3OEaZ9Zi",
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
      name: "registered-silhouette-clearance",
      passed: verification.checks["registered-silhouette-clearance"].passed,
      evidence:
        verification.checks["registered-silhouette-clearance"].evidence,
    },
    {
      name: "projection-parity",
      passed: coordinate.checks.find((check) => check.name === "projection-parity")?.passed === true,
      evidence: "Every platform root projects to its registered NDC target within 0.0005 in desktop, portrait, and landscape-phone views.",
    },
    {
      name: "review-glb-structure",
      passed: true,
      evidence: glbChecks,
    },
    {
      name: "atmosphere-structure",
      passed: true,
      evidence: "The review artifact contains six responsive cloud-field guides plus a tagged solar core, two aureole rings, and sixteen ray segments.",
    },
  ],
  fixedCameraAdaptation: {
    firstPersonWalk: "Not applicable. The Celestial scene is a fixed-camera performance background.",
    routeDuration: "Not applicable. The reviewed route is an attention sequence, not locomotion.",
    sequenceParity: "Not applicable. This environment carries no selected museum performance sequence.",
  },
};

invariant(report.checks.every((check) => check.passed), "Gate 2 report contains a failed check");
await writeFile(paths.report, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify({ contactSheet: paths.contactSheet, report: paths.report, checks: report.checks.map(({ name, passed }) => ({ name, passed })) }, null, 2)}\n`
);
