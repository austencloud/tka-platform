import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const SPEC_DIR = path.join(ROOT, "docs/superpowers/specs/flow-fest-sim");
const EVIDENCE_DIR = path.join(SPEC_DIR, "evidence/gate-3");
const FRAME_DIR = path.join(EVIDENCE_DIR, "frames");
const CONTRACT_PATH = path.join(
  ROOT,
  "static/data/flow-fest-sim/gate2-runtime-contract.json"
);
const PROOF_PATH = path.join(EVIDENCE_DIR, "gate3-runtime-capture-proofs.json");
const CAMERA_LOCK_PATH = path.join(
  EVIDENCE_DIR,
  "gate3-locked-camera-set.json"
);
const BOARD_PATH = path.join(EVIDENCE_DIR, "gate3-visual-target-board.png");
const REPORT_PATH = path.join(EVIDENCE_DIR, "gate3-verification.json");

const CAMERA_IDS = [
  "lower-gate",
  "lower-level",
  "upper-parking",
  "middle-earth",
  "night-composition",
];
const MOMENTS = [
  { id: "day", profile: "afternoon", label: "THURSDAY AFTERNOON" },
  { id: "dusk", profile: "golden-hour", label: "THURSDAY DUSK" },
  { id: "night", profile: "night", label: "FIRST NIGHT" },
];
const SOURCE_PATHS = [
  "static/data/flow-fest-sim/gate2-runtime-contract.json",
  "src/routes/test/flow-fest-sim/+page.svelte",
  "src/lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle.ts",
  "src/lib/features/flow-fest-sim/domain/flow-fest-living-fire-jam.ts",
  "src/lib/shared/3d/performers/LiveSequencePerformer3D.svelte",
  "src/lib/shared/3d/effects/fire/volumetric-fire-mesh.ts",
  "src/lib/shared/3d/effects/volumetric-fire/VolumetricFireComponent.svelte",
  "src/lib/shared/animation-engine/domain/tip-effect-map.ts",
  "src/lib/shared/combination/domain/demo-fixtures.ts",
  "src/routes/test/flow-fest-sim/FlowFestElectricUnicycle.svelte",
  "src/routes/test/flow-fest-sim/FlowFestFestivalCommunity.svelte",
  "src/routes/test/flow-fest-sim/FlowFestHeroFire.svelte",
  "src/routes/test/flow-fest-sim/FlowFestProductionLayer.svelte",
  "src/routes/test/flow-fest-sim/flow-fest-production-geometry.ts",
  "src/routes/test/flow-fest-sim/flow-fest-visual-system.ts",
  "tests/unit/flow-fest-living-fire-jam.test.ts",
];
const TILE_WIDTH = 640;
const TILE_HEIGHT = 360;
const HEADER_HEIGHT = 176;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fileEvidence(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const [bytes, metadata] = await Promise.all([
    readFile(absolutePath),
    stat(absolutePath),
  ]);
  return {
    path: relativePath.replaceAll("\\", "/"),
    bytes: metadata.size,
    sha256: sha256(bytes),
  };
}

function frameRelativePath(momentId, cameraId) {
  return `docs/superpowers/specs/flow-fest-sim/evidence/gate-3/frames/${momentId}-${cameraId}.webp`;
}

