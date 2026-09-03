/**
 * Locomotion motion quality
 *
 * The rest of the locomotion suite checks plumbing: that a key exists, that a
 * band is arithmetic, that a clock advances. None of it can tell whether the
 * character on screen is moving like a person, because none of it ever poses a
 * skeleton. This does.
 *
 * It drives the real `LocomotionAnimator` with the real shipped clips on real
 * shipped rigs, reads the pose off the bones with the walk lab's own sampler,
 * and measures it with the walk lab's own analysis. Nothing here is a stand-in,
 * and that includes the retarget: the pack clips are authored on `mixamorig:`
 * and the avatars' bones are `mixamorig12:`, so every run goes through
 * `remapClipToSkeleton` exactly as the app does.
 *
 * ## What this can and cannot see
 *
 * `FootPlanter` IK and the arm pass run after the animator in `Avatar3D`, and
 * neither runs here. That is deliberate -- it isolates the layer the run tier
 * changed, so a correction downstream cannot hide a defect upstream -- but it
 * decides what may be asserted.
 *
 * Measured, not assumed: on `ch01` at 3.9 m/s this layer reports cadence 80/min
 * and a step length of 0 cm, while the same rig through the full pipeline in
 * the walk lab reports 133/min and 140.7 cm. Every contact-derived number --
 * cadence, step length, duty factor, foot slip, over-support, weight
 * alternation -- is dominated by the planter that is missing here, so asserting
 * on one would be pinning an artefact of the harness. Those belong to the
 * browser probe, on the complete pipeline.
 *
 * What survives the missing planter is what the animator alone decides:
 *
 * - the **pelvis bob**, which `prepareClip` writes and which is the whole
 *   reason a stance foot has something to stand through;
 * - the **gait tier**, which is pure clip-weight arithmetic;
 * - the **crossover**, because a pose discontinuity at the tier change would
 *   appear as joint acceleration whether or not a planter later locks a foot.
 *
 * Those three are measured on every shipped rig below, and they agree to within
 * a millimetre across all of them.
 *
 * ## Not a curve
 *
 * Every walk-lab pattern that sustains a gait long enough to fill a buffer
 * rides `CIRCLE_R = 2.6`, which at run speed is 6 m/s^2 of lateral acceleration
 * -- enough to move the pelvis off the support foot on its own. This travels in
 * a straight line, which is the only way to tell a weight-transfer defect from
 * the turn the character was asked to hold.
 *
 * `setActiveState` is not called, so weights take the legacy path. For steady
 * locomotion the two are equivalent: the state path multiplies the same
 * `targetDirWeights` by 1 while WALKING. `LocomotionState` is not exported from
 * the package, and reaching past that to exercise a multiply-by-one would buy
 * nothing.
 */

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { AnimationClip, Group, Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { LocomotionAnimator } from "@austencloud/scene-3d";
import {
  analyzeGait,
  type GaitReport,
} from "$lib/shared/3d/diagnostics/gait/gait-analysis";
import type { GaitFrame } from "$lib/shared/3d/diagnostics/gait/gait-frame";
import {
  collectRiggedAvatars,
  sampleRig,
} from "$lib/shared/3d/diagnostics/gait/gait-rig-sampler";

const PACK = path.resolve(process.cwd(), "static/animations/locomotion-pack");

const avatar = (id: string) =>
  path.resolve(process.cwd(), `static/models/avatars/_optimized/${id}.glb`);

/**
 * Shipped characters, not clip GLBs.
 *
 * The pack's GLBs each carry the full armature and no skinned mesh, which makes
 * one of them look like a convenient rig. It is not: those are raw Mixamo
 * exports, so the armature is turned a quarter turn, scaled by 0.01, and its
 * Hips sit at -104.27 **centimetres on local Z**. The optimize pipeline emits
 * the opposite -- an identity root with Hips at 0.99 **metres on Y** -- and
 * `prepareClip` bob mode writes the pelvis bob to local Y as a fraction of hip
 * height. That is correct for the shipped convention and silently lands on the
 * wrong axis, 100x too small, on the raw one: measuring a pack GLB reports a
 * pelvis frozen to the millimetre and a duty factor half what the app has.
 */
const RIGS = ["ch01", "ch07", "ch10", "ch12", "ch18"];
const REFERENCE_RIG = avatar(RIGS[0]!);

const CLIP_FILES: Record<string, string> = {
  idle: "idle.glb",
  forward: "walk-forward.glb",
  backward: "walk-backward.glb",
  strafeLeft: "strafe-left.glb",
  strafeRight: "strafe-right.glb",
  runForward: "run.glb",
  runStrafeLeft: "strafe-run-left.glb",
  runStrafeRight: "strafe-run-right.glb",
};

/** The two fields `loadAnimations` would have filled over the network. */
interface ClipInjectionSeam {
  pendingClips: Map<string, AnimationClip>;
  clipsLoaded: boolean;
}

const loader = new GLTFLoader();

/**
 * Node copies a file into a shared pool, so a `Buffer` is a view into a larger
 * allocation. Slicing its `ArrayBuffer` by offset is the one place this can go
 * wrong quietly: a mis-sliced GLB parses as JSON and reports an unsupported
 * asset version rather than a bad offset. Copy, then check the magic.
 */
function readGlb(file: string): Uint8Array {
  const buffer = fs.readFileSync(file);
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== "glTF") throw new Error(`${file}: magic "${magic}"`);
  return bytes;
}

