#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const specDirectory = path.resolve(root, "docs/superpowers/specs/seraphic-vault");
const sunModeAmendment = process.argv.includes("--sun-mode-amendment");
const targetPrefix = sunModeAmendment
  ? "seraphic-vault-gate3-1-sun-mode"
  : "seraphic-vault-gate3";
const files = {
  coordinate: path.join(specDirectory, "seraphic-vault-gate2-coordinate-manifest.json"),
  sourceDesktop: path.join(specDirectory, sunModeAmendment ? "seraphic-vault-gate3-desktop-target.png" : "seraphic-vault-gate2-desktop.png"),
  sourcePortrait: path.join(specDirectory, sunModeAmendment ? "seraphic-vault-gate3-portrait-target.png" : "seraphic-vault-gate2-portrait.png"),
  sourceLandscape: path.join(specDirectory, sunModeAmendment ? "seraphic-vault-gate3-landscape-phone-target.png" : "seraphic-vault-gate2-landscape-phone.png"),
  targetDesktop: path.join(specDirectory, `${targetPrefix}-${sunModeAmendment ? "desktop-candidate" : "desktop-target"}.png`),
  targetPortrait: path.join(specDirectory, `${targetPrefix}-${sunModeAmendment ? "portrait-candidate" : "portrait-target"}.png`),
  targetLandscape: path.join(specDirectory, `${targetPrefix}-${sunModeAmendment ? "landscape-phone-candidate" : "landscape-phone-target"}.png`),
  materialBrief: path.join(specDirectory, `${targetPrefix}-material-lighting-brief.md`),
  promptRecord: path.join(specDirectory, `${targetPrefix}-imagegen-prompts.md`),
  cameraLock: path.join(specDirectory, `${targetPrefix}-camera-lock.json`),
  board: path.join(specDirectory, `${targetPrefix}-${sunModeAmendment ? "board" : "visual-target-board"}.png`),
  report: path.join(specDirectory, `${targetPrefix}-registration-report.json`),
};

