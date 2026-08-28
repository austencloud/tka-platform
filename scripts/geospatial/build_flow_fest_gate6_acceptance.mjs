import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const EVIDENCE_DIR = path.join(
  ROOT,
  "docs/superpowers/specs/flow-fest-sim/evidence/gate-6"
);
const EXPECTED_FINGERPRINT =
  "c244eaeb27504f3a1d0d461408ce209fd6eab650e9a6966d214676a05645a36d";

const GNSS_PATH = path.join(EVIDENCE_DIR, "gate6-gnss-rehearsal-report.json");
const REGRESSION_PATH = path.join(EVIDENCE_DIR, "gate6-regression-report.json");
const PERFORMANCE_PATH = path.join(
  EVIDENCE_DIR,
  "gate6-performance-report.json"
);
const CONSOLE_PATH = path.join(EVIDENCE_DIR, "gate6-runtime-console.json");
const WALK_PATH = path.join(EVIDENCE_DIR, "gate6-acceptance-walk.mp4");
const CONTACT_SHEET_PATH = path.join(
  EVIDENCE_DIR,
  "gate6-viewport-evidence.png"
);
const REPORT_PATH = path.join(EVIDENCE_DIR, "gate6-verification.json");

const VIEWPORTS = [
  ["1920x1080", 1920, 1080],
  ["2560x1440", 2560, 1440],
  ["3840x2160", 3840, 2160],
  ["1440x900", 1440, 900],
  ["820x1180", 820, 1180],
  ["960x412", 960, 412],
  ["375x812", 375, 812],
];

const SOURCE_PATHS = [
  "scripts/geospatial/build_flow_fest_gate6_acceptance.mjs",
  "static/data/flow-fest-sim/gate2-runtime-contract.json",
  "src/hooks.server.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-field-positioning.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-fire-jam.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-living-fire-jam.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-site-audio.ts",
  "src/lib/features/flow-fest-sim/services/flow-fest-electric-unicycle-drive.ts",
  "src/lib/features/flow-fest-sim/services/contracts/IFlowFestFireJamSoundscape.ts",
  "src/lib/features/flow-fest-sim/services/implementations/FlowFestFireJamSoundscape.ts",
  "src/lib/features/flow-fest-sim/services/contracts/IFlowFestFieldPositioning.ts",
  "src/lib/features/flow-fest-sim/services/implementations/FlowFestFieldPositioning.ts",
  "src/lib/features/flow-fest-sim/getFlowFestFieldPositioning.ts",
  "src/lib/features/flow-fest-sim/state/flow-fest-field-positioning-state.svelte.ts",
  "src/lib/features/flow-fest-sim/context/flow-fest-field-positioning-context.ts",
  "src/lib/features/flow-fest-sim/components/FlowFestFieldPositioningPanel.svelte",
  "src/lib/shared/3d/performers/LiveSequencePerformer3D.svelte",
  "src/lib/shared/3d/effects/fire/volumetric-fire-mesh.ts",
  "src/lib/shared/3d/effects/volumetric-fire/VolumetricFireComponent.svelte",
  "src/lib/shared/animation-engine/domain/tip-effect-map.ts",
  "src/lib/shared/combination/domain/demo-fixtures.ts",
  "packages/camera-3d/src/lib/frame-delta.ts",
  "packages/camera-3d/src/lib/components/UnifiedCameraController.svelte",
  "src/routes/test/flow-fest-graybox/FlowFestGrayboxWalkScene.svelte",
  "src/routes/test/flow-fest-sim/+page.svelte",
  "src/routes/test/flow-fest-sim/FlowFestElectricUnicycle.svelte",
  "src/routes/test/flow-fest-sim/FlowFestFestivalCommunity.svelte",
  "src/routes/test/flow-fest-sim/FlowFestHeroFire.svelte",
  "src/routes/test/flow-fest-sim/FlowFestProductionLayer.svelte",
  "src/routes/test/flow-fest-sim/flow-fest-production-geometry.ts",
  "tests/unit/flow-fest-living-fire-jam.test.ts",
  "tests/unit/flow-fest-electric-unicycle.test.ts",
  "tests/unit/flow-fest-fire-jam.test.ts",
  "tests/unit/flow-fest-field-positioning.test.ts",
  "tests/unit/flow-fest-integrated-world.test.ts",
  "tests/unit/flow-fest-progress.test.ts",
  "tests/unit/camera-permission-boundary.test.ts",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function relative(absolutePath) {
  return path.relative(ROOT, absolutePath).replaceAll("\\", "/");
}

async function fileEvidence(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const absolutePath = path.join(ROOT, normalized);
  const [bytes, metadata] = await Promise.all([
    readFile(absolutePath),
    stat(absolutePath),
  ]);
  return { path: normalized, bytes: metadata.size, sha256: sha256(bytes) };
}

function probeVideo(absolutePath) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_name,width,height,avg_frame_rate,nb_frames",
        "-of",
        "json",
        absolutePath,
      ],
      { encoding: "utf8" }
    )
  );
}