const GLB_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const GLTF_MAGIC = 0x46546c67;

/** Extensions that exist only to describe an image payload. */
const TEXTURE_EXTENSIONS = new Set([
  "KHR_texture_basisu",
  "EXT_texture_webp",
  "KHR_texture_transform",
  "EXT_meshopt_compression",
]);

/**
 * Remove every image from a GLB, leaving the skeleton untouched.
 *
 * jsdom cannot decode an image and three waits on the decode forever, so a
 * textured avatar hangs the parse rather than failing it. Shading has no
 * bearing on where a bone ends up, so this drops images, textures, samplers and
 * the material references to them, and leaves nodes, skins, meshes and
 * accessors exactly as shipped.
 */
function stripTextures(bytes: Uint8Array): ArrayBuffer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = GLB_HEADER_BYTES;
  let json: Record<string, unknown> | null = null;
  let bin: Uint8Array | null = null;

  while (offset < bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + CHUNK_HEADER_BYTES;
    const chunk = bytes.subarray(start, start + length);
    if (type === JSON_CHUNK) {
      json = JSON.parse(new TextDecoder().decode(chunk)) as Record<
        string,
        unknown
      >;
    } else if (type === BIN_CHUNK) {
      bin = chunk;
    }
    offset = start + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error("GLB has no JSON chunk");

  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const material of (json.materials ?? []) as Record<string, unknown>[]) {
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    delete material.extensions;
    const pbr = material.pbrMetallicRoughness as
      | Record<string, unknown>
      | undefined;
    if (pbr) {
      delete pbr.baseColorTexture;
      delete pbr.metallicRoughnessTexture;
    }
  }
  const keep = (name: string) => !TEXTURE_EXTENSIONS.has(name);
  json.extensionsUsed = ((json.extensionsUsed ?? []) as string[]).filter(keep);
  json.extensionsRequired = ((json.extensionsRequired ?? []) as string[]).filter(
    keep
  );

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const binBytes = bin ?? new Uint8Array(0);
  const binPad = (4 - (binBytes.byteLength % 4)) % 4;
  const total =
    GLB_HEADER_BYTES +
    CHUNK_HEADER_BYTES +
    jsonBytes.byteLength +
    jsonPad +
    (bin ? CHUNK_HEADER_BYTES + binBytes.byteLength + binPad : 0);

  const out = new Uint8Array(total);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, GLTF_MAGIC, true);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, total, true);
  outView.setUint32(12, jsonBytes.byteLength + jsonPad, true);
  outView.setUint32(16, JSON_CHUNK, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonBytes.byteLength + jsonPad);
  if (bin) {
    const binStart = 20 + jsonBytes.byteLength + jsonPad;
    outView.setUint32(binStart, binBytes.byteLength + binPad, true);
    outView.setUint32(binStart + 4, BIN_CHUNK, true);
    out.set(binBytes, binStart + CHUNK_HEADER_BYTES);
  }
  return out.buffer;
}