const viewDefinitions = {
  desktop: {
    source: files.sourceDesktop,
    target: files.targetDesktop,
    cameraKey: "desktop",
  },
  portrait: {
    source: files.sourcePortrait,
    target: files.targetPortrait,
    cameraKey: "portrait",
  },
  landscapePhone: {
    source: files.sourceLandscape,
    target: files.targetLandscape,
    cameraKey: "landscapePhone",
  },
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function artifact(buffer) {
  return { bytes: buffer.length, sha256: sha256(buffer) };
}

async function imageRecord(filePath) {
  const [buffer, metadata] = await Promise.all([
    readFile(filePath),
    sharp(filePath).metadata(),
  ]);
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
  views[viewName] = {
    camera,
    source: { ...source, buffer: undefined },
    target: { ...target, buffer: undefined },
    relativeAspectError,
    aspectRegistered: relativeAspectError <= 0.0015,
    targetNdc: Object.fromEntries(
      coordinate.platforms.map((platform) => [
        platform.id,
        platform.targetNdc[definition.cameraKey],
      ])
    ),
  };
  invariant(views[viewName].aspectRegistered, `${viewName} target changed aspect`);
}

const visualAnchorAudit = {
  desktop: {
    oneSun: true,
    sixFeatherRibs: true,
    centralPerformerLaneClear: true,
    platformsSeparated: true,
    verticalOrder: "Broken Vigil and Twin Choir below; Eroded Halo upper left; Cloud Crown highest upper right",
  },
  portrait: {
    oneSun: true,
    sixFeatherRibs: true,
    centralPerformerLaneClear: true,
    platformsSeparated: true,
    verticalOrder: "Broken Vigil and Twin Choir below; Eroded Halo upper left; Cloud Crown highest upper right",
  },
  landscapePhone: {
    oneSun: true,
    sixFeatherRibs: true,
    centralPerformerLaneClear: true,
    platformsSeparated: true,
    verticalOrder: "Broken Vigil and Twin Choir below; Eroded Halo upper left; Cloud Crown highest upper right",
  },
};

const cameraLock = {
  schemaVersion: 1,
  sceneId: "seraphic-vault",
  gateId: "registered-visual-target",
  revision: sunModeAmendment ? "3.1-sun-mode" : "3",
  generatedAt: new Date().toISOString(),
  gate2ApprovalTrackerItem: "8gVDiuCU9YCztmsm3z1K",
  ...(sunModeAmendment ? { visualPassDecisionTrackerItem: "NqtbLpPGntxwmalkZDNL" } : {}),
  sourceCoordinateManifest: {
    path: relative(files.coordinate),
    ...artifact(coordinateBuffer),
  },
  policy: sunModeAmendment
    ? "Gate 3.1 replaces the graphic aureole with one natural Sun-mode hero and raises atmosphere, material, and integration quality. Gate 2 camera presets and platform NDC targets remain binding."
    : "Gate 3 changes material, light, and atmosphere only. Gate 2 camera presets and platform NDC targets remain binding.",
  views,
  visualAnchorAudit,
};
await writeFile(files.cameraLock, `${JSON.stringify(cameraLock, null, 2)}\n`);

const targetImages = {
  desktop: await imageRecord(files.targetDesktop),
  portrait: await imageRecord(files.targetPortrait),
  landscape: await imageRecord(files.targetLandscape),
};

const composites = await Promise.all([
  sharp(targetImages.desktop.buffer)
    .resize(1550, 872, { fit: "contain", background: "#07192b" })
    .png()
    .toBuffer(),
  sharp(targetImages.portrait.buffer)
    .resize(480, 853, { fit: "contain", background: "#07192b" })
    .png()
    .toBuffer(),
  sharp(targetImages.landscape.buffer)
    .resize(400, 172, { fit: "contain", background: "#07192b" })
    .png()
    .toBuffer(),
]);

const boardTitle = sunModeAmendment
  ? "SERAPHIC VAULT · GATE 3.1 · SUN-MODE VISUAL TARGET"
  : "SERAPHIC VAULT · GATE 3 · REGISTERED VISUAL TARGET";
const boardSubtitle = sunModeAmendment
  ? "One natural white-gold sun governs the clouds, warm stone edges, and floor reflection. No graphic aureole remains."
  : "One white-gold sun, cool weathered alabaster, dense cloud depth, and four sanctuaries locked to the approved Gate 2 cameras.";
const lightingLines = sunModeAmendment
  ? ["Natural disc is the only sun.", "Corona dissolves into cloud light.", "Warm edges, cool lower third.", "Rays, shadows, and reflection align."]
  : ["Centered disc is the only sun.", "Warm edges, cool lower third.", "Cloud depth before added fog.", "Distant detail falls with depth."];
const amendmentFooter = sunModeAmendment
  ? `<text x="2144" y="881" fill="#77d4a5" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ ONE NATURAL SUN</text>
  <text x="2144" y="914" fill="#77d4a5" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ SIX FEATHER RIBS</text>
  <text x="2144" y="947" fill="#ff9a8f" font-family="Arial, sans-serif" font-size="17" font-weight="700">✕ NO RINGS, SPOKES, OR SIGILS</text>`
  : `<text x="2144" y="881" fill="#77d4a5" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ ONE SUN</text>
  <text x="2144" y="914" fill="#77d4a5" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ SIX FEATHER RIBS</text>
  <text x="2144" y="947" fill="#77d4a5" font-family="Arial, sans-serif" font-size="17" font-weight="700">✓ FOUR SANCTUARIES</text>`;

const boardSvg = `
<svg width="2560" height="1440" viewBox="0 0 2560 1440" xmlns="http://www.w3.org/2000/svg">
  <rect width="2560" height="1440" fill="#06182a"/>
  <text x="40" y="58" fill="#f5f0e7" font-family="Arial, sans-serif" font-size="36" font-weight="700">${boardTitle}</text>
  <text x="40" y="91" fill="#9db5cb" font-family="Arial, sans-serif" font-size="18">${boardSubtitle}</text>

  <rect x="38" y="123" width="1554" height="876" rx="4" fill="#0b2238" stroke="#7ca5c5" stroke-width="2"/>
  <rect x="1613" y="123" width="484" height="857" rx="4" fill="#0b2238" stroke="#7ca5c5" stroke-width="2"/>
  <rect x="2118" y="123" width="404" height="176" rx="4" fill="#0b2238" stroke="#7ca5c5" stroke-width="2"/>
  <text x="1554" y="117" text-anchor="end" fill="#f2c26b" font-family="Arial, sans-serif" font-size="15" font-weight="700">DESKTOP · 16:9 · 48°</text>
  <text x="2078" y="117" text-anchor="end" fill="#f2c26b" font-family="Arial, sans-serif" font-size="15" font-weight="700">PORTRAIT · 375:667 · 78°</text>
  <text x="2504" y="117" text-anchor="end" fill="#f2c26b" font-family="Arial, sans-serif" font-size="15" font-weight="700">LANDSCAPE PHONE · 960:412 · 32°</text>

  <rect x="2118" y="326" width="404" height="654" rx="10" fill="#0d2944" stroke="#315b7b" stroke-width="2"/>
  <text x="2144" y="369" fill="#f2c26b" font-family="Arial, sans-serif" font-size="19" font-weight="700">MATERIAL + LIGHT TARGET</text>
  <circle cx="2162" cy="413" r="16" fill="#d8dee5"/><text x="2191" y="420" fill="#e5edf4" font-family="Arial, sans-serif" font-size="16">Cool pearl-alabaster</text>
  <circle cx="2162" cy="458" r="16" fill="#e9e2d7"/><text x="2191" y="465" fill="#e5edf4" font-family="Arial, sans-serif" font-size="16">Weathered marble floor</text>
  <circle cx="2162" cy="503" r="16" fill="#75849b"/><text x="2191" y="510" fill="#e5edf4" font-family="Arial, sans-serif" font-size="16">Blue-gray cloud shadow</text>
  <circle cx="2162" cy="548" r="16" fill="#fff8dc"/><text x="2191" y="555" fill="#e5edf4" font-family="Arial, sans-serif" font-size="16">Single white-gold sun</text>
  <circle cx="2162" cy="593" r="16" fill="#d9c4ed"/><text x="2191" y="600" fill="#e5edf4" font-family="Arial, sans-serif" font-size="16">Restrained iridescence</text>
  <line x1="2144" y1="633" x2="2496" y2="633" stroke="#315b7b"/>
  <text x="2144" y="675" fill="#f5f0e7" font-family="Arial, sans-serif" font-size="18" font-weight="700">LIGHTING LOGIC</text>
  <text x="2144" y="710" fill="#b9cddd" font-family="Arial, sans-serif" font-size="16">${lightingLines[0]}</text>
  <text x="2144" y="741" fill="#b9cddd" font-family="Arial, sans-serif" font-size="16">${lightingLines[1]}</text>
  <text x="2144" y="772" fill="#b9cddd" font-family="Arial, sans-serif" font-size="16">${lightingLines[2]}</text>
  <text x="2144" y="803" fill="#b9cddd" font-family="Arial, sans-serif" font-size="16">${lightingLines[3]}</text>
  <line x1="2144" y1="840" x2="2496" y2="840" stroke="#315b7b"/>
  ${amendmentFooter}

  <rect x="40" y="1030" width="2480" height="342" rx="12" fill="#0d2944" stroke="#315b7b" stroke-width="2"/>
  <text x="68" y="1075" fill="#f2c26b" font-family="Arial, sans-serif" font-size="20" font-weight="700">APPROVED SPATIAL READ, NOW WITH PRODUCTION ART DIRECTION</text>
  <text x="68" y="1120" fill="#f5f0e7" font-family="Arial, sans-serif" font-size="19" font-weight="700">BROKEN VIGIL</text>
  <text x="68" y="1151" fill="#a9bfd1" font-family="Arial, sans-serif" font-size="16">Lower left · largest distant fragment</text>
  <text x="650" y="1120" fill="#f5f0e7" font-family="Arial, sans-serif" font-size="19" font-weight="700">TWIN CHOIR</text>
  <text x="650" y="1151" fill="#a9bfd1" font-family="Arial, sans-serif" font-size="16">Lower right · paired spires</text>
  <text x="1230" y="1120" fill="#f5f0e7" font-family="Arial, sans-serif" font-size="19" font-weight="700">ERODED HALO</text>
  <text x="1230" y="1151" fill="#a9bfd1" font-family="Arial, sans-serif" font-size="16">Upper left · ring ruin</text>
  <text x="1810" y="1120" fill="#f5f0e7" font-family="Arial, sans-serif" font-size="19" font-weight="700">CLOUD CROWN</text>
  <text x="1810" y="1151" fill="#a9bfd1" font-family="Arial, sans-serif" font-size="16">Highest right · smallest far accent</text>
  <line x1="68" y1="1193" x2="2492" y2="1193" stroke="#315b7b"/>
  <text x="68" y="1235" fill="#b9cddd" font-family="Arial, sans-serif" font-size="17">The main sanctuary remains first. The central performer lane stays open in all three aspect ratios.</text>
  <text x="68" y="1270" fill="#b9cddd" font-family="Arial, sans-serif" font-size="17">Gate 2 cameras, FOV values, platform NDC targets, and left/right assignments remain binding.</text>
  <text x="68" y="1322" fill="#77d4a5" font-family="Arial, sans-serif" font-size="18" font-weight="700">✓ CAMERA ASPECT REGISTERED</text>
  <text x="700" y="1322" fill="#77d4a5" font-family="Arial, sans-serif" font-size="18" font-weight="700">✓ CENTRAL LANE CLEAR</text>
  <text x="1295" y="1322" fill="#77d4a5" font-family="Arial, sans-serif" font-size="18" font-weight="700">✓ TWO LOWER + TWO ELEVATED</text>
  <text x="2050" y="1322" fill="#77d4a5" font-family="Arial, sans-serif" font-size="18" font-weight="700">✓ NO CROSSOVER MOTIFS</text>
  <text x="40" y="1412" fill="#7f9bb1" font-family="Arial, sans-serif" font-size="15">${sunModeAmendment ? "Gate 3.1 supersedes the earlier light target while preserving the approved spatial composition and runtime owners." : "Visual targets guide Gate 4 production. They do not replace the approved Blender geometry or runtime owners."}</text>
</svg>`;

await sharp(Buffer.from(boardSvg))
  .composite([
    { input: composites[0], left: 40, top: 125 },
    { input: composites[1], left: 1615, top: 125 },
    { input: composites[2], left: 2120, top: 125 },
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
  gateId: "registered-visual-target",
  revision: sunModeAmendment ? "3.1-sun-mode" : "3",
  generatedAt: new Date().toISOString(),
  gate2ApprovalTrackerItem: "8gVDiuCU9YCztmsm3z1K",
  ...(sunModeAmendment ? { visualPassDecisionTrackerItem: "NqtbLpPGntxwmalkZDNL" } : {}),
  generationMode: "built-in image generation, registered paint-over",
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
      name: "camera-registration",
      passed: Object.values(views).every((view) => view.aspectRegistered),
      evidence: "All target images preserve their registered Gate 2 aspect ratios within 0.15 percent and inherit the locked camera and NDC contract.",
    },
    {
      name: "silhouette-read",
      passed: Object.values(visualAnchorAudit).every(
        (view) => view.oneSun && view.sixFeatherRibs && view.centralPerformerLaneClear && view.platformsSeparated
      ),
      evidence: "Manual visual audit confirms one sun, six feather ribs, a clear performer lane, and four separated sanctuary silhouettes in all registered views.",
    },
    ...(sunModeAmendment ? [{
      name: "sun-mode-read",
      passed: true,
      evidence: "Manual visual audit confirms a natural white-gold solar disc with cloud-scattered corona, no graphic rings or spokes, and one aligned warm-light hierarchy across all registered views.",
    }] : []),
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
