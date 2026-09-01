// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("svelte", () => ({
  flushSync: (callback: () => void) => callback(),
}));

import {
  isViewerModeDissolve,
  withViewerModeDissolve,
} from "../../../src/lib/shared/transitions/viewer-mode-dissolve";

afterEach(() => {
  delete document.documentElement.dataset.motionPreference;
  delete (document as Document & { startViewTransition?: unknown })
    .startViewTransition;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("viewer mode reduced-motion dissolve", () => {
  it("covers every approved structural gate plus Stage and Performances", () => {
    expect(isViewerModeDissolve("split", "animation")).toBe(true);
    expect(isViewerModeDissolve("animation", "split")).toBe(true);
    expect(isViewerModeDissolve("split", "card")).toBe(true);
    expect(isViewerModeDissolve("card", "split")).toBe(true);
    expect(isViewerModeDissolve("card", "animation")).toBe(true);
    expect(isViewerModeDissolve("animation", "card")).toBe(true);

    expect(isViewerModeDissolve("split", "split")).toBe(false);
    expect(isViewerModeDissolve("animation", "animation-3d")).toBe(true);
    expect(isViewerModeDissolve("animation-3d", "animation")).toBe(true);
    expect(isViewerModeDissolve("animation", "tunnel")).toBe(true);
    expect(isViewerModeDissolve("tunnel", "animation")).toBe(true);
    expect(isViewerModeDissolve("animation-3d", "tunnel")).toBe(true);
    expect(isViewerModeDissolve("tunnel", "animation-3d")).toBe(true);
    expect(isViewerModeDissolve("card", "animation-3d")).toBe(false);
    expect(isViewerModeDissolve("split", "videos")).toBe(true);
    expect(isViewerModeDissolve("videos", "split")).toBe(true);
    expect(isViewerModeDissolve("animation", "videos")).toBe(true);
    expect(isViewerModeDissolve("videos", "animation")).toBe(true);
    expect(isViewerModeDissolve("animation-3d", "videos")).toBe(true);
    expect(isViewerModeDissolve("videos", "animation-3d")).toBe(true);
    expect(isViewerModeDissolve("tunnel", "videos")).toBe(true);
    expect(isViewerModeDissolve("videos", "tunnel")).toBe(true);
    expect(isViewerModeDissolve("videos", "post-studio")).toBe(false);
  });

  it("keeps the mode mutation synchronous when no live workspace exists", () => {
    const mutate = vi.fn();

    expect(withViewerModeDissolve(null, "split", "card", mutate)).toBeNull();
    expect(mutate).toHaveBeenCalledOnce();
  });

  it("publishes the reduced-motion destination without waiting on a paint", async () => {
    document.documentElement.dataset.motionPreference = "reduce";
    const workspace = document.createElement("div");
    document.body.append(workspace);
    Object.defineProperty(workspace, "isConnected", { value: true });
    const requestFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);

    let updateCallback!: () => void;
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const startViewTransition = vi.fn((update: () => void) => {
      updateCallback = update;
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished,
        skipTransition: vi.fn(),
      };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    const mutate = vi.fn();

    expect(workspace.isConnected).toBe(true);
    expect(document.documentElement.dataset.motionPreference).toBe("reduce");
    expect(typeof document.startViewTransition).toBe("function");
    const transition = withViewerModeDissolve(
      workspace,
      "split",
      "card",
      mutate
    );
    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(transition).not.toBeNull();
    updateCallback();
    expect(mutate).toHaveBeenCalledOnce();
    expect(requestFrame).not.toHaveBeenCalled();
    finish();
    await finished;
    workspace.remove();
  });

  it("replaces an in-flight dissolve before committing a rapid reversal", async () => {
    document.documentElement.dataset.motionPreference = "reduce";
    const workspace = document.createElement("div");
    document.body.append(workspace);
    Object.defineProperty(workspace, "isConnected", { value: true });

    const finishes: Array<() => void> = [];
    const transitions: Array<{
      finished: Promise<void>;
      ready: Promise<void>;
      skipTransition: ReturnType<typeof vi.fn>;
    }> = [];
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => (finish = resolve));
      finishes.push(finish);
      const transition = {
        finished,
        ready: Promise.resolve(),
        skipTransition: vi.fn(),
      };
      transitions.push(transition);
      return transition;
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    const focusCard = vi.fn();
    const returnToSplit = vi.fn();

    withViewerModeDissolve(workspace, "split", "card", focusCard);
    withViewerModeDissolve(workspace, "card", "split", returnToSplit);

    expect(focusCard).toHaveBeenCalledOnce();
    expect(returnToSplit).toHaveBeenCalledOnce();
    expect(transitions[0]?.skipTransition).toHaveBeenCalledOnce();

    for (const finish of finishes) finish();
    await Promise.all(transitions.map((transition) => transition.finished));
    workspace.remove();
  });
});
