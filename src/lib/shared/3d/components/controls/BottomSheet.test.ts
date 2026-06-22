// @vitest-environment jsdom
// This file needs real DOM nodes (panel.contains / append). Files outside the
// suite's include globs default to the node environment, so opt this one into
// jsdom per-file rather than widening the global include (which would pull
// unrelated, currently-failing src/lib/shared tests into the suite gate).
import { describe, it, expect, vi } from "vitest";
import { createSheetDismiss } from "./BottomSheet.svelte";

// The test setup (tests/setup/vitest-setup.ts) stubs document.createElement for
// non-canvas tags, so it returns plain objects without DOM tree methods.
// createElementNS is NOT stubbed and yields real jsdom nodes (append/contains),
// keeping this test self-contained without touching shared test infra.
const XHTML = "http://www.w3.org/1999/xhtml";
const el = (tag: string) => document.createElementNS(XHTML, tag) as HTMLElement;

describe("createSheetDismiss", () => {
  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    const d = createSheetDismiss(onClose);
    d.onKeydown(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores other keys", () => {
    const onClose = vi.fn();
    const d = createSheetDismiss(onClose);
    d.onKeydown(new KeyboardEvent("keydown", { key: "a" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when a pointerdown lands outside the panel", () => {
    const onClose = vi.fn();
    const panel = el("div");
    const outside = el("div");
    document.body.append(panel, outside);
    const d = createSheetDismiss(onClose, () => panel);
    d.onBackdropPointerDown({ target: outside } as unknown as PointerEvent);
    expect(onClose).toHaveBeenCalledOnce();
    panel.remove();
    outside.remove();
  });

  it("does NOT close when pointerdown is inside the panel", () => {
    const onClose = vi.fn();
    const panel = el("div");
    const child = el("button");
    panel.append(child);
    document.body.append(panel);
    const d = createSheetDismiss(onClose, () => panel);
    d.onBackdropPointerDown({ target: child } as unknown as PointerEvent);
    expect(onClose).not.toHaveBeenCalled();
    panel.remove();
  });
});
