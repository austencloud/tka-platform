import { describe, it, expect } from "vitest";
import { createCollisionLabState } from "$lib/features/lab/tabs/collision-lab/state/collision-lab-state.svelte";
import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import type {
  PoseLabel,
  CollisionSnapshot,
} from "$lib/features/lab/tabs/collision-lab/domain/types";
import type { IPoseLabelRepository } from "$lib/features/lab/tabs/collision-lab/services/contracts/IPoseLabelRepository";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

class InMemoryLabelRepo implements IPoseLabelRepository {
  store: Record<string, PoseLabel> = {};
  async loadAll() {
    return { ...this.store };
  }
  save(labels: Record<string, PoseLabel>): void {
    this.store = { ...labels };
  }
  exportJson(): void {
    /* no-op for tests */
  }
}

async function setup() {
  const enumerator = new DiamondPoseEnumerator();
  const repo = new InMemoryLabelRepo();
  const state = await createCollisionLabState(enumerator, repo);
  return { state, repo };
}

describe("collision-lab-state", () => {
  it("exposes all 192 poses on creation", async () => {
    const { state } = await setup();
    expect(state.allPoses.length).toBe(192);
    expect(state.filteredPoses.length).toBe(192);
    expect(state.cursorIndex).toBe(0);
    expect(state.currentPose?.id).toBe(state.allPoses[0]!.id);
  });

  it("stepForward / stepBackward move the cursor within bounds", async () => {
    const { state } = await setup();
    state.stepForward();
    expect(state.cursorIndex).toBe(1);
    state.stepBackward();
    expect(state.cursorIndex).toBe(0);
    state.stepBackward(); // clamps
    expect(state.cursorIndex).toBe(0);
  });

  it("jumpTo clamps out-of-range values", async () => {
    const { state } = await setup();
    state.jumpTo(9999);
    expect(state.cursorIndex).toBe(state.filteredPoses.length - 1);
    state.jumpTo(-5);
    expect(state.cursorIndex).toBe(0);
  });

  it("setPlaneFilter restricts filteredPoses and resets cursor", async () => {
    const { state } = await setup();
    state.stepForward();
    state.stepForward();
    state.setPlaneFilter(Plane.WALL);
    expect(state.cursorIndex).toBe(0);
    expect(state.filteredPoses.every((p) => p.plane === Plane.WALL)).toBe(true);
    expect(state.filteredPoses.length).toBe(64);
  });

  it("labelCurrent writes a label and auto-advances on 'clear'", async () => {
    const { state, repo } = await setup();
    const firstId = state.currentPose!.id;
    state.labelCurrent("clear");
    expect(repo.store[firstId]?.status).toBe("clear");
    expect(state.cursorIndex).toBe(1);
  });

  it("labelCurrent does NOT auto-advance on 'needs-adjustment'", async () => {
    const { state } = await setup();
    state.labelCurrent("needs-adjustment");
    expect(state.cursorIndex).toBe(0);
  });

  it("labelCurrent does NOT auto-advance on 'skip'", async () => {
    const { state } = await setup();
    state.labelCurrent("skip");
    expect(state.cursorIndex).toBe(0);
  });

  it("labelCurrent captures the live stance values and collision snapshot", async () => {
    const { state, repo } = await setup();
    state.setFootOffsetX(0.15);
    state.setFootOffsetZ(-0.2);
    state.setRootYawRad(0.3);
    state.setSpinePitchRad(0.1);
    const snapshot: CollisionSnapshot = {
      severity: "clip",
      zones: [
        { type: "arm-through-face", depthCm: 3.2, description: "L forearm → face" },
      ],
    };
    state.updateCollision(snapshot);
    const id = state.currentPose!.id;
    state.labelCurrent("needs-adjustment");
    expect(repo.store[id]?.stance).toEqual({
      footOffsetX: 0.15,
      footOffsetZ: -0.2,
      rootYawRad: 0.3,
      spinePitchRad: 0.1,
    });
    expect(repo.store[id]?.collisionSnapshot?.severity).toBe("clip");
  });

  it("stepping onto a pose with a prior label seeds the stance sliders", async () => {
    const { state } = await setup();
    // Label pose 0 with a non-default stance
    state.setFootOffsetX(0.25);
    state.setFootOffsetZ(-0.1);
    state.labelCurrent("needs-adjustment"); // no auto-advance
    // Walk away and back
    state.stepForward(); // cursor at 1, stance reset
    expect(state.footOffsetX).toBe(0);
    state.stepBackward(); // cursor back at 0, stance reseeded from label
    expect(state.footOffsetX).toBe(0.25);
    expect(state.footOffsetZ).toBe(-0.1);
  });

  it("resetStance returns all axes to zero", async () => {
    const { state } = await setup();
    state.setFootOffsetX(0.4);
    state.setSpinePitchRad(0.2);
    state.resetStance();
    expect(state.footOffsetX).toBe(0);
    expect(state.footOffsetZ).toBe(0);
    expect(state.rootYawRad).toBe(0);
    expect(state.spinePitchRad).toBe(0);
  });

  it("progress counts reflect labeled poses", async () => {
    const { state } = await setup();
    expect(state.progress.labeled).toBe(0);
    state.labelCurrent("clear"); // advances to 1
    state.labelCurrent("clear"); // advances to 2
    expect(state.progress.labeled).toBe(2);
    expect(state.progress.clear).toBe(2);
  });
});