function parse(
  data: ArrayBuffer
): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  return new Promise((resolve, reject) =>
    loader.parse(data, "", resolve as never, reject)
  );
}

const clips = new Map<string, AnimationClip>();
const rigs = new Map<string, ArrayBuffer>();

/** Strip once per rig; `parse` is cheap, re-reading and re-encoding is not. */
function rigData(file: string): ArrayBuffer {
  let data = rigs.get(file);
  if (!data) {
    data = stripTextures(readGlb(file));
    rigs.set(file, data);
  }
  return data;
}

beforeAll(async () => {
  for (const [key, file] of Object.entries(CLIP_FILES)) {
    const gltf = await parse(readGlb(path.join(PACK, file)).buffer);
    const clip = gltf.animations[0];
    if (clip) clips.set(key, clip);
  }
  expect(clips.size, "every pack clip parsed").toBe(
    Object.keys(CLIP_FILES).length
  );
}, 120_000);

interface DriveOptions {
  /** Commanded ground speed in metres per second, as a function of time. */
  speedAt: (t: number) => number;
  seconds: number;
  /** Frames discarded before recording, so the blend springs reach target. */
  settleSeconds?: number;
  frameRate?: number;
  /** Absolute path to the rig GLB. Defaults to the reference rig. */
  rig?: string;
  /** Clip keys withheld from the animator, to model an incomplete pack. */
  omitClips?: string[];
}

interface DriveResult {
  frames: GaitFrame[];
  report: GaitReport;
  /** `getGaitTier()` sampled on every recorded frame. */
  tiers: number[];
  /** Commanded speed on every recorded frame, for reading a sweep back. */
  speeds: number[];
}

/**
 * Walk a rig in a straight line along +Z and record what the bones did.
 *
 * A fresh animator per call: the blend springs, the gait clock and the tier
 * split are all stateful, and a test that inherited another test's mid-blend
 * pose would be measuring the previous case as much as its own.
 */
async function drive({
  speedAt,
  seconds,
  settleSeconds = 2,
  frameRate = 60,
  rig: rigFile = REFERENCE_RIG,
  omitClips = [],
}: DriveOptions): Promise<DriveResult> {
  const rig = await parse(rigData(rigFile));
  const travel = new Group();
  travel.add(rig.scene);

  const animator = new LocomotionAnimator();
  const seam = animator as unknown as ClipInjectionSeam;
  const injected = new Map(clips);
  for (const key of omitClips) injected.delete(key);
  seam.pendingClips = injected;
  seam.clipsLoaded = true;
  animator.initialize(rig.scene);

  const avatars = collectRiggedAvatars(travel);
  expect(avatars, "sampler found the rig leg chains").toHaveLength(1);
  const rigged = avatars[0]!;

  const dt = 1 / frameRate;
  const frames: GaitFrame[] = [];
  const tiers: number[] = [];
  const speeds: number[] = [];
  let z = 0;

  const total = Math.round((settleSeconds + seconds) * frameRate);
  for (let i = 0; i < total; i++) {
    const elapsed = i * dt;
    const speed = speedAt(Math.max(0, elapsed - settleSeconds));

    animator.setLocomotion({
      isMoving: speed > 0.01,
      speed,
      moveDirection: { x: 0, z: 1 },
    });
    animator.update(dt);

    z += speed * dt;
    travel.position.z = z;
    travel.updateMatrixWorld(true);

    if (elapsed < settleSeconds) continue;
    frames.push(sampleRig(rigged, { t: elapsed - settleSeconds, dt }));
    tiers.push(animator.getGaitTier());
    speeds.push(speed);
  }

  animator.dispose();
  return { frames, report: analyzeGait(frames), tiers, speeds };
}

