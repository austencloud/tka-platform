import { describe, expect, it } from "vitest";

import { createStageChoreographyState } from "$lib/features/stage/state/stage-choreography-state.svelte";
import { sampleStageFormations } from "$lib/features/stage/domain/stage-formation-sampler";
import { generatePresetPositions } from "$lib/features/stage/state/formation-presets";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { SceneEnvironmentId } from "$lib/shared/3d/environments/domain/scene-environment";
import {
  STUDIO_PROJECT_SCHEMA,
  STUDIO_PROJECT_VERSION,
} from "$lib/features/stage/domain/studio-project";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

function sequence(id: string, word: string, stepCount: number): SequenceData {
  return {
    id,
    word,
    name: word,
    steps: Array.from({ length: stepCount }, () => ({})),
  } as unknown as SequenceData;
}

describe("stage choreography state", () => {
  it("seeds the same versioned Stage project for a guided solo start", () => {
    const state = createStageChoreographyState();

    state.applyStudioStarter({
      startingMaterial: "choose-sequence",
      performerCount: 1,
      formation: "solo",
      environmentId: SceneEnvironmentId.FOREST,
      prop: PropType.POI,
    });

    expect(state.studioProject).toMatchObject({
      schema: STUDIO_PROJECT_SCHEMA,
      version: STUDIO_PROJECT_VERSION,
      stage: {
        environmentId: SceneEnvironmentId.FOREST,
        sharedSequenceId: "tnd-quarter-opp-mpmp",
      },
    });
    expect(state.choreography.performers).toHaveLength(1);
    expect(state.choreography.formations).toHaveLength(1);
    expect(state.choreography.formations[0]).toMatchObject({
      atBeat: 0,
      presetId: "solo",
    });

    state.undo();
    expect(state.choreography.performers).toHaveLength(3);
    state.destroy();
  });

  it("seeds an exact six-person circle from the guided Studio start", () => {
    const state = createStageChoreographyState();

    state.applyStudioStarter({
      startingMaterial: "recommended",
      performerCount: 6,
      formation: "circle",
      environmentId: SceneEnvironmentId.COSMIC,
      prop: PropType.FAN,
    });

    expect(state.choreography.performers).toHaveLength(6);
    expect(state.choreography.formations).toHaveLength(1);
    expect(state.choreography.formations[0]?.presetId).toBe("circle");
    expect(
      Object.keys(state.choreography.formations[0]?.spots ?? {})
    ).toHaveLength(6);
    expect(
      Object.values(state.choreography.formations[0]?.spots ?? {}).every(
        (spot) => Number.isFinite(spot.facingAngle)
      )
    ).toBe(true);
    expect(state.studioProject.version).toBe(STUDIO_PROJECT_VERSION);
    expect(state.studioProject.stage).toBe(state.choreography);
    state.destroy();
  });

  it("authors relational facing for duo presets and clears it for a line", () => {
    const faceToFace = generatePresetPositions("facing-each-other", 2, 10, 8);
    const backToBack = generatePresetPositions("back-to-back", 2, 10, 8);
    const sideBySide = generatePresetPositions("side-by-side", 2, 10, 8);

    expect(faceToFace.map((spot) => spot.facingAngle)).toEqual([Math.PI, 0]);
    expect(backToBack.map((spot) => spot.facingAngle)).toEqual([0, Math.PI]);
    expect(sideBySide.every((spot) => spot.facingAngle === undefined)).toBe(
      true
    );

    const state = createStageChoreographyState();
    state.applyStudioStarter({
      startingMaterial: "recommended",
      performerCount: 2,
      formation: "facing-each-other",
      environmentId: SceneEnvironmentId.EMBER,
      prop: PropType.STAFF,
    });
    const opening = state.choreography.formations[0]!;
    expect(
      Object.values(opening.spots).map((spot) => spot.facingAngle)
    ).toEqual([Math.PI, 0]);

    state.applyPresetToFormation(opening.id, "side-by-side");
    expect(
      Object.values(opening.spots).every(
        (spot) => spot.facingAngle === undefined
      )
    ).toBe(true);
    state.destroy();
  });

  it("creates isolated Stage documents holding one lane across the show", () => {
    const first = createStageChoreographyState();
    const second = createStageChoreographyState();

    expect(first.choreography.id).not.toBe(second.choreography.id);
    expect(first.choreography.performers).toHaveLength(3);
    expect(
      first.choreography.performers.every(
        (performer) => performer.sequenceClips.length === 1
      )
    ).toBe(true);
    expect(first.maxTotalBeats).toBe(64);

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

    // The opening clip already covers counts 0-64, so a clip dropped inside it
    // lands after it rather than on top of it. Clips carry no label of their
    // own: the timeline reads the word off the resolved sequence.
    expect(added).toMatchObject({
      sequenceId: "sequence-new",
      startBeat: 64,
      durationBeats: 6,
      sourceBeatCount: 6,
    });
    expect(added).not.toHaveProperty("label");
    expect(first!.sequenceClips).toHaveLength(2);
    expect(second!.sequenceClips).toHaveLength(1);
    // The show is as long as its longest lane, so a clip landing after the
    // opening one extends it: 64 counts plus the six this clip adds.
    expect(state.maxTotalBeats).toBe(70);
    state.destroy();
  });

  it("moves, resizes, loops, removes, and undoes a clip", () => {
    const state = createStageChoreographyState();
    const performer = state.choreography.performers[0]!;
    const target = performer.sequenceClips[0]!;

    state.moveSequenceClip(target.id, 10.25);
    state.resizeSequenceClip(target.id, 5.5);
    state.toggleSequenceClipLoop(target.id);

    // The opening clip loops so a short sequence fills the whole show; the
    // toggle is what turns that off.
    expect(target).toMatchObject({
      startBeat: 10.25,
      durationBeats: 5.5,
      loop: false,
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

  it("opens on a line, a triangle, and that triangle reversed", () => {
    const state = createStageChoreographyState();
    const { formations, performers, stageWidth, stageDepth } =
      state.choreography;
    const line = generatePresetPositions(
      "line",
      performers.length,
      stageWidth,
      stageDepth
    );
    const triangle = generatePresetPositions(
      "triangle",
      performers.length,
      stageWidth,
      stageDepth
    );
    const triangleMeanZ =
      triangle.reduce((total, point) => total + point.z, 0) / triangle.length;
    const spotsFor = (positions: typeof line) =>
      Object.fromEntries(
        performers.map((performer, index) => [
          performer.id,
          {
            ...positions[index]!,
            walkStyle: "direct",
            easing: "easeInOut",
          },
        ])
      );

    expect(formations).toEqual([
      {
        id: "default-formation-0",
        atBeat: 0,
        transitionBeats: 0,
        spots: spotsFor(line),
        presetId: "line",
      },
      {
        id: "default-formation-32",
        atBeat: 32,
        transitionBeats: 16,
        spots: spotsFor(triangle),
        presetId: "triangle",
      },
      {
        id: "default-formation-64",
        atBeat: 64,
        transitionBeats: 16,
        spots: spotsFor(
          triangle.map((point) => ({
            x: point.x,
            z: 2 * triangleMeanZ - point.z,
          }))
        ),
      },
    ]);

    state.destroy();
  });

  it("turns the closing triangle inside out over the last sixteen counts", () => {
    const state = createStageChoreographyState();
    const { performers } = state.choreography;
    const at = (beat: number) =>
      sampleStageFormations(state.choreography, beat);

    const held = at(48);
    const arrived = at(64);
    const downstageIndex = held.reduce(
      (nearest, frame, index) =>
        frame.stagePosition.z < held[nearest]!.stagePosition.z
          ? index
          : nearest,
      0
    );

    // The performer nearest the audience walks away from it; whoever was
    // furthest upstage walks toward it. That is the reverse triangle.
    expect(arrived[downstageIndex]!.stagePosition.z).toBeGreaterThan(
      held[downstageIndex]!.stagePosition.z
    );

    // Mirrored through the triangle's OWN mean depth, so the shape turns
    // inside out where it stands instead of being thrown across the stage.
    // Nobody drifts sideways doing it.
    const meanZ =
      held.reduce((total, frame) => total + frame.stagePosition.z, 0) /
      held.length;
    for (const [index, frame] of held.entries()) {
      expect(arrived[index]!.stagePosition.z).toBeCloseTo(
        2 * meanZ - frame.stagePosition.z,
        6
      );
      expect(arrived[index]!.stagePosition.x).toBeCloseTo(
        frame.stagePosition.x,
        6
      );
      // The demo is only a demo if every performer walks. A cast whose middle
      // rank sits on the mean depth turns inside out without moving.
      expect(arrived[index]!.stagePosition.z).not.toBeCloseTo(
        frame.stagePosition.z,
        3
      );
    }

    // Nothing moves before the walk starts, and everyone is walking inside it.
    expect(at(47).every((frame) => !frame.isMoving)).toBe(true);
    expect(at(56).every((frame) => frame.isMoving)).toBe(true);
    expect(performers).toHaveLength(3);
    state.destroy();
  });

  it("reads staging at a count off the formation track", () => {
    const state = createStageChoreographyState();
    const secondFormation = state.choreography.formations[1]!;
    const stagingAt = (beat: number) =>
      sampleStageFormations(state.choreography, beat).map(
        ({ stagePosition }) => ({ ...stagePosition })
      );

    // Count 24 sits inside the walk into the second set, which arrives on 32
    // over sixteen counts.
    const beforeMove = stagingAt(24);

    state.moveFormation(secondFormation.id, 12);

    // Arriving on 12 clamps the walk to the twelve counts since the opening
    // set, so by 24 that walk is long over and everyone is holding the shape.
    expect(
      state.choreography.formations.map((formation) => formation.atBeat)
    ).toEqual([0, 12, 64]);
    expect(state.choreography.formations[1]!.transitionBeats).toBe(12);
    expect(stagingAt(24)).not.toEqual(beforeMove);
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

    // A set arriving on 12 cannot walk for longer than the twelve counts since
    // the opening set.
    expect(
      state.choreography.formations.find(
        (candidate) => candidate.id === formation!.id
      )?.transitionBeats
    ).toBe(12);
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
    ).toEqual([0, 4, 32, 64]);
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
