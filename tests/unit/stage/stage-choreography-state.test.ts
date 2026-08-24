import { describe, expect, it } from "vitest";

import { createStageChoreographyState } from "$lib/features/stage/state/stage-choreography-state.svelte";
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

  it("keeps the Stage environment in the document and its undo history", () => {
    const state = createStageChoreographyState({
      initialEnvironmentId: SceneEnvironmentId.BLOSSOM,
    });

    expect(state.choreography.environmentId).toBe(
      SceneEnvironmentId.BLOSSOM
    );
    state.setEnvironmentId(SceneEnvironmentId.OCEAN);
    expect(state.choreography.environmentId).toBe(SceneEnvironmentId.OCEAN);

    state.undo();
    expect(state.choreography.environmentId).toBe(
      SceneEnvironmentId.BLOSSOM
    );
    state.redo();
    expect(state.choreography.environmentId).toBe(SceneEnvironmentId.OCEAN);
    state.destroy();
  });
});
