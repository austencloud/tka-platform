import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import RichMessageText from "./RichMessageText.svelte";

describe("RichMessageText", () => {
  it("renders safe, selectable links without interpreting message markup", async () => {
    render(RichMessageText, {
      content:
        "<b>Look</b> at example.com/docs and https://tkaflowarts.com/sequence/O263",
      isOwn: false,
    });

    await expect
      .element(page.getByRole("link", { name: "example.com/docs" }))
      .toHaveAttribute("href", "https://example.com/docs");
    await expect
      .element(
        page.getByRole("link", {
          name: "https://tkaflowarts.com/sequence/O263",
        })
      )
      .toHaveAttribute("rel", "noopener noreferrer");
    expect(document.querySelector("b")).toBeNull();

    const messageText = document.querySelector<HTMLElement>(
      '[data-message-selectable="true"]'
    );
    expect(messageText).not.toBeNull();
    expect(getComputedStyle(messageText!).userSelect).toBe("text");
  });
});
