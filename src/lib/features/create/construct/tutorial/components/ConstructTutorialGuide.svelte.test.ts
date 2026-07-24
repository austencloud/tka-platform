import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "$test-helpers/component-a11y";
import ConstructTutorialGuideHarness from "./ConstructTutorialGuideHarness.svelte";

describe("ConstructTutorialGuide", () => {
  it("shows one live instruction and can be dismissed from the keyboard path", async () => {
    render(ConstructTutorialGuideHarness);

    await expect
      .element(page.getByText("Choose a start pose", { exact: true }))
      .toBeInTheDocument();
    await expectNoA11yViolations();

    await page.getByRole("button", { name: "Dismiss Construct guide" }).click();
    expect(
      page.getByText("Choose a start pose", { exact: true }).elements()
    ).toHaveLength(0);
  });

  it("uses the shared Play sequence action name", async () => {
    render(ConstructTutorialGuideHarness, { atPlayStep: true });

    await expect
      .element(
        page.getByText("Use Play sequence below the workspace.", {
          exact: true,
        })
      )
      .toBeInTheDocument();
  });
});