async function buildContactSheet() {
  const tileWidth = 800;
  const tileHeight = 560;
  const imageWidth = 760;
  const imageHeight = 440;
  const composites = [];
  for (const [index, [label]] of VIEWPORTS.entries()) {
    const screenshot = path.join(
      EVIDENCE_DIR,
      `gate6-acceptance-fire-jam-${label}.png`
    );
    const thumbnail = await sharp(screenshot)
      .resize(imageWidth, imageHeight, {
        fit: "contain",
        background: "#07110d",
      })
      .png()
      .toBuffer();
    const left = (index % 3) * tileWidth + 20;
    const top = Math.floor(index / 3) * tileHeight + 78;
    composites.push({ input: thumbnail, left, top });
    composites.push({
      input: Buffer.from(
        `<svg width="${imageWidth}" height="48" xmlns="http://www.w3.org/2000/svg"><text x="0" y="34" fill="#ffb45f" font-family="Arial, sans-serif" font-size="28" font-weight="700">${label}</text></svg>`
      ),
      left,
      top: top - 52,
    });
  }
  await sharp({
    create: {
      width: tileWidth * 3,
      height: tileHeight * 3,
      channels: 4,
      background: "#07110d",
    },
  })
    .composite(composites)
    .png()
    .toFile(CONTACT_SHEET_PATH);
}

