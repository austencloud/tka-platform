import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

vi.mock(
  "$lib/shared/animation-engine/components/AnimatorCanvas.svelte",
  async () => ({
    default: (await import("./DurationPreviewAnimatorStub.svelte")).default,
  })
);

import DurationPreviewWorkspace from "./DurationPreviewWorkspace.svelte";

const sequence = {
  id: "sequence",
  name: "",
  word: "",
  steps: [1, 2, 3].map(
    (stepNumber) =>
      ({
        id: `step-${stepNumber}`,
        stepNumber,
        duration: 1,
        letter: null,
      }) as StepData
  ),
  thumbnails: [],
  isFavorite: false,
  isCircular: false,
  tags: [],
  metadata: {},
} satisfies SequenceData;

describe("DurationPreviewWorkspace changed-transition mode", () => {
  it("renders a hold-only preview without persistent controls", async () => {
    const onPreviewReady = vi.fn();

    render(DurationPreviewWorkspace, {
      sequence,
      variant: "changed-transition",
      startStep: 0,
      endStepExclusive: 3,
      changedStep: 1,
      onPreviewReady,
    });

    await expect
      .element(page.getByText("Previewing movement", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Release to return", { exact: true }))
      .toBeInTheDocument();
    expect(page.getByRole("button").elements()).toHaveLength(0);
    expect(onPreviewReady).toHaveBeenCalledOnce();
    expect(onPreviewReady).toHaveBeenCalledWith(expect.any(Number), true);
  });

  it("maps a candidate pictograph to its one-based animator motion", async () => {
    render(DurationPreviewWorkspace, {
      sequence,
      variant: "changed-transition",
      startStep: 2,
      endStepExclusive: 3,
      changedStep: 2,
      isPlaying: false,
    });

    await expect
      .element(page.getByTestId("animator"))
      .toHaveAttribute("data-current-step", "3");
  });

  it("reports completion after the bounded playback reaches its end", async () => {
    const onPlaybackComplete = vi.fn();
    const shortSequence = {
      ...sequence,
      steps: [
        {
          ...sequence.steps[0]!,
          duration: 0.001,
        },
      ],
    };

    render(DurationPreviewWorkspace, {
      sequence: shortSequence,
      variant: "changed-transition",
      startStep: 0,
      endStepExclusive: 1,
      changedStep: 0,
      onPlaybackComplete,
    });

    await vi.waitFor(() => {
      expect(onPlaybackComplete).toHaveBeenCalledOnce();
    });
  });
});
