import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

vi.mock(
  "$lib/shared/pictograph/shared/components/PictographContainer.svelte",
  async () => ({
    default: (await import("./PictographArrivalContainerStub.svelte")).default,
  })
);

import PictographArrivalStage from "./PictographArrivalStage.svelte";

const firstStep = {
  id: "step-1",
  stepNumber: 1,
  duration: 1,
} as StepData;
const candidateStep = {
  id: "candidate-step",
  stepNumber: 2,
  duration: 1,
} as StepData;
const sequence = {
  id: "sequence",
  name: "",
  word: "",
  steps: [firstStep, candidateStep],
  thumbnails: [],
  isFavorite: false,
  isCircular: false,
  tags: [],
  metadata: {},
} satisfies SequenceData;

describe("PictographArrivalStage audition", () => {
  it("animates from the preceding beat and holds without landing", async () => {
    const onBeginLanding = vi.fn();
    const onBeginHandoff = vi.fn();
    const onComplete = vi.fn();
    const onMotionComplete = vi.fn();

    render(PictographArrivalStage, {
      request: {
        intent: "audition",
        stepIndex: 1,
        requestId: 7,
        owner: "stage",
        phase: "preview",
      },
      sequence,
      getDestinationRect: () => null,
      onBeginLanding,
      onBeginHandoff,
      onComplete,
      onMotionComplete,
    });

    await expect
      .element(page.getByTestId("arrival-pictograph"))
      .toHaveAttribute("data-step-id", "candidate-step");
    await expect
      .element(page.getByTestId("arrival-pictograph"))
      .toHaveAttribute("data-motion-start-id", "step-1");
    const pictograph = page
      .getByTestId("arrival-pictograph")
      .element() as HTMLElement;
    await vi.waitFor(
      () => {
        expect(
          pictograph.closest<HTMLElement>("[data-arrival-intent='audition']")
            ?.dataset.arrivalPhase
        ).toBe("holding");
      },
      { timeout: 2500 }
    );
    await expect
      .element(page.getByTestId("arrival-pictograph"))
      .toHaveAttribute("data-motion-progress", "1");

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(onMotionComplete).toHaveBeenCalledOnce();
    expect(onBeginLanding).not.toHaveBeenCalled();
    expect(onBeginHandoff).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
