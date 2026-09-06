import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const state = vi.hoisted(() => ({
  selectedPropType: "staff" as PropType,
  persist: vi.fn(),
}));

vi.mock("./context/deck-releaser-context", () => ({
  getDeckReleaserContext: () => ({
    state: {
      get leftPropType() {
        return state.selectedPropType;
      },
      get selectedPropType() {
        return state.selectedPropType;
      },
      set selectedPropType(value: PropType) {
        state.selectedPropType = value;
      },
      persist: state.persist,
    },
  }),
}));

import DeckPropSwitcher from "./DeckPropSwitcher.svelte";

function nextLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

describe("DeckPropSwitcher modal", () => {
  it("stays open after the trigger click and returns focus after Escape", async () => {
    render(DeckPropSwitcher);
    const trigger = page.getByRole("button", {
      name: "Prop Staff. Change deck prop",
    });

    await trigger.click();
    await nextLayout();

    const dialog = page.getByRole("dialog", { name: "Deck Prop" });
    await expect.element(dialog).toBeVisible();
    // `.element()` is untyped generically in vitest 4, so narrow once and reuse.
    const dialogElement = dialog.element();
    if (!(dialogElement instanceof HTMLDialogElement)) {
      throw new Error("the deck prop dialog is not a <dialog> element");
    }
    expect(dialogElement.open).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(dialogElement.open).toBe(true);

    dialogElement.dispatchEvent(new Event("cancel", { cancelable: true }));
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(trigger).toHaveFocus();
  });
});
