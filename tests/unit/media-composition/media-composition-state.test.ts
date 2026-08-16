import { describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import {
  POST_STUDIO_PRESETS,
  POST_STUDIO_ROLE,
} from "$lib/shared/media-composition/domain/post-studio-presets";
import {
  createMediaCompositionState,
  type CompositionSourceBinding,
} from "$lib/shared/media-composition/state/media-composition-state.svelte";
import type { SequenceTimeMap } from "$lib/shared/media-composition/domain/sequence-time-map";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

const timeMap: SequenceTimeMap = {
  schemaVersion: 1,
  id: "mapped-performance",
  sequenceRef: { sequenceId: "sequence", contentHash: "revision" },
  mediaSourceId: "performance-video",
  anchors: [
    { mediaTimeSeconds: 0, sequencePosition: 0 },
    { mediaTimeSeconds: 6, sequencePosition: 3 },
    { mediaTimeSeconds: 12, sequencePosition: 5 },
  ],
  source: "manual",
  boundaryPolicy: "clamp",
  updatedAt: 1,
};

function readyBindings(): CompositionSourceBinding[] {
  return [
    {
      roleKey: POST_STUDIO_ROLE.performance,
      kind: "video",
      label: "Performance",
      previewUrl: "https://example.com/performance.mp4",
      renderMode: "external-media",
      durationSeconds: 12,
      status: "ready",
    },
    {
      roleKey: POST_STUDIO_ROLE.animation,
      kind: "sequence-animation",
      label: "Animation",
      previewUrl: "blob:animation",
      renderMode: "sequence-animation",
      status: "ready",
    },
    {
      roleKey: POST_STUDIO_ROLE.card,
      kind: "choreo-card",
      label: "Card",
      previewUrl: "blob:card",
      renderMode: "choreo-card",
      status: "ready",
    },
  ];
}

describe("createMediaCompositionState", () => {
  it("keeps fit edits scoped to the active preset", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      getBindings: readyBindings,
    });

    expect(state.selectedRegion?.fit).toBe("cover");
    state.setSelectedFit("contain");
    flushSync();
    expect(state.selectedRegion?.fit).toBe("contain");

    state.selectPreset("performance-breakdown");
    flushSync();
    expect(state.selectedRegion?.fit).toBe("cover");

    state.selectPreset("sequence-breakdown");
    flushSync();
    expect(state.selectedRegion?.fit).toBe("contain");
  });

  it("leaves the arrangement alone when a role is not in the active layout", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "card-focus",
      getBindings: readyBindings,
    });

    // Selecting a source used to search the other presets for one containing it
    // and switch, rearranging the post behind the user's back. Selection is now
    // selection only — an absent role is a no-op, and the way to get a source
    // into a slot is to choose it in that slot.
    state.selectRole(POST_STUDIO_ROLE.performance);
    flushSync();

    expect(state.activePresetId).toBe("card-focus");
    expect(state.selectedRegion?.id).toBe("top");
    expect(state.selectedRole).toBe(POST_STUDIO_ROLE.card);
  });

  it("keeps placement scoped to the selected layer in a shared area", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "performance-breakdown",
      getBindings: readyBindings,
    });

    state.setSelectedTransform({
      scale: 1.35,
      translateX: 0.18,
      translateY: -0.12,
      rotationDegrees: 8,
    });
    state.setSelectedOpacity(0.72);
    flushSync();

    const sharedClips = state.activePreset.clips.filter(
      (clip) => clip.kind === "visual" && clip.regionId === "top"
    );
    const performanceClip = sharedClips.find(
      (clip) => clip.sourceRole === POST_STUDIO_ROLE.performance
    );
    const animationClip = sharedClips.find(
      (clip) => clip.sourceRole === POST_STUDIO_ROLE.animation
    );
    const cardClip = state.activePreset.clips.find(
      (clip) => clip.kind === "visual" && clip.regionId === "bottom"
    );

    expect(sharedClips).toHaveLength(2);
    expect(performanceClip?.kind).toBe("visual");
    expect(
      performanceClip?.kind === "visual" && performanceClip.transform
    ).toEqual({
      scale: 1.35,
      translateX: 0.18,
      translateY: -0.12,
      rotationDegrees: 8,
    });
    expect(performanceClip?.kind === "visual" && performanceClip.opacity).toBe(
      0.72
    );
    expect(
      animationClip?.kind === "visual" && animationClip.transform.scale
    ).toBe(1);
    expect(animationClip?.kind === "visual" && animationClip.opacity).toBe(1);
    expect(cardClip?.kind === "visual" && cardClip.transform.scale).toBe(1);

    state.resetSelectedAppearance();
    flushSync();

    expect(state.selectedTransform).toEqual({
      scale: 1,
      rotationDegrees: 0,
      translateX: 0,
      translateY: 0,
    });
    expect(state.selectedOpacity).toBe(1);
  });

  it("reports required sources that have not resolved", () => {
    const bindings = readyBindings().map((binding) =>
      binding.roleKey === POST_STUDIO_ROLE.animation
        ? { ...binding, previewUrl: null, status: "missing" as const }
        : binding
    );
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      getBindings: () => bindings,
    });

    expect(state.isReady).toBe(false);
    expect(
      state.missingRequiredRoles.map((binding) => binding.roleKey)
    ).toEqual([POST_STUDIO_ROLE.animation]);
  });

  it("delegates source preparation through the injected boundary", () => {
    const requestSource = vi.fn();
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      getBindings: readyBindings,
      requestSource,
    });

    state.requestSource(POST_STUDIO_ROLE.animation);

    expect(requestSource).toHaveBeenCalledWith(POST_STUDIO_ROLE.animation);
  });

  it("follows the linked performance duration and evaluates the crossfade", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "performance-breakdown",
      getBindings: readyBindings,
    });

    expect(state.durationSeconds).toBe(12);
    state.seek(6);
    flushSync();

    expect(
      state.frameLayers.find((layer) => layer.clipId === "performance")?.opacity
    ).toBeCloseTo(0.5);
    expect(
      state.frameLayers.find(
        (layer) => layer.clipId === "performance-animation"
      )?.opacity
    ).toBeCloseTo(0.5);
  });

  it("derives sequence-only duration from weighted motion units and tempo", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "sequence-breakdown",
      getBindings: readyBindings,
      getSequenceSteps: () =>
        [
          { duration: 1 },
          { duration: 2 },
          { duration: 0.5 },
          { duration: 1.5 },
        ] as unknown as StepData[],
    });

    expect(state.tempoBpm).toBe(60);
    expect(state.durationSeconds).toBe(6);

    state.setTempoBpm(120);
    flushSync();

    expect(state.tempoBpm).toBe(120);
    expect(state.durationSeconds).toBe(3);
  });

  it("saves the chosen sequence tempo with a reusable layout", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "motion-focus",
      getBindings: readyBindings,
      getSequenceSteps: () => [{ duration: 1 }] as unknown as StepData[],
    });

    state.setTempoBpm(90);
    const saved = state.createPreset("Ninety BPM motion", "owner-1");

    expect(saved.duration).toEqual({ mode: "sequence-tempo", bpm: 90 });
  });

  it("reports fit support only when the selected area contains external media", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "sequence-breakdown",
      getBindings: readyBindings,
    });

    expect(state.selectedSupportsFit).toBe(false);
    state.selectPreset("performance-breakdown");
    flushSync();
    expect(state.selectedSupportsFit).toBe(true);
    expect(state.selectedBinding?.roleKey).toBe(POST_STUDIO_ROLE.performance);

    state.selectRole(POST_STUDIO_ROLE.animation);
    flushSync();
    expect(state.selectedRegion?.id).toBe("top");
    expect(state.selectedRole).toBe(POST_STUDIO_ROLE.animation);
    expect(state.selectedSupportsFit).toBe(false);

    state.selectRegion("bottom");
    flushSync();
    expect(state.selectedSupportsFit).toBe(false);
  });

  it("keeps every sequence-derived layer on the same mapped position", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "performance-breakdown",
      getBindings: readyBindings,
      getSequenceTimeMap: () => timeMap,
      getSequenceSteps: () =>
        [
          { duration: 1 },
          { duration: 1 },
          { duration: 1 },
          { duration: 1 },
        ] as unknown as StepData[],
    });

    state.seek(6);
    flushSync();

    expect(state.frameLayers).toHaveLength(3);
    expect(
      new Set(state.frameLayers.map((layer) => layer.sequencePosition))
    ).toEqual(new Set([3]));
  });

  it("edits clip boundaries while preserving a valid crossfade overlap", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "performance-breakdown",
      getBindings: readyBindings,
    });

    state.setClipBoundary("performance", "end", 4);
    flushSync();

    const performance = state.activePreset.clips.find(
      (clip) => clip.id === "performance"
    )!;
    const animation = state.activePreset.clips.find(
      (clip) => clip.id === "performance-animation"
    )!;
    const transition = state.activePreset.transitions[0]!;

    expect(performance.end.value).toBeGreaterThan(animation.start.value);
    expect(transition.start.value).toBe(animation.start.value);
    expect(transition.end.value).toBe(performance.end.value);
  });

  it("loops playback and stops when a preset changes", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "card-focus",
      getBindings: readyBindings,
    });

    state.togglePlayback();
    state.advance(4.9);
    flushSync();
    expect(state.previewSeconds).toBeCloseTo(4.9);

    state.advance(0.2);
    flushSync();
    expect(state.previewSeconds).toBe(0);
    expect(state.isPlaying).toBe(true);

    state.selectPreset("sequence-breakdown");
    flushSync();
    expect(state.previewSeconds).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it("snapshots edited structure as a reusable role-bound preset", () => {
    const state = createMediaCompositionState({
      presets: POST_STUDIO_PRESETS,
      initialPresetId: "performance-breakdown",
      getBindings: readyBindings,
    });

    state.setSelectedFit("contain");
    state.setClipBoundary("performance", "end", 4);
    const saved = state.createPreset("My breakdown", "owner-1");
    state.addPreset(saved, true);
    flushSync();

    expect(saved.ownerId).toBe("owner-1");
    expect(saved.name).toBe("My breakdown");
    expect(saved.sourceRoles.map((role) => role.key)).toEqual([
      POST_STUDIO_ROLE.performance,
      POST_STUDIO_ROLE.animation,
      POST_STUDIO_ROLE.card,
    ]);
    expect(saved.regions[0]?.fit).toBe("contain");
    expect(state.activePresetId).toBe(saved.id);
    expect(state.presets).toHaveLength(POST_STUDIO_PRESETS.length + 1);
  });
});
