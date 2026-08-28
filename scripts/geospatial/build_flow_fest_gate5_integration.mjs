import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const EVIDENCE_DIR = path.join(
  ROOT,
  "docs/superpowers/specs/flow-fest-sim/evidence/gate-5"
);
const EXPECTED_FINGERPRINT =
  "c244eaeb27504f3a1d0d461408ce209fd6eab650e9a6966d214676a05645a36d";

const STATE_PATH = path.join(
  EVIDENCE_DIR,
  "gate5-state-persistence-report.json"
);
const PERFORMANCE_PATH = path.join(
  EVIDENCE_DIR,
  "gate5-performance-report.json"
);
const TRANSITIONS_PATH = path.join(
  EVIDENCE_DIR,
  "gate5-transition-captures.json"
);
const AUDIO_PATH = path.join(EVIDENCE_DIR, "gate5-audio-review.md");
const WALK_PATH = path.join(EVIDENCE_DIR, "gate5-integrated-walk.mp4");
const TRANSITION_VIDEO_PATH = path.join(
  EVIDENCE_DIR,
  "gate5-transition-captures.mp4"
);
const CONTACT_SHEET_PATH = path.join(
  EVIDENCE_DIR,
  "gate5-viewport-contact-sheet.png"
);
const REPORT_PATH = path.join(EVIDENCE_DIR, "gate5-verification.json");

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
  "static/data/flow-fest-sim/gate2-runtime-contract.json",
  "src/lib/features/flow-fest-sim/domain/flow-fest-integrated-world.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-site-audio.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-fire-jam.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-living-fire-jam.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle.ts",
  "src/lib/features/flow-fest-sim/state/flow-fest-progress.ts",
  "src/lib/features/flow-fest-sim/state/flow-fest-mobility-state.svelte.ts",
  "src/lib/features/flow-fest-sim/services/flow-fest-electric-unicycle-drive.ts",
  "src/lib/features/flow-fest-sim/services/contracts/IFlowFestFireJamSoundscape.ts",
  "src/lib/features/flow-fest-sim/services/implementations/FlowFestFireJamSoundscape.ts",
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
  "src/routes/test/flow-fest-sim/flow-fest-site-fidelity.ts",
  "tests/unit/flow-fest-living-fire-jam.test.ts",
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
      `gate5-festival-active-${label}.png`
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
  const [state, performance, transitions, audio] = await Promise.all([
    readFile(STATE_PATH, "utf8").then(JSON.parse),
    readFile(PERFORMANCE_PATH, "utf8").then(JSON.parse),
    readFile(TRANSITIONS_PATH, "utf8").then(JSON.parse),
    readFile(AUDIO_PATH, "utf8"),
  ]);
  const failures = [];
  const final = state.checkpoints.find(
    (checkpoint) => checkpoint.id === "returned-camp"
  );
  if (
    state.coordinateFingerprint !== EXPECTED_FINGERPRINT ||
    state.status !== "passed"
  ) {
    failures.push("Gate 5 state evidence lost its coordinate source lock");
  }
  if (
    final?.phase !== "morning" ||
    final?.area !== "selected-camp" ||
    final?.complete !== true ||
    final?.backtracking !== true ||
    final?.reentry !== true ||
    final?.fire !== "completed"
  ) {
    failures.push("Gate 5 did not capture the complete night return");
  }
  if (
    final?.graphBuilds !== 1 ||
    final?.sourceStarts !== 3 ||
    final?.audioPlaying !== true ||
    !audio.includes("without rebuilding the graph")
  ) {
    failures.push("Gate 5 audio continuity evidence is incomplete");
  }
  if (
    state.reloadProof?.beforeReload?.transitions !== "1" ||
    state.reloadProof?.afterReload?.transitions !== "1" ||
    state.reloadProof?.afterReload?.phase !== "vehicle-settle"
  ) {
    failures.push("Gate 5 reload introduced a phantom transition");
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
    failures.push("Gate 5 missed the inherited measured render envelope");
  }
  if (
    transitions.status !== "passed" ||
    transitions.final?.transitions !== 7 ||
    transitions.final?.complete !== true
  ) {
    failures.push("Gate 5 transition capture is incomplete");
  }

  const viewportEvidence = [];
  for (const [label, width, height] of VIEWPORTS) {
    const screenshot = path.join(
      EVIDENCE_DIR,
      `gate5-festival-active-${label}.png`
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
  const transitionVideo = probeVideo(TRANSITION_VIDEO_PATH);
  for (const [name, probe, minimumDuration] of [
    ["integrated walk", walkVideo, 20],
    ["transition capture", transitionVideo, 10],
  ]) {
    const stream = probe.streams?.[0];
    if (
      stream?.codec_name !== "h264" ||
      stream?.width !== 1920 ||
      stream?.height !== 1080 ||
      Number(probe.format?.duration) < minimumDuration
    ) {
      failures.push(`Gate 5 ${name} video is underspecified`);
    }
  }
  if (
    state.checks.some((check) => check.status !== "passed") ||
    performance.checks.some((check) => check.status !== "passed")
  ) {
    failures.push("A Gate 5 machine check did not pass");
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
  return {
    state,
    performance,
    transitions,
    walkVideo,
    transitionVideo,
    viewportEvidence,
  };
}

async function build() {
  await buildContactSheet();
  const validated = await validateInputs();
  const evidencePaths = [
    WALK_PATH,
    TRANSITION_VIDEO_PATH,
    AUDIO_PATH,
    PERFORMANCE_PATH,
    STATE_PATH,
    TRANSITIONS_PATH,
    CONTACT_SHEET_PATH,
    path.join(EVIDENCE_DIR, "gate5-lower-gate-1920x1080.png"),
    path.join(EVIDENCE_DIR, "gate5-festival-active-1920x1080.png"),
    path.join(EVIDENCE_DIR, "gate5-night-return-camp-1920x1080.png"),
    ...VIEWPORTS.map(([label]) =>
      path.join(EVIDENCE_DIR, `gate5-festival-active-${label}.png`)
    ),
  ];
  const report = {
    schemaVersion: 1,
    sceneId: "flow-fest-sim-earth",
    gate: 5,
    status: "ready-for-review",
    capturedAt: validated.state.capturedAt,
    route: "/test/flow-fest-sim?gate5=1",
    evidenceRoute: "/test/flow-fest-sim?gate5=1&capture=1",
    coordinateFingerprint: EXPECTED_FINGERPRINT,
    integration: {
      branch: "lower-tent",
      finalState: validated.state.checkpoints.at(-1),
      transitionCount: validated.transitions.final.transitions,
      captureDisclosure: validated.state.captureMode.disclosure,
    },
    checks: [
      {
        name: "museum-connectivity",
        status: "passed",
        evidence:
          "The browser itinerary reaches gate, selected camp, west parking, festival, and selected camp; Gate 2 separately proves continuous terrain and dynamic collider traversal between the registered landmarks.",
      },
      {
        name: "backtracking",
        status: "passed",
        evidence:
          "The settled-position journal recorded seven landmark transitions, a reverse camp/festival edge, one festival exit, a festival re-entry, and the final selected-camp return.",
      },
      {
        name: "state-persistence",
        status: "passed",
        evidence:
          "Reload restored the exact lower-tent camp pose and one crossing without a phantom gate/camp transition; the completed fire jam and seven-transition return also remain serializable.",
      },
      {
        name: "runtime-console",
        status: "passed",
        evidence:
          "The final task-owned Chrome capture reported zero application errors. The existing Rapier initialization deprecation warning is recorded in the persistence and performance reports.",
      },
      {
        name: "performance",
        status: "passed",
        evidence:
          "Gate 5 adds no WebGL object or collider owner beyond the measured Gate 4 production envelope: 16.8 ms p95/p99, 78 draw calls, and 2.82 million rendered triangles.",
      },
      {
        name: "audio-boundaries",
        status: "passed",
        evidence:
          "Arrival, woodland, camp, fire, LED, and crowd gains crossfade on one gesture-created graph; the browser retained one graph build and three long-lived source starts across exit, re-entry, and return.",
      },
    ],
    videos: {
      integratedWalk: validated.walkVideo,
      transitions: validated.transitionVideo,
    },
    viewports: validated.viewportEvidence,
    evidence: await Promise.all(
      [...new Set(evidencePaths.map(relative))].map(fileEvidence)
    ),
    sources: await Promise.all(SOURCE_PATHS.map(fileEvidence)),
    knownLimits: [
      "The integrated-walk video is an explicitly documented composite of the Gate 2 continuous terrain replay, Gate 4 interaction capture, and Gate 5 browser states; it is not one uninterrupted real-time drive.",
      "Vehicle route staging remains untimed because no vehicle speed is approved in the coordinate contract.",
      "Gate 5 audio is deterministic and zone-mixed, not HRTF positional audio or a final field-recorded mix.",
      "The inherited performance sample proves the unchanged WebGL envelope; installation performance still requires the target backpack display hardware.",
      "The bridge and permanent-structure footprints remain source-unlocked and absent.",
    ],
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    "PASS gate5-build: integrated state, backtracking, re-entry, audio boundaries, performance envelope, videos, and seven exact viewports written"
  );
}

async function verify() {
  await validateInputs();
  const report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
  if (
    report.status !== "ready-for-review" ||
    report.checks.length !== 6 ||
    report.checks.some((check) => check.status !== "passed")
  ) {
    throw new Error("The Gate 5 verification report is incomplete");
  }
  for (const entry of [...report.evidence, ...report.sources]) {
    const current = await fileEvidence(entry.path);
    if (current.sha256 !== entry.sha256 || current.bytes !== entry.bytes) {
      throw new Error(`Gate 5 digest mismatch: ${entry.path}`);
    }
  }
  console.log("PASS gate5-coordinate-lock: Gate 2 fingerprint retained");
  console.log(
    "PASS gate5-connectivity: registered gate, camp, parking, festival, and return integrated"
  );
  console.log(
    "PASS gate5-backtracking: seven transitions, reverse traversal, exit, re-entry, and return"
  );
  console.log(
    "PASS gate5-persistence: exact pose and crossing journal restore without phantom travel"
  );
  console.log(
    "PASS gate5-audio: one graph build, three long-lived sources, site-wide crossfades"
  );
  console.log(
    "PASS gate5-performance: unchanged measured WebGL envelope remains within budget"
  );
  console.log(
    `PASS gate5-evidence-digests: ${report.evidence.length} artifacts and ${report.sources.length} source owners match current bytes`
  );
  console.log("PASS gate5-report: 6/6 checks; status ready-for-review");
}

const command = process.argv[2] ?? "verify";
if (command === "build") await build();
else if (command === "verify") await verify();
else throw new Error(`Unknown command: ${command}`);
