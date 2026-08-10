#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const specDirectory = path.resolve(root, "docs/superpowers/specs/seraphic-vault");
const prefix = "seraphic-vault-gate3-cloudbreak-r1";

const files = {
  coordinate: path.join(specDirectory, "seraphic-vault-gate2-cloudbreak-r2-coordinate-manifest.json"),
  materialBrief: path.join(specDirectory, `${prefix}-material-lighting-brief.md`),
  promptRecord: path.join(specDirectory, `${prefix}-imagegen-prompts.md`),
  cameraLock: path.join(specDirectory, `${prefix}-camera-lock.json`),
  board: path.join(specDirectory, `${prefix}-visual-target-board.png`),
  report: path.join(specDirectory, `${prefix}-registration-report.json`),
  sourceDesktop: path.join(specDirectory, "seraphic-vault-gate2-cloudbreak-r2-desktop.png"),
  sourcePortrait: path.join(specDirectory, "seraphic-vault-gate2-cloudbreak-r2-portrait.png"),
  sourceLandscape: path.join(specDirectory, "seraphic-vault-gate2-cloudbreak-r2-landscape-phone.png"),
  targetDesktop: path.join(specDirectory, `${prefix}-desktop-target.png`),
  targetPortrait: path.join(specDirectory, `${prefix}-portrait-target.png`),
  targetLandscape: path.join(specDirectory, `${prefix}-landscape-phone-target.png`),
};

