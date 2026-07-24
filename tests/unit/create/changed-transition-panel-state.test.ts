import { afterEach, describe, expect, it } from "vitest";
import { effect_root } from "svelte/internal/client";
import {
  createPanelCoordinationState,
  type PanelCoordinationState,
} from "$lib/shared/create/state/panel-coordination-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function createState(): PanelCoordinationState {
  let state!: PanelCoordinationState;
  cleanup = effect_root(() => {
    state = createPanelCoordinationState();
  });
  return state;
}

const sequence = {
  id: "sequence",
  name: "",
  word: "",
  steps: [{ id: "step-1", stepNumber: 1 } as StepData],
  thumbnails: [],
  isFavorite: false,
  isCircular: false,
  tags: [],
  metadata: {},
} satisfies SequenceData;

describe("changed transition panel state", () => {
  it("restarts repeated trials with a new request identity", () => {
    const state = createState();
    const request = {
      sequence,
      sourceSequenceRevision: 1,
      stepNumber: 1,
      activatedAt: 10,
    };

    state.enterChangedTransitionPlayback(request);
    const firstId = state.changedTransitionPlayback?.requestId;
    state.enterChangedTransitionPlayback(request);

    expect(state.changedTransitionPlayback?.requestId).toBe((firstId ?? 0) + 1);
  });

  it("keeps duration and changed-transition previews mutually exclusive", () => {
    const state = createState();

    state.enterDurationPreviewMode(sequence);
    state.enterChangedTransitionPlayback({
      sequence,
      sourceSequenceRevision: 1,
      stepNumber: 1,
      activatedAt: 10,
    });

    expect(state.isDurationPreviewMode).toBe(false);
    expect(state.previewSequence).toBeNull();
    expect(state.changedTransitionPlayback?.stepNumber).toBe(1);

    state.enterDurationPreviewMode(sequence);
    expect(state.changedTransitionPlayback).toBeNull();
  });

  it("clears the temporary preview when the hold ends", () => {
    const state = createState();

    state.enterChangedTransitionPlayback({
      sequence,
      sourceSequenceRevision: 1,
      stepNumber: 1,
      activatedAt: 10,
    });
    state.exitChangedTransitionPlayback();
    expect(state.changedTransitionPlayback).toBeNull();
  });
});
