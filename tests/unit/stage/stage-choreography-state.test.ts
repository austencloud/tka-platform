import { describe, expect, it } from "vitest";

import { createStageChoreographyState } from "$lib/features/stage/state/stage-choreography-state.svelte";
import { sampleStagePerformance } from "$lib/features/stage/domain/stage-performance-sampler";
import { sampleStageFormations } from "$lib/features/stage/domain/stage-formation-sampler";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";

function sequence(id: string, word: string, stepCount: number): SequenceData {
  return {
    id,
    word,
    name: word,
    steps: Array.from({ length: stepCount }, () => ({})),
  } as unknown as SequenceData;
}

describe("stage choreography state", () => {
  it("creates isolated Stage documents with two sequence clips per performer", () => {
    const first = createStageChoreographyState();
    const second = createStageChoreographyState();

    expect(first.choreography.id).not.toBe(second.choreography.id);
    expect(first.choreography.performers).toHaveLength(4);
    expect(
      first.choreography.performers.every(
        (performer) => performer.sequenceClips.length === 2
      )
    ).toBe(true);
    expect(first.maxTotalBeats).toBe(16);

    first.destroy();
    second.destroy();
  });

  it("adds a library sequence to one performer without changing other lanes", () => {
    const state = createStageChoreographyState();
    const [first, second] = state.choreography.performers;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const added = state.addSequenceClip(
      first!.id,
      sequence("sequence-new", "NEW", 6),
      16
    );

    expect(added).toMatchObject({
      sequenceId: "sequence-new",
      label: "NEW",
      startBeat: 16,
      durationBeats: 6,
      sourceBeatCount: 6,
    });
    expect(first!.sequenceClips).toHaveLength(3);
    expect(second!.sequenceClips).toHaveLength(2);
    expect(state.maxTotalBeats).toBe(22);
    state.destroy();
  });

  it("moves, resizes, loops, removes, and undoes a clip", () => {
    const state = createStageChoreographyState();
    const performer = state.choreography.performers[0]!;
    const target = performer.sequenceClips[1]!;

    state.moveSequenceClip(target.id, 10.25);
    state.resizeSequenceClip(target.id, 5.5);
    state.toggleSequenceClipLoop(target.id);

    expect(target).toMatchObject({
      startBeat: 10.25,
      durationBeats: 5.5,
      loop: true,
    });

    state.removeSequenceClip(target.id);
    expect(performer.sequenceClips.some((clip) => clip.id === target.id)).toBe(
      false
    );
    state.undo();
    expect(
      state.choreography.performers[0]!.sequenceClips.some(
        (clip) => clip.id === target.id
      )
    ).toBe(true);
    state.destroy();
  });

  it("derives a formation track that samples identically to the marks", () => {
    const state = createStageChoreographyState();
    const { formations } = state.choreography;

    expect(formations.length).toBeGreaterThan(0);
    expect(formations[0]!.atBeat).toBe(0);
    expect(formations[0]!.transitionBeats).toBe(0);
    for (let i = 1; i < formations.length; i += 1) {
      const previous = formations[i - 1]!;
      const formation = formations[i]!;
      expect(formation.atBeat).toBeGreaterThan(previous.atBeat);
      expect(formation.transitionBeats).toBeLessThanOrEqual(
        formation.atBeat - previous.atBeat
      );
      for (const performer of state.choreography.performers) {
        expect(formation.spots[performer.id]).toBeDefined();
      }
    }

    for (const beat of [0, 2, 4, 7.5, 8, 12]) {
      const viaMarks = sampleStagePerformance(state.choreography, beat);
      const viaFormations = sampleStageFormations(state.choreography, beat);
      viaFormations.forEach((frame, index) => {
        const expected = viaMarks[index]!;
        expect(frame.stagePosition.x).toBeCloseTo(expected.stagePosition.x, 6);
        expect(frame.stagePosition.z).toBeCloseTo(expected.stagePosition.z, 6);
        expect(frame.bodyFacing).toBeCloseTo(expected.bodyFacing, 6);
      });
    }

    state.destroy();
  });

  it("keeps the Stage environment in the document and its undo history", () => {
    const state = createStageChoreographyState({
      initialEnvironmentId: SceneEnvironmentId.BLOSSOM,
    });

    expect(state.choreography.environmentId).toBe(SceneEnvironmentId.BLOSSOM);
    state.setEnvironmentId(SceneEnvironmentId.OCEAN);
    expect(state.choreography.environmentId).toBe(SceneEnvironmentId.OCEAN);

    state.undo();
    expect(state.choreography.environmentId).toBe(SceneEnvironmentId.BLOSSOM);
    state.redo();
    expect(state.choreography.environmentId).toBe(SceneEnvironmentId.OCEAN);
    state.destroy();
  });

  it("adds a complete formation without moving anyone at that beat", () => {
    const state = createStageChoreographyState();
    const beat = 4;
    const before = sampleStageFormations(state.choreography, beat);

    const added = state.addFormation(beat);

    expect(added).not.toBeNull();
    for (const frame of before) {
      expect(added?.spots[frame.performerId]?.x).toBeCloseTo(
        frame.stagePosition.x,
        6
      );
      expect(added?.spots[frame.performerId]?.z).toBeCloseTo(
        frame.stagePosition.z,
        6
      );
    }
    expect(state.addFormation(beat)).toBeNull();
    state.destroy();
  });

  it("clamps transitions against the previous formation", () => {
    const state = createStageChoreographyState();
    const formation = state.addFormation(12);
    expect(formation).not.toBeNull();

    state.setFormationTransitionBeats(formation!.id, 20.7);

    expect(
      state.choreography.formations.find(
        (candidate) => candidate.id === formation!.id
      )?.transitionBeats
    ).toBe(4);
    state.destroy();
  });

  it("does not remove or retime the opening formation", () => {
    const state = createStageChoreographyState();
    const opening = state.choreography.formations[0]!;

    state.removeFormation(opening.id);
    state.moveFormation(opening.id, 6);

    expect(state.choreography.formations[0]).toMatchObject({
      id: opening.id,
      atBeat: 0,
      transitionBeats: 0,
    });
    state.destroy();
  });

  it("re-sorts a moved formation", () => {
    const state = createStageChoreographyState();
    const later = state.addFormation(16);
    expect(later).not.toBeNull();

    state.moveFormation(later!.id, 4);

    expect(
      state.choreography.formations.map((formation) => formation.atBeat)
    ).toEqual([0, 4, 8]);
    expect(state.choreography.formations[1]?.id).toBe(later!.id);
    state.destroy();
  });

  it("round-trips a formation edit through undo and redo", () => {
    const state = createStageChoreographyState();
    const formation = state.choreography.formations[1]!;
    const performer = state.choreography.performers[0]!;
    const originalX = formation.spots[performer.id]!.x;

    // A spot drag is one history entry: beginDrag() pushes it, and the moves
    // that follow do not, exactly as mark dragging works.
    state.beginDrag();
    state.updateSpotPosition(formation.id, performer.id, originalX + 1, 2);
    state.updateSpotPosition(formation.id, performer.id, originalX + 1, 2);
    expect(state.choreography.formations[1]!.spots[performer.id]!.x).toBe(
      originalX + 1
    );

    state.undo();
    expect(state.choreography.formations[1]!.spots[performer.id]!.x).toBe(
      originalX
    );
    state.redo();
    expect(state.choreography.formations[1]!.spots[performer.id]!.x).toBe(
      originalX + 1
    );
    state.destroy();
  });

  it("keeps every formation complete when performer count changes", () => {
    const state = createStageChoreographyState();
    state.addFormation(16, "circle");

    state.setPerformerCount(6);
    const sixIds = state.choreography.performers.map(
      (performer) => performer.id
    );
    expect(
      state.choreography.formations.every((formation) =>
        sixIds.every((performerId) => formation.spots[performerId])
      )
    ).toBe(true);

    const removedIds = sixIds.slice(2);
    state.setPerformerCount(2);
    expect(
      state.choreography.formations.every((formation) =>
        removedIds.every((performerId) => !formation.spots[performerId])
      )
    ).toBe(true);
    state.destroy();
  });
});