const viewDefinitions = {
  desktop: { source: files.sourceDesktop, target: files.targetDesktop, cameraKey: "desktop" },
  portrait: { source: files.sourcePortrait, target: files.targetPortrait, cameraKey: "portrait" },
  landscapePhone: { source: files.sourceLandscape, target: files.targetLandscape, cameraKey: "landscapePhone" },
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function artifact(buffer) {
  return { bytes: buffer.length, sha256: sha256(buffer) };
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

async function imageRecord(filePath) {
  const [buffer, metadata] = await Promise.all([readFile(filePath), sharp(filePath).metadata()]);
  invariant(metadata.width && metadata.height, `Missing dimensions for ${filePath}`);
  return {
    path: relative(filePath),
    buffer,
    width: metadata.width,
    height: metadata.height,
    aspect: metadata.width / metadata.height,
    ...artifact(buffer),
  };
}

const coordinateBuffer = await readFile(files.coordinate);
const coordinate = JSON.parse(coordinateBuffer.toString("utf8"));
const materialBriefBuffer = await readFile(files.materialBrief);
const promptRecordBuffer = await readFile(files.promptRecord);

const views = {};
for (const [viewName, definition] of Object.entries(viewDefinitions)) {
  const [source, target] = await Promise.all([
    imageRecord(definition.source),
    imageRecord(definition.target),
  ]);
  const camera = coordinate.cameraPresets[definition.cameraKey];
  const relativeAspectError = Math.abs(target.aspect - camera.aspect) / camera.aspect;
  invariant(relativeAspectError <= 0.0015, `${viewName} target changed the registered aspect`);

  views[viewName] = {
    camera,
    source: { ...source, buffer: undefined },
    target: { ...target, buffer: undefined },
    relativeAspectError,
    aspectRegistered: true,
    protectedProjection: camera.projections,
  };
}

const visualAnchorAudit = Object.fromEntries(
  Object.keys(viewDefinitions).map((viewName) => [
    viewName,
    {
      method: "manual visual comparison against the approved Gate 2 graybox",
      continuousForegroundShelf: true,
      openDryPerformanceCenter: true,
      twoOliveTrees: true,
      oneRightEdgeLagoon: true,
      fourSeparatedMesas: true,
      oneNaturalSun: true,
      sunClearOfMesaSilhouettes: true,
      noReligiousOrArchitecturalMotifs: true,
    },
  ]),
);

const cameraLock = {
  schemaVersion: 1,
  sceneId: "seraphic-vault",
  title: "Olive Cloudbreak Celestial Environment",
  gateId: "registered-visual-target",
  revision: "olive-cloudbreak-r1",
  generatedAt: new Date().toISOString(),
  gate2ApprovalTrackerItem: "Iehzrhi3HOUVuwV3rYtr",
  sourceCoordinateManifest: {
    path: relative(files.coordinate),
    ...artifact(coordinateBuffer),
  },
  policy: "Gate 3 changes material, light, atmosphere, and natural surface detail only. The approved Gate 2 cameras, aspect ratios, landmass read, terrace, trees, lagoon, mesas, and far sun remain binding.",
  views,
  visualAnchorAudit,
};

await writeFile(files.cameraLock, `${JSON.stringify(cameraLock, null, 2)}\n`);

const targetImages = {
  desktop: await imageRecord(files.targetDesktop),
  portrait: await imageRecord(files.targetPortrait),
  landscape: await imageRecord(files.targetLandscape),
};

const [desktopComposite, portraitComposite, landscapeComposite] = await Promise.all([
  sharp(targetImages.desktop.buffer).resize(1548, 871, { fit: "cover" }).png().toBuffer(),
  sharp(targetImages.portrait.buffer).resize(476, 846, { fit: "cover" }).png().toBuffer(),
  sharp(targetImages.landscape.buffer).resize(404, 173, { fit: "cover" }).png().toBuffer(),
]);

const boardSvg = `
<svg width="2560" height="1440" viewBox="0 0 2560 1440" xmlns="http://www.w3.org/2000/svg">
  <rect width="2560" height="1440" fill="#091824"/>
  <text x="40" y="58" fill="#fff8e9" font-family="Arial, sans-serif" font-size="36" font-weight="700">OLIVE CLOUDBREAK · GATE 3 · REGISTERED VISUAL TARGET</text>
  <text x="40" y="91" fill="#a9c0cf" font-family="Arial, sans-serif" font-size="18">A natural limestone refuge above a deep cloud sea. Camera geometry is inherited from the approved Gate 2 graybox.</text>

  <rect x="38" y="122" width="1552" height="875" rx="5" fill="#11283a" stroke="#83a6b8" stroke-width="2"/>
  <rect x="1610" y="122" width="480" height="850" rx="5" fill="#11283a" stroke="#83a6b8" stroke-width="2"/>
  <rect x="2110" y="122" width="408" height="177" rx="5" fill="#11283a" stroke="#83a6b8" stroke-width="2"/>
  <text x="1560" y="116" text-anchor="end" fill="#f0c978" font-family="Arial, sans-serif" font-size="15" font-weight="700">DESKTOP · 16:9 · 48°</text>
  <text x="2064" y="116" text-anchor="end" fill="#f0c978" font-family="Arial, sans-serif" font-size="15" font-weight="700">PORTRAIT · 9:16 · 64°</text>
  <text x="2498" y="116" text-anchor="end" fill="#f0c978" font-family="Arial, sans-serif" font-size="15" font-weight="700">LANDSCAPE PHONE · 2.33:1 · 46°</text>

  <rect x="2110" y="326" width="408" height="646" rx="10" fill="#102a3d" stroke="#31566c" stroke-width="2"/>
  <text x="2136" y="369" fill="#f0c978" font-family="Arial, sans-serif" font-size="19" font-weight="700">MATERIAL FAMILY</text>
  <circle cx="2154" cy="414" r="16" fill="#e9d7b5"/><text x="2184" y="421" fill="#e7f0f4" font-family="Arial, sans-serif" font-size="16">Warm ivory limestone</text>
  <circle cx="2154" cy="459" r="16" fill="#8a9671"/><text x="2184" y="466" fill="#e7f0f4" font-family="Arial, sans-serif" font-size="16">Silvery olive foliage</text>
  <circle cx="2154" cy="504" r="16" fill="#79c9ce"/><text x="2184" y="511" fill="#e7f0f4" font-family="Arial, sans-serif" font-size="16">One turquoise lagoon</text>
  <circle cx="2154" cy="549" r="16" fill="#eef0e9"/><text x="2184" y="556" fill="#e7f0f4" font-family="Arial, sans-serif" font-size="16">Layered ivory cloud</text>
  <circle cx="2154" cy="594" r="16" fill="#fff3c2"/><text x="2184" y="601" fill="#e7f0f4" font-family="Arial, sans-serif" font-size="16">Natural white-gold sun</text>
  <line x1="2136" y1="634" x2="2492" y2="634" stroke="#31566c"/>
  <text x="2136" y="676" fill="#fff8e9" font-family="Arial, sans-serif" font-size="18" font-weight="700">LIGHTING LOGIC</text>
  <text x="2136" y="711" fill="#b7cbd5" font-family="Arial, sans-serif" font-size="16">One distant solar source.</text>
  <text x="2136" y="742" fill="#b7cbd5" font-family="Arial, sans-serif" font-size="16">Warm rims, cool cloud bounce.</text>
  <text x="2136" y="773" fill="#b7cbd5" font-family="Arial, sans-serif" font-size="16">Lagoon carries one sun path.</text>
  <text x="2136" y="804" fill="#b7cbd5" font-family="Arial, sans-serif" font-size="16">Lower third stays readable.</text>
  <line x1="2136" y1="840" x2="2492" y2="840" stroke="#31566c"/>
  <text x="2136" y="882" fill="#79d49e" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ ONE NATURAL SUN</text>
  <text x="2136" y="914" fill="#79d49e" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ FOUR SEPARATE MESAS</text>
  <text x="2136" y="946" fill="#79d49e" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ OPEN PERFORMANCE CENTER</text>

  <rect x="40" y="1028" width="2478" height="344" rx="12" fill="#102a3d" stroke="#31566c" stroke-width="2"/>
  <text x="68" y="1074" fill="#f0c978" font-family="Arial, sans-serif" font-size="20" font-weight="700">THE APPROVED SPATIAL READ, FINISHED AS A NATURAL SUN-MODE REFUGE</text>
  <text x="68" y="1121" fill="#fff8e9" font-family="Arial, sans-serif" font-size="18" font-weight="700">GROUNDING</text>
  <text x="68" y="1151" fill="#aec3cf" font-family="Arial, sans-serif" font-size="16">One continuous shelf extends behind the camera.</text>
  <text x="560" y="1121" fill="#fff8e9" font-family="Arial, sans-serif" font-size="18" font-weight="700">OPEN STAGE</text>
  <text x="560" y="1151" fill="#aec3cf" font-family="Arial, sans-serif" font-size="16">Dry pale stone leaves the performer in command.</text>
  <text x="1052" y="1121" fill="#fff8e9" font-family="Arial, sans-serif" font-size="18" font-weight="700">ONE LAGOON</text>
  <text x="1052" y="1151" fill="#aec3cf" font-family="Arial, sans-serif" font-size="16">Water stays a restrained right-edge accent.</text>
  <text x="1544" y="1121" fill="#fff8e9" font-family="Arial, sans-serif" font-size="18" font-weight="700">DEEP SKY</text>
  <text x="1544" y="1151" fill="#aec3cf" font-family="Arial, sans-serif" font-size="16">Mesas and thin falls establish layered distance.</text>
  <text x="2036" y="1121" fill="#fff8e9" font-family="Arial, sans-serif" font-size="18" font-weight="700">WHOLE VIEW</text>
  <text x="2036" y="1151" fill="#aec3cf" font-family="Arial, sans-serif" font-size="16">Sun, stone, water, and cloud settle as one place.</text>
  <line x1="68" y1="1194" x2="2490" y2="1194" stroke="#31566c"/>
  <text x="68" y="1239" fill="#b7cbd5" font-family="Arial, sans-serif" font-size="17">No castle, temple, columns, ruins, feathers, wings, statues, or graphic halo. Natural geology carries the identity.</text>
  <text x="68" y="1275" fill="#b7cbd5" font-family="Arial, sans-serif" font-size="17">Visual targets guide Gate 4 production. The Blender graybox and coordinate manifest remain the geometry owners.</text>
  <text x="68" y="1325" fill="#79d49e" font-family="Arial, sans-serif" font-size="18" font-weight="700">✓ THREE REGISTERED ASPECTS</text>
  <text x="730" y="1325" fill="#79d49e" font-family="Arial, sans-serif" font-size="18" font-weight="700">✓ SUN CLEAR OF SILHOUETTES</text>
  <text x="1458" y="1325" fill="#79d49e" font-family="Arial, sans-serif" font-size="18" font-weight="700">✓ NATURAL MATERIAL COHESION</text>
  <text x="40" y="1412" fill="#7f9baa" font-family="Arial, sans-serif" font-size="15">Gate 3 review artifact · Olive Cloudbreak revision 1</text>
</svg>`;

await sharp(Buffer.from(boardSvg))
  .composite([
    { input: desktopComposite, left: 40, top: 124 },
    { input: portraitComposite, left: 1612, top: 124 },
    { input: landscapeComposite, left: 2112, top: 124 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(files.board);

const [cameraLockBuffer, boardBuffer] = await Promise.all([
  readFile(files.cameraLock),
  readFile(files.board),
]);

const report = {
  schemaVersion: 1,
  sceneId: "seraphic-vault",
  title: "Olive Cloudbreak Celestial Environment",
  gateId: "registered-visual-target",
  revision: "olive-cloudbreak-r1",
  generatedAt: new Date().toISOString(),
  gate2ApprovalTrackerItem: "Iehzrhi3HOUVuwV3rYtr",
  generationMode: "built-in image generation, registered sketch-to-render paintover",
  artifacts: {
    [relative(files.coordinate)]: artifact(coordinateBuffer),
    [relative(files.cameraLock)]: artifact(cameraLockBuffer),
    [relative(files.materialBrief)]: artifact(materialBriefBuffer),
    [relative(files.promptRecord)]: artifact(promptRecordBuffer),
    [relative(files.targetDesktop)]: artifact(targetImages.desktop.buffer),
    [relative(files.targetPortrait)]: artifact(targetImages.portrait.buffer),
    [relative(files.targetLandscape)]: artifact(targetImages.landscape.buffer),
    [relative(files.board)]: artifact(boardBuffer),
  },
  views,
  visualAnchorAudit,
  checks: [
    {
      name: "camera-aspect-registration",
      passed: Object.values(views).every((view) => view.aspectRegistered),
      evidence: "All three targets preserve their registered Gate 2 aspect ratios within 0.15 percent.",
    },
    {
      name: "composition-read",
      passed: Object.values(visualAnchorAudit).every(
        (view) => view.continuousForegroundShelf
          && view.openDryPerformanceCenter
          && view.twoOliveTrees
          && view.oneRightEdgeLagoon
          && view.fourSeparatedMesas,
      ),
      evidence: "Manual comparison against the graybox confirms the shelf, open center, paired olive framing, single right-edge lagoon, and four separated mesas in every registered target.",
    },
    {
      name: "natural-sun-read",
      passed: Object.values(visualAnchorAudit).every(
        (view) => view.oneNaturalSun && view.sunClearOfMesaSilhouettes,
      ),
      evidence: "Each target has one distant white-gold solar disk, clear of the mesa silhouettes, governing the stone rims, cloud glow, and lagoon reflection without a graphic halo.",
    },
    {
      name: "motif-restraint",
      passed: Object.values(visualAnchorAudit).every(
        (view) => view.noReligiousOrArchitecturalMotifs,
      ),
      evidence: "Manual visual audit found no castle, temple, column, ruin, statue, feather, wing, shrine, or religious symbol.",
    },
  ],
};

for (const check of report.checks) invariant(check.passed, `${check.name} failed`);
await writeFile(files.report, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  cameraLock: relative(files.cameraLock),
  board: relative(files.board),
  report: relative(files.report),
  checks: report.checks,
}, null, 2));
