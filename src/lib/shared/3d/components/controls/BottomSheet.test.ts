import { describe, it, expect, vi } from "vitest";
import { createSheetDismiss } from "./BottomSheet.svelte";

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
    const panel = document.createElement("div");
    const outside = document.createElement("div");
    document.body.append(panel, outside);
    const d = createSheetDismiss(onClose, () => panel);
    d.onBackdropPointerDown({ target: outside } as unknown as PointerEvent);
    expect(onClose).toHaveBeenCalledOnce();
    panel.remove();
    outside.remove();
  });

  it("does NOT close when pointerdown is inside the panel", () => {
    const onClose = vi.fn();
    const panel = document.createElement("div");
    const child = document.createElement("button");
    panel.append(child);
    document.body.append(panel);
    const d = createSheetDismiss(onClose, () => panel);
    d.onBackdropPointerDown({ target: child } as unknown as PointerEvent);
    expect(onClose).not.toHaveBeenCalled();
    panel.remove();
  });
});