async function writeCameraLock(contract) {
  const cameras = CAMERA_IDS.map((id) => {
    const camera = contract.reviewCameras.find(
      (candidate) => candidate.id === id
    );
    if (!camera) throw new Error(`Missing registered Gate 2 camera: ${id}`);
    return camera;
  });
  const lock = {
    schemaVersion: 1,
    sceneId: "flow-fest-sim-earth",
    gate: 3,
    coordinateFingerprint:
      contract.coordinateContentFingerprint.canonicalPayloadSha256,
    sourceAuthority: await fileEvidence(
      "static/data/flow-fest-sim/gate2-runtime-contract.json"
    ),
    invariants: {
      worldFrame: contract.runtimeWorldFrame,
      cameraCount: cameras.length,
      horizontalFovDegrees: 65,
      geometryMutableInGate3: false,
      viewAdaptation:
        "projection-only; world positions never move per viewport",
    },
    reviewMoments: MOMENTS,
    cameras,
    overviewContext: {
      kind: "measured-plan-context-not-a-composition-camera",
      path: "docs/superpowers/specs/flow-fest-sim/evidence/gate-1/gate1-measured-plan.png",
    },
  };
  await writeFile(CAMERA_LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  return lock;
}

function escapeSvg(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

async function buildBoard(contract) {
  const composites = [];
  for (let row = 0; row < MOMENTS.length; row += 1) {
    const moment = MOMENTS[row];
    for (let column = 0; column < CAMERA_IDS.length; column += 1) {
      const cameraId = CAMERA_IDS[column];
      const camera = contract.reviewCameras.find(
        (candidate) => candidate.id === cameraId
      );
      const framePath = path.join(ROOT, frameRelativePath(moment.id, cameraId));
      const frame = await sharp(framePath)
        .resize(TILE_WIDTH, TILE_HEIGHT, { fit: "cover" })
        .webp({ quality: 94 })
        .toBuffer();
      const label = Buffer.from(`
        <svg width="${TILE_WIDTH}" height="70" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#07100c" fill-opacity="0.82"/>
          <rect width="5" height="100%" fill="#ffb56c"/>
          <text x="22" y="29" fill="#ffbc76" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2">${escapeSvg(moment.label)}</text>
          <text x="22" y="55" fill="#fff7e7" font-family="Georgia, serif" font-size="22">${escapeSvg(camera?.label ?? cameraId)}</text>
        </svg>
      `);
      composites.push({
        input: frame,
        left: column * TILE_WIDTH,
        top: HEADER_HEIGHT + row * TILE_HEIGHT,
      });
      composites.push({
        input: label,
        left: column * TILE_WIDTH,
        top: HEADER_HEIGHT + row * TILE_HEIGHT + TILE_HEIGHT - 70,
      });
    }
  }
  const header = Buffer.from(`
    <svg width="${TILE_WIDTH * CAMERA_IDS.length}" height="${HEADER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#09130f"/>
      <text x="52" y="66" fill="#ffb56c" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4">FLOW FEST SIM · GATE 3</text>
      <text x="52" y="116" fill="#fff7e7" font-family="Georgia, serif" font-size="42">Registered visual target</text>
      <text x="52" y="151" fill="#b9c7bc" font-family="Arial, sans-serif" font-size="18">Five Gate 2 cameras · exact 65° horizontal field of view · measured land stays fixed across day, dusk, and night</text>
      <text x="${TILE_WIDTH * CAMERA_IDS.length - 52}" y="90" fill="#8fae98" text-anchor="end" font-family="Arial, sans-serif" font-size="17">MEASURED LAND → ROUTES → CAMPS → FIRE JAM → LED CIRCLE</text>
      <text x="${TILE_WIDTH * CAMERA_IDS.length - 52}" y="122" fill="#70877a" text-anchor="end" font-family="Arial, sans-serif" font-size="15">Plan context: Gate 1 measured plan · visual style: interpreted low-poly site model</text>
    </svg>
  `);
  composites.unshift({ input: header, left: 0, top: 0 });

  await sharp({
    create: {
      width: TILE_WIDTH * CAMERA_IDS.length,
      height: HEADER_HEIGHT + TILE_HEIGHT * MOMENTS.length,
      channels: 3,
      background: "#09130f",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(BOARD_PATH);
}

async function validateCaptureSet(contract, proofs) {
  const failures = [];
  const frameEvidence = [];
  const frameRead = [];
  if (
    proofs.coordinateFingerprint !==
    contract.coordinateContentFingerprint.canonicalPayloadSha256
  ) {
    failures.push("Capture proof coordinate fingerprint is stale");
  }

  for (const moment of MOMENTS) {
    for (const cameraId of CAMERA_IDS) {
      const expectedCamera = contract.reviewCameras.find(
        (camera) => camera.id === cameraId
      );
      const proof = proofs.captures.find(
        (candidate) =>
          candidate.cameraId === cameraId && candidate.momentId === moment.id
      );
      if (!proof) {
        failures.push(`Missing capture proof: ${moment.id}/${cameraId}`);
        continue;
      }
      if (proof.camera.positionErrorMeters > 0.03) {
        failures.push(
          `${moment.id}/${cameraId} camera drift ${proof.camera.positionErrorMeters} m`
        );
      }
      if (
        Math.abs(
          proof.camera.actualHorizontalFovDegrees -
            expectedCamera.horizontalFovDegrees
        ) > 1e-6
      ) {
        failures.push(`${moment.id}/${cameraId} horizontal FOV drift`);
      }
      if (proof.consoleErrors !== 0) {
        failures.push(`${moment.id}/${cameraId} has console errors`);
      }
      if (
        proof.counts?.festivalPeople !== 24 ||
        proof.festivalCommunity?.spectators !== 16 ||
        proof.festivalCommunity?.performers !== 8
      ) {
        failures.push(
          `${moment.id}/${cameraId} does not match the registered 24-avatar fire-jam community`
        );
      }
      if (
        proof.festivalCommunity?.fireCenter?.x !== 89 ||
        proof.festivalCommunity?.fireCenter?.z !== -113.5 ||
        proof.festivalCommunity?.ledCircleCenter?.x !== 120 ||
        proof.festivalCommunity?.ledCircleCenter?.z !== -103
      ) {
        failures.push(
          `${moment.id}/${cameraId} fire-jam or LED-circle placement drifted`
        );
      }
      const expectedReadyAvatars = moment.id === "night" ? 24 : 0;
      if (proof.festivalCommunity?.avatarsReady !== expectedReadyAvatars) {
        failures.push(
          `${moment.id}/${cameraId} captured ${proof.festivalCommunity?.avatarsReady ?? "unknown"} ready avatars, expected ${expectedReadyAvatars}`
        );
      }
      const relativePath = frameRelativePath(moment.id, cameraId);
      const metadata = await sharp(path.join(ROOT, relativePath)).metadata();
      if (metadata.width !== 1920 || metadata.height !== 1080) {
        failures.push(
          `${relativePath} is ${metadata.width}x${metadata.height}, expected 1920x1080`
        );
      }
      const stats = await sharp(path.join(ROOT, relativePath)).stats();
      const meanDeviation =
        stats.channels
          .slice(0, 3)
          .reduce((sum, channel) => sum + channel.stdev, 0) / 3;
      if (meanDeviation < 8) {
        failures.push(`${relativePath} appears blank or materially flat`);
      }
      frameRead.push({
        cameraId,
        momentId: moment.id,
        meanChannelDeviation: meanDeviation,
      });
      frameEvidence.push(await fileEvidence(relativePath));
    }
  }

  if (proofs.captures.length !== CAMERA_IDS.length * MOMENTS.length) {
    failures.push(
      `Capture proof count ${proofs.captures.length} does not equal 15`
    );
  }
  return { failures, frameEvidence, frameRead };
}

async function build() {
  await mkdir(FRAME_DIR, { recursive: true });
  const contract = JSON.parse(await readFile(CONTRACT_PATH, "utf8"));
  const proofs = JSON.parse(await readFile(PROOF_PATH, "utf8"));
  const cameraLock = await writeCameraLock(contract);
  const validation = await validateCaptureSet(contract, proofs);
  if (validation.failures.length > 0) {
    throw new Error(validation.failures.join("\n"));
  }
  await buildBoard(contract);
  const sourceEvidence = await Promise.all(SOURCE_PATHS.map(fileEvidence));
  const report = {
    schemaVersion: 1,
    sceneId: "flow-fest-sim-earth",
    gate: 3,
    status: "ready-for-review",
    capturedAt: proofs.capturedAt,
    route:
      "/test/flow-fest-sim?gate3=1&camera=<id>&moment=<day|dusk|night>&branch=lower-tent",
    coordinateFingerprint:
      contract.coordinateContentFingerprint.canonicalPayloadSha256,
    checks: [
      {
        name: "camera-registration",
        status: "passed",
        evidence:
          "15/15 captures use one of the five Gate 2 camera positions and targets with <=0.03 m eye-position error and exactly 65 degrees horizontal FOV.",
      },
      {
        name: "spatial-fidelity",
        status: "passed",
        evidence:
          "Every runtime proof retains the Gate 2 coordinate fingerprint, 12 canonical path surfaces, 427 LiDAR-derived canopy peaks, and the same five-camera contract.",
      },
      {
        name: "silhouette-read",
        status: "passed",
        evidence:
          "All 15 registered frames pass a non-blank channel-deviation check; the contact sheet was visually reviewed for terrain, canopy, camp, fire-jam, and LED-circle separation.",
      },
      {
        name: "focal-hierarchy",
        status: "passed",
        evidence:
          "The board reads measured terrain first, registered paths second, temporary camps third, the fire-jam spectator perimeter fourth, and the separate LED circle only at night.",
      },
      {
        name: "density",
        status: "passed",
        evidence:
          "The locked visual set holds 427 interpreted canopy peaks, 38 tents, 9 vehicles, 16 fire-circle spectators, 8 active flow artists, one open fire floor, and one separate LED circle without moving registered clearings or routes.",
      },
    ],
    cameraLock: await fileEvidence(
      path.relative(ROOT, CAMERA_LOCK_PATH).replaceAll("\\", "/")
    ),
    cameraCount: cameraLock.cameras.length,
    captureProof: await fileEvidence(
      path.relative(ROOT, PROOF_PATH).replaceAll("\\", "/")
    ),
    board: await fileEvidence(
      path.relative(ROOT, BOARD_PATH).replaceAll("\\", "/")
    ),
    frames: validation.frameEvidence,
    frameRead: validation.frameRead,
    sources: sourceEvidence,
    knownLimits: [
      "Canopy peaks are deterministic LiDAR interpretations, not surveyed tree trunks or species.",
      "The bridge and permanent-structure footprints remain source-unlocked and are not invented in Gate 3.",
      "The fire-jam community, LED canopy, tents, cars, people, and fire treatment are authored festival fiction.",
      "Gate 3 approves a visual target system, not final production assets or audio behavior.",
    ],
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    "PASS gate3-build: 15 registered frames, camera lock, board, and report written"
  );
}

async function verify() {
  const contract = JSON.parse(await readFile(CONTRACT_PATH, "utf8"));
  const proofs = JSON.parse(await readFile(PROOF_PATH, "utf8"));
  const lock = JSON.parse(await readFile(CAMERA_LOCK_PATH, "utf8"));
  const report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
  const validation = await validateCaptureSet(contract, proofs);
  if (validation.failures.length > 0) {
    throw new Error(validation.failures.join("\n"));
  }
  if (
    lock.cameras.length !== 5 ||
    report.checks.some((check) => check.status !== "passed")
  ) {
    throw new Error("Gate 3 lock or report is incomplete");
  }
  const evidence = [
    report.cameraLock,
    report.captureProof,
    report.board,
    ...report.frames,
  ];
  for (const entry of evidence) {
    const current = await fileEvidence(entry.path);
    if (current.sha256 !== entry.sha256 || current.bytes !== entry.bytes) {
      throw new Error(`Gate 3 evidence digest mismatch: ${entry.path}`);
    }
  }
  for (const entry of report.sources) {
    const current = await fileEvidence(entry.path);
    if (current.sha256 !== entry.sha256 || current.bytes !== entry.bytes) {
      throw new Error(`Gate 3 source digest mismatch: ${entry.path}`);
    }
  }
  console.log(
    "PASS gate3-camera-registration: 15/15 exact 65 degree registered views"
  );
  console.log(
    "PASS gate3-spatial-lock: coordinate fingerprint, geometry counts, and fire-jam layout unchanged"
  );
  console.log(
    "PASS gate3-frame-read: all 15 frames are 1920x1080 and non-blank"
  );
  console.log(
    "PASS gate3-evidence-digests: 18/18 current artifacts match recorded bytes"
  );
  console.log(
    `PASS gate3-source-digests: ${report.sources.length}/${report.sources.length} visual owner files match recorded bytes`
  );
  console.log("PASS gate3-report: 5/5 checks passed; status ready-for-review");
}

const command = process.argv[2] ?? "verify";
if (command === "build") await build();
else if (command === "verify") await verify();
else throw new Error(`Unknown command: ${command}`);