/** Peak-to-peak vertical travel of the pelvis, in centimetres. */
function bobCm(frames: GaitFrame[]): number {
  let low = Infinity;
  let high = -Infinity;
  for (const frame of frames) {
    low = Math.min(low, frame.hips.y);
    high = Math.max(high, frame.hips.y);
  }
  return (high - low) * 100;
}

const last = (values: number[]) => values[values.length - 1] ?? 0;

/**
 * Flow Fest walks at 1.7 and sprints at 3.91. These sit either side of the
 * band the animator derives from the clips' own measured speeds: the walk clip
 * stops being honest at 1.5174 x 1.15 = 1.745 and the run clip starts being
 * honest at 3.0987 x 0.80 = 2.479.
 */
const WALK_SPEED = 1.4;
const RUN_SPEED = 3.9;

describe("locomotion motion quality", () => {
  describe("pelvis bob", () => {
    it("raises and lowers the pelvis through a walk", async () => {
      const { frames } = await drive({
        speedAt: () => WALK_SPEED,
        seconds: 6,
      });
      // A walk lifts its pelvis roughly eight centimetres per step, and that
      // rise is what gives a foot a stance to stand through. A pelvis pinned
      // to one height leaves the leg no way to fold except by moving the foot.
      expect(bobCm(frames)).toBeGreaterThan(4);
      expect(bobCm(frames)).toBeLessThan(14);
    }, 120_000);

    it("keeps the bob once the run tier has taken over", async () => {
      const walk = await drive({ speedAt: () => WALK_SPEED, seconds: 6 });
      const run = await drive({ speedAt: () => RUN_SPEED, seconds: 6 });
      expect(bobCm(run.frames)).toBeGreaterThan(4);
      // A run displaces the pelvis further than a walk, never less. Blending
      // toward a clip that had lost its vertical track would show up here as
      // the run bobbing less than the walk it replaced.
      expect(bobCm(run.frames)).toBeGreaterThan(bobCm(walk.frames));
    }, 120_000);

    it("bobs by the same amount on every shipped rig", async () => {
      const measured: Record<string, number> = {};
      for (const id of RIGS) {
        const { frames } = await drive({
          speedAt: () => WALK_SPEED,
          seconds: 5,
          rig: avatar(id),
        });
        measured[id] = bobCm(frames);
      }
      const values = Object.values(measured);
      for (const [id, cm] of Object.entries(measured)) {
        expect(cm, `${id} bob`).toBeGreaterThan(4);
        expect(cm, `${id} bob`).toBeLessThan(14);
      }
      // The bob is written as a fraction of each clip's own hip height, so it
      // should land in the same place on a tall rig and a short one. A rig
      // whose armature convention differed would fall out of this spread
      // rather than quietly measuring a pelvis that never moved.
      expect(Math.max(...values) - Math.min(...values)).toBeLessThan(2);
    }, 300_000);
  });

  describe("gait tier", () => {
    it("holds the walk clip below the band and reaches the run clip above it", async () => {
      const walk = await drive({ speedAt: () => WALK_SPEED, seconds: 4 });
      const run = await drive({ speedAt: () => RUN_SPEED, seconds: 4 });
      expect(last(walk.tiers)).toBeLessThan(0.01);
      expect(last(run.tiers)).toBeGreaterThan(0.99);
    }, 120_000);

    it("engages on every shipped rig", async () => {
      for (const id of RIGS) {
        const { tiers } = await drive({
          speedAt: () => RUN_SPEED,
          seconds: 4,
          rig: avatar(id),
        });
        expect(last(tiers), `${id} reaches the run tier`).toBeGreaterThan(0.99);
      }
    }, 300_000);

    it("stays on the walk when the pack carries no run clips", async () => {
      const { tiers, frames } = await drive({
        speedAt: () => RUN_SPEED,
        seconds: 5,
        omitClips: ["runForward", "runStrafeLeft", "runStrafeRight"],
      });
      // A pack without run coverage must behave exactly as it did before the
      // tier existed: the fraction is zero when the clip is absent, so the
      // body speed-walks rather than blending toward a clip it does not have.
      expect(last(tiers)).toBe(0);
      // And it must still be animating -- a fallback that froze the pelvis
      // would satisfy the tier check above while looking like a bug.
      expect(bobCm(frames)).toBeGreaterThan(4);
    }, 120_000);

    it("changes the shape of the gait, not only its rate", async () => {
      const walk = await drive({ speedAt: () => WALK_SPEED, seconds: 6 });
      const run = await drive({ speedAt: () => RUN_SPEED, seconds: 6 });
      // Absolute duty factor here is not the app's -- contact detection needs
      // the planter this harness omits -- but the ratio is the point. A run
      // replaces double support with flight, so its feet are down for a
      // materially smaller share of the cycle than the walk's. A speed-walk
      // driven by playback rate alone would leave this ratio near 1.
      expect(run.report.dutyFactor).toBeLessThan(
        walk.report.dutyFactor * 0.6
      );
      expect(run.report.doubleSupportFraction).toBeLessThan(
        walk.report.doubleSupportFraction + 1e-9
      );
    }, 120_000);
  });

  describe("walk to run crossover", () => {
    const RAMP_SECONDS = 8;
    const rampDrive = () =>
      drive({
        speedAt: (t) => 1.2 + (4.2 - 1.2) * Math.min(1, t / RAMP_SECONDS),
        seconds: RAMP_SECONDS + 2,
      });

    it("rises monotonically through the band it derives from the clips", async () => {
      const { tiers, speeds } = await rampDrive();
      let regressions = 0;
      for (let i = 1; i < tiers.length; i++) {
        if (tiers[i]! < tiers[i - 1]! - 1e-6) regressions++;
      }
      // Hunting between tiers would read as a body that cannot decide whether
      // it is running, so the fraction may never fall while the speed climbs.
      expect(regressions).toBe(0);
      expect(tiers[0]).toBeLessThan(0.01);
      expect(last(tiers)).toBeGreaterThan(0.99);

      const enter = tiers.findIndex((value) => value > 0.01);
      const exit = tiers.findIndex((value) => value > 0.99);
      // Derived band is 1.745 to 2.479; the commanded speed leads the blended
      // speed the animator actually sees, so the measured crossing trails it.
      expect(speeds[enter]!).toBeGreaterThan(1.4);
      expect(speeds[enter]!).toBeLessThan(2.0);
      expect(speeds[exit]!).toBeGreaterThan(2.2);
      expect(speeds[exit]!).toBeLessThan(2.9);
    }, 120_000);

    it("exchanges the two tiers without jolting a joint", async () => {
      const { report, tiers } = await rampDrive();
      const enter = tiers.findIndex((value) => value > 0.01);
      const exit = tiers.findIndex((value) => value > 0.99);
      const frameCount = tiers.length;
      const duration = report.duration;
      // Without this the filter below would grade an empty window as clean:
      // a tier that never left zero has no band to be quiet inside.
      expect(enter).toBeGreaterThan(-1);
      expect(exit).toBeGreaterThan(enter);

      // Both tiers read the same monotonic gait clock and each clip is offset
      // by its own measured left-strike phase, so a crossover should land
      // between footfalls with the two clips already agreeing on which foot is
      // down. If they did not, the tier change would teleport a leg -- and a
      // teleport is exactly what a body-local acceleration spike is.
      const inBand = report.jolts.filter((jolt) => {
        const frame = Math.round((jolt.t / Math.max(duration, 1e-6)) * frameCount);
        return frame >= enter && frame <= exit;
      });
      expect(
        inBand.map((jolt) => `${jolt.joint}@${jolt.t.toFixed(2)}s`)
      ).toEqual([]);
    }, 120_000);
  });
});
