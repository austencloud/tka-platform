import { describe, expect, it } from "vitest";
import { createConstructTutorialState } from "$lib/features/create/construct/tutorial/state/construct-tutorial-state.svelte";

describe("Construct live tutorial state", () => {
  it("advances only after the matching successful live action", () => {
    const tutorial = createConstructTutorialState();
    tutorial.start();

    expect(tutorial.stage).toBe("start-position");
    expect(
      tutorial.recordOptionApplied({
        letter: "A",
        stepNumber: 1,
      })
    ).toBe(false);

    expect(tutorial.recordStartPosition("α1")).toBe(true);
    expect(tutorial.stage).toBe("movement-type");
    expect(tutorial.positionLabel).toBe("α1");

    expect(tutorial.recordMovementType()).toBe(true);
    expect(tutorial.stage).toBe("movement-option");

    expect(
      tutorial.recordOptionApplied({
        letter: "A",
        stepNumber: 1,
      })
    ).toBe(true);
    expect(tutorial.stage).toBe("play-sequence");
    expect(tutorial.movementLetter).toBe("A");

    expect(tutorial.recordFullPlay()).toBe(true);
    expect(tutorial.status).toBe("completed");
  });

  it("dismisses and can restart cleanly", () => {
    const tutorial = createConstructTutorialState();
    tutorial.start();
    tutorial.recordStartPosition("β5");
    tutorial.dismiss();

    expect(tutorial.status).toBe("dismissed");
    expect(tutorial.recordMovementType()).toBe(false);

    tutorial.start();
    expect(tutorial.status).toBe("active");
    expect(tutorial.stage).toBe("start-position");
    expect(tutorial.positionLabel).toBeNull();
  });
});
