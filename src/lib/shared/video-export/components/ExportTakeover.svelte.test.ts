import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import ExportTakeoverTestHarness from "./ExportTakeoverTestHarness.svelte";

function nextLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function dialogEl(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>(
    "dialog.base-modal.export-takeover-modal"
  );
}

async function openExport() {
  render(ExportTakeoverTestHarness);
  await page.getByTestId("start-export").click();
  // BaseModal defers showModal() by two frames.
  await nextLayout();
  await nextLayout();
}

describe("ExportTakeover blocking", () => {
  it("mounts nothing while idle", async () => {
    render(ExportTakeoverTestHarness);
    await nextLayout();
    expect(dialogEl()).toBeNull();
  });

  it("opens a native modal dialog that blocks the app underneath", async () => {
    await openExport();

    const dialog = dialogEl();
    expect(dialog, "export takeover dialog is mounted").not.toBeNull();
    // showModal() (not show()) is what puts the dialog in the top layer and
    // makes every other element inert to pointer + keyboard.
    expect(dialog!.matches(":modal")).toBe(true);
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    // The app's keyboard registry skips shortcuts under this marker.
    expect(dialog!.hasAttribute("data-keyboard-shortcuts-ignore")).toBe(true);

    // Anything underneath is unreachable: the topmost element at the
    // background button's own coordinates is the takeover, not the button.
    const underneath = page.getByTestId("underneath").element() as HTMLElement;
    const rect = underneath.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    expect(hit === underneath).toBe(false);
    expect(dialog!.contains(hit)).toBe(true);

    expect(
      page.getByTestId("underneath-clicks").element().textContent?.trim()
    ).toBe("0");
  });

  it("names itself, reports progress, and moves focus inside the dialog", async () => {
    await openExport();

    await expect
      .element(page.getByRole("dialog", { name: /Exporting/i }))
      .toBeVisible();

    const bar = document.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute("aria-valuenow")).toBe("42");

    expect(dialogEl()!.contains(document.activeElement)).toBe(true);
  });

  it("cancels from the button and tears the overlay down", async () => {
    await openExport();

    await page.getByTestId("export-takeover-cancel").click();
    await nextLayout();
    await nextLayout();

    expect(page.getByTestId("cancel-count").element().textContent?.trim()).toBe(
      "1"
    );
    expect(page.getByTestId("phase").element().textContent?.trim()).toBe("idle");
    expect(dialogEl()).toBeNull();
  });

  it("cancels on Escape and restores focus to the trigger", async () => {
    render(ExportTakeoverTestHarness);
    const trigger = page.getByTestId("start-export").element() as HTMLElement;
    trigger.focus();
    await page.getByTestId("start-export").click();
    await nextLayout();
    await nextLayout();

    expect(dialogEl()).not.toBeNull();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    await nextLayout();
    await nextLayout();

    expect(page.getByTestId("cancel-count").element().textContent?.trim()).toBe(
      "1"
    );
    expect(dialogEl()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("disables Cancel — and ignores Escape — when the surface cannot abort", async () => {
    render(ExportTakeoverTestHarness, {
      props: { cancelDisabledReason: "This render cannot be stopped." },
    });
    await page.getByTestId("start-export").click();
    await nextLayout();
    await nextLayout();

    const cancel = page
      .getByTestId("export-takeover-cancel")
      .element() as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    // The reason is announced, not just implied by a greyed-out control.
    const noteId = cancel.getAttribute("aria-describedby");
    expect(noteId).toBeTruthy();
    expect(document.getElementById(noteId!)?.textContent).toContain(
      "cannot be stopped"
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    await nextLayout();
    await nextLayout();

    expect(page.getByTestId("cancel-count").element().textContent?.trim()).toBe(
      "0"
    );
    expect(dialogEl()).not.toBeNull();
  });

  it("offers no Cancel at all when the host passes no handler", async () => {
    render(ExportTakeoverTestHarness, { props: { withCancel: false } });
    await page.getByTestId("start-export").click();
    await nextLayout();
    await nextLayout();

    expect(dialogEl()).not.toBeNull();
    expect(
      document.querySelector('[data-testid="export-takeover-cancel"]')
    ).toBeNull();
  });
});