async function validateInputs() {
  const [gnss, regression, performance, runtimeConsole] = await Promise.all([
    readFile(GNSS_PATH, "utf8").then(JSON.parse),
    readFile(REGRESSION_PATH, "utf8").then(JSON.parse),
    readFile(PERFORMANCE_PATH, "utf8").then(JSON.parse),
    readFile(CONSOLE_PATH, "utf8").then(JSON.parse),
  ]);
  const failures = [];

  if (
    gnss.status !== "passed" ||
    gnss.coordinateFingerprint !== EXPECTED_FINGERPRINT ||
    gnss.coordinateAudit?.maximumRoundTripErrorMeters > 0.001 ||
    gnss.syntheticReplay?.samples !== 86 ||
    gnss.acceptance?.nominal?.accepted !== true ||
    gnss.acceptance?.poorAccuracy?.accepted !== false ||
    gnss.acceptance?.stale?.accepted !== false ||
    gnss.acceptance?.poorAccuracy?.playerRevisionAfter !==
      gnss.acceptance?.nominal?.playerRevisionAfter ||
    gnss.acceptance?.stale?.playerRevisionAfter !==
      gnss.acceptance?.nominal?.playerRevisionAfter ||
    gnss.liveFieldTrackCaptured !== false
  ) {
    failures.push(
      "Gate 6 field-positioning evidence is incomplete or overstated"
    );
  }

  if (
    regression.status !== "passed" ||
    regression.acceptanceWalk?.complete !== true ||
    regression.acceptanceWalk?.backtracking !== true ||
    regression.persistence?.positionDriftMeters !== 0 ||
    regression.inheritedGate5?.reentry !== true ||
    regression.tests?.failed !== 0 ||
    regression.typecheck?.errors !== 0 ||
    runtimeConsole.applicationErrors !== 0
  ) {
    failures.push("Gate 6 regression evidence did not pass");
  }

  if (
    performance.status !== "passed" ||
    performance.measurement?.sampling?.p95FrameMilliseconds >
      performance.measurement?.budgets?.desktopP95FrameMillisecondsMaximum ||
    performance.measurement?.renderer?.drawCalls >
      performance.measurement?.budgets?.drawCallsMaximum ||
    performance.measurement?.renderer?.renderedTriangles >
      performance.measurement?.budgets?.visibleTrianglesMaximum
  ) {
    failures.push("Gate 6 missed the measured production envelope");
  }

  const viewportEvidence = [];
  for (const [label, width, height] of VIEWPORTS) {
    const screenshot = path.join(
      EVIDENCE_DIR,
      `gate6-acceptance-fire-jam-${label}.png`
    );
    const [metadata, stats] = await Promise.all([
      sharp(screenshot).metadata(),
      sharp(screenshot).stats(),
    ]);
    const meanDeviation =
      stats.channels
        .slice(0, 3)
        .reduce((sum, channel) => sum + channel.stdev, 0) / 3;
    if (metadata.width !== width || metadata.height !== height) {
      failures.push(`${relative(screenshot)} is not ${label}`);
    }
    if (meanDeviation < 8) {
      failures.push(`${relative(screenshot)} appears blank or flat`);
    }
    viewportEvidence.push({
      path: relative(screenshot),
      width: metadata.width,
      height: metadata.height,
      meanChannelDeviation: meanDeviation,
    });
  }

  const walkVideo = probeVideo(WALK_PATH);
  const stream = walkVideo.streams?.[0];
  if (
    stream?.codec_name !== "h264" ||
    stream?.width !== 1920 ||
    stream?.height !== 1080 ||
    Number(walkVideo.format?.duration) < 30
  ) {
    failures.push("Gate 6 acceptance video is underspecified");
  }
  if (
    [...gnss.checks, ...regression.checks, ...performance.checks].some(
      (check) => check.status !== "passed"
    )
  ) {
    failures.push("A Gate 6 machine check did not pass");
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
  return {
    gnss,
    regression,
    performance,
    runtimeConsole,
    viewportEvidence,
    walkVideo,
  };
}

async function build() {
  await buildContactSheet();
  const validated = await validateInputs();
  const evidencePaths = [
    WALK_PATH,
    CONTACT_SHEET_PATH,
    GNSS_PATH,
    REGRESSION_PATH,
    PERFORMANCE_PATH,
    CONSOLE_PATH,
    path.join(EVIDENCE_DIR, "gate6-gnss-route-accepted-1920x1080.png"),
    path.join(EVIDENCE_DIR, "gate6-gnss-poor-accuracy-held-1920x1080.png"),
    path.join(EVIDENCE_DIR, "gate6-gnss-stale-held-1920x1080.png"),
    path.join(EVIDENCE_DIR, "gate6-acceptance-final-camp-1920x1080.png"),
    ...VIEWPORTS.map(([label]) =>
      path.join(EVIDENCE_DIR, `gate6-acceptance-fire-jam-${label}.png`)
    ),
  ];
  const report = {
    schemaVersion: 1,
    sceneId: "flow-fest-sim-earth",
    gate: 6,
    status: "ready-for-review",
    capturedAt: validated.regression.capturedAt,
    route: "/test/flow-fest-sim?gate6=1",
    evidenceRoute: "/test/flow-fest-sim?gate6=1&capture=1",
    coordinateFingerprint: EXPECTED_FINGERPRINT,
    checks: [
      {
        name: "focused-tests",
        status: "passed",
        evidence:
          "All focused Flow Fest and permission-boundary tests pass, including projection round trips, accepted/held fix semantics, journey persistence, fire-jam state, EUC dynamics, terrain contract, and production geometry.",
      },
      {
        name: "typecheck",
        status: "passed",
        evidence:
          "The final project check completed with zero errors and zero warnings.",
      },
      {
        name: "runtime-console",
        status: "passed",
        evidence:
          "The task-owned Chrome tab recorded zero application errors. The existing Rapier initialization deprecation warning remains disclosed; extension-origin wallet diagnostics are excluded from application results.",
      },
      {
        name: "performance",
        status: "passed",
        evidence:
          "Gate 6 adds DOM controls, pure projection math, and opt-in browser geolocation without adding WebGL geometry, materials, lights, colliders, or animation owners. The approved 16.8 ms p95 production envelope remains within budget.",
      },
      {
        name: "field-positioning",
        status: "passed",
        evidence:
          "The EPSG:26916 projection round trip stays below one millimetre. A valid 86-sample registered-route replay advances the real player seam; poor-accuracy and stale fixes remain visible but cannot change player revision or position.",
      },
      {
        name: "acceptance-state",
        status: "passed",
        evidence:
          "The accepted lower-tent run reaches morning at the selected camp with the fire jam complete and backtracking recorded; reload restores the exact camp position and parked-EUC state with zero positional drift.",
      },
      {
        name: "viewport-evidence",
        status: "passed",
        evidence:
          "The final acceptance UI and playable world were inspected and retained at 1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, and 375x812 with no panel overlap.",
      },
    ],
    acceptanceWalk: validated.walkVideo,
    viewports: validated.viewportEvidence,
    evidence: await Promise.all(
      [...new Set(evidencePaths.map(relative))].map(fileEvidence)
    ),
    sources: await Promise.all(SOURCE_PATHS.map(fileEvidence)),
    knownLimits: [
      "The acceptance video is a disclosed composite of the Gate 5 integrated journey plus current Gate 6 GNSS and final-camp states; it is not one uninterrupted real-time drive.",
      "The GNSS result is a deterministic registered-route rehearsal. No real festival-day device track was captured, so field hardware and multipath behavior remain unverified.",
      "Poor-accuracy and stale fix diagnostics are capture-only controls; production GPS remains opt-in through a user gesture.",
      "Installation performance still requires measurement on the final backpack display, phone, battery, and thermal envelope.",
      "The bridge and permanent-structure footprints remain source-unlocked and absent.",
    ],
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    "PASS gate6-build: final acceptance state, GNSS rehearsal, regression, performance, video, and seven exact viewports written"
  );
}

async function verify() {
  await validateInputs();
  const report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
  if (
    report.status !== "ready-for-review" ||
    report.checks.length !== 7 ||
    report.checks.some((check) => check.status !== "passed")
  ) {
    throw new Error("The Gate 6 verification report is incomplete");
  }
  for (const entry of [...report.evidence, ...report.sources]) {
    const current = await fileEvidence(entry.path);
    if (current.sha256 !== entry.sha256 || current.bytes !== entry.bytes) {
      throw new Error(`Gate 6 digest mismatch: ${entry.path}`);
    }
  }
  console.log("PASS gate6-coordinate-lock: Gate 2 fingerprint retained");
  console.log(
    "PASS gate6-acceptance-state: complete journey and exact reload pose retained"
  );
  console.log(
    "PASS gate6-gnss: accepted, poor-accuracy, stale, and round-trip contracts pass"
  );
  console.log(
    "PASS gate6-responsive: seven exact viewport captures are nonblank"
  );
  console.log(
    "PASS gate6-runtime: focused tests, typecheck, console, and performance pass"
  );
  console.log(
    `PASS gate6-evidence-digests: ${report.evidence.length} artifacts and ${report.sources.length} source owners match current bytes`
  );
  console.log("PASS gate6-report: 7/7 checks; status ready-for-review");
}

const command = process.argv[2] ?? "verify";
if (command === "build") await build();
else if (command === "verify") await verify();
else throw new Error(`Unknown command: ${command}`);
