import { describe, it, expect, afterEach, vi } from "vitest";
import { showToast, toastQueue, clearToasts } from "./toast-state.svelte";

afterEach(() => clearToasts());

describe("toast action passthrough", () => {
  it("attaches an action to the queued toast and runs its onClick", () => {
    const onClick = vi.fn();
    showToast({
      message: "New version available",
      type: "info",
      duration: 0,
      action: { label: "Reload", onClick },
    });

    const toast = toastQueue[toastQueue.length - 1];
    expect(toast.action?.label).toBe("Reload");

    toast.action?.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("leaves action undefined for a plain string toast", () => {
    showToast("hello");
    const toast = toastQueue[toastQueue.length - 1];
    expect(toast.action).toBeUndefined();
  });
});
