import { describe, expect, it } from "vitest";
import { Group, Vector3, type Object3D } from "three";
import { LocomotionAnimator } from "@austencloud/scene-3d";

import {
  ALL_RIGS,
  avatar,
  avatarAssetsPresent,
  driveRig,
  loadPackClips,
  loadRig,
} from "./locomotion-harness";

/**
 * The walking pelvis has to sit low enough for the flat foot to reach the
 * floor the rig stands on.
 *
 * The pack's walk clips are re-anchored at the rig's rest height, which
 * discards the dip a walk is authored with, so before this contract every
 * shipped rig walked with its lowest ankle four centimetres above its bind
 * ankle, and the planter (which never drags the pelvis down by design) held
 * the toe down instead: a hovering heel and a toe pushing through the floor.
 * Worse, the gait probe measured the clips with the pelvis zeroed for
 * binding, so its sole offsets came out as 0 and the planter ran on default
 * offsets that matched no rig.
 *
 * Numbers below are measured on the shipped rigs (2026-09-06, headless
 * 60 Hz harness): walk dip 0.012-0.026 (backward the deepest), run dip 0.044-0.057, lowest planted
 * ankle at 1.2 m/s within 0.004-0.013 of the bind ankle. Pre-fix the ankle gap
 * was 0.039-0.043 on every rig.
 */

const WALK_DROP = { min: 0.01, max: 0.03 };
const RUN_DROP = { min: 0.04, max: 0.062 };
const ANKLE_GAP_MAX = 0.02;
const DRIVEN_RIGS = ["ch01", "ch07", "ch12", "ch21"];

function bindAnkleY(scene: Object3D): number {
  scene.updateMatrixWorld(true);
  const probe = new Vector3();
  let floor = Infinity;
  scene.traverse((node) => {
    if (node.name.endsWith("LeftFoot") || node.name.endsWith("RightFoot")) {
      floor = Math.min(floor, node.getWorldPosition(probe).y);
    }
  });
  return floor;
}

async function bootAnimator(id: string) {
  const clips = await loadPackClips();
  const rig = await loadRig(avatar(id));
  const travel = new Group();
  travel.add(rig.scene);
  const animator = new LocomotionAnimator();
  const seam = animator as unknown as {
    pendingClips: Map<string, unknown>;
    clipsLoaded: boolean;
    gaits: Record<string, { pelvisDrop: number } | null>;
    hipsBone: { position: Vector3 } | null;
    hipsRest: Vector3 | null;
  };
  seam.pendingClips = new Map(clips);
  seam.clipsLoaded = true;
  animator.initialize(rig.scene);
  return { animator, seam, bindAnkle: bindAnkleY(rig.scene) };
}

describe.skipIf(!avatarAssetsPresent())("locomotion pelvis drop", () => {
  it("measures every shipped rig's sole at its bind ankle and a walking dip on each gait", async () => {
    for (const id of ALL_RIGS) {
      const { animator, seam, bindAnkle } = await bootAnimator(id);
      // The probe now runs with the rest height on, so the sole is the rig's own.
      expect(animator.getSoleOffset(), `${id} sole`).toBeCloseTo(bindAnkle, 3);
      for (const key of ["forward", "backward", "strafeLeft", "strafeRight"]) {
        const drop = seam.gaits[key]?.pelvisDrop ?? -1;
        expect(drop, `${id} ${key} pelvisDrop`).toBeGreaterThanOrEqual(WALK_DROP.min);
        expect(drop, `${id} ${key} pelvisDrop`).toBeLessThanOrEqual(WALK_DROP.max);
      }
      const run = seam.gaits.runForward?.pelvisDrop ?? -1;
      expect(run, `${id} runForward pelvisDrop`).toBeGreaterThanOrEqual(RUN_DROP.min);
      expect(run, `${id} runForward pelvisDrop`).toBeLessThanOrEqual(RUN_DROP.max);
    }
  }, 180_000);

  it("lowers the pelvis by the walk dip while moving and holds rest height when still", async () => {
    const { animator, seam } = await bootAnimator("ch01");
    const rest = seam.hipsRest!.y;
    for (let i = 0; i < 240; i++) {
      animator.setLocomotion({ isMoving: false, speed: 0, moveDirection: { x: 0, z: 0 } });
      animator.update(1 / 60);
    }
    expect(seam.hipsBone!.position.y).toBeCloseTo(rest, 2);
    for (let i = 0; i < 240; i++) {
      animator.setLocomotion({ isMoving: true, speed: 1.2, moveDirection: { x: 0, z: 1 } });
      animator.update(1 / 60);
    }
    const walkDrop = seam.gaits.forward!.pelvisDrop;
    // The clip's own bob rides on top, so allow the bob but demand the dip.
    expect(rest - seam.hipsBone!.position.y).toBeGreaterThan(walkDrop * 0.5);
    expect(rest - seam.hipsBone!.position.y).toBeLessThan(walkDrop + 0.05);
  }, 60_000);

  it("plants the lowest ankle of a walk on the rig's own floor", async () => {
    await loadPackClips();
    for (const id of DRIVEN_RIGS) {
      const bindAnkle = bindAnkleY((await loadRig(avatar(id))).scene);
      const run = await driveRig({
        speedAt: () => 1.2,
        seconds: 6,
        rig: avatar(id),
        planting: true,
      });
      const ankleMin = Math.min(
        ...run.frames.map((f) => Math.min(f.left.ankle.y, f.right.ankle.y))
      );
      const toeMin = Math.min(
        ...run.frames.map((f) => Math.min(f.left.toe?.y ?? 9, f.right.toe?.y ?? 9))
      );
      expect(ankleMin - bindAnkle, `${id} ankle gap`).toBeLessThan(ANKLE_GAP_MAX);
      expect(ankleMin - bindAnkle, `${id} ankle gap`).toBeGreaterThan(-0.005);
      expect(toeMin, `${id} toe floor`).toBeGreaterThan(-0.005);
    }
  }, 300_000);
});
