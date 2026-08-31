/**
 * Reduced-motion mode changes for the Sequence Viewer.
 *
 * Card and animation are stateful, expensive surfaces. Wrapping them in the
 * keyed Crossfade primitive would remount them and throw away live playback,
 * canvas, and sizing state. A named same-document View Transition gives us the
 * same old/new opacity handoff from browser snapshots while the real workspace
 * stays mounted underneath.
 *
 * Full motion remains owned by PanelGroup. This seam only runs when reduced
 * motion is requested, and its CSS is deliberately opacity-only.
 */
import { flushSync } from "svelte";
import { reducedMotion } from "./motion";
import { ignoreViewTransitionSkip } from "./named-route-morph-state.svelte";
import { DURATION } from "./transitions";

export const VIEWER_MODE_DISSOLVE_NAME = "sequence-viewer-workspace";
export const VIEWER_MODE_DISSOLVE_CLASS = "sequence-viewer-reduced-dissolve";
export const VIEWER_MODE_DISSOLVE_DURATION = DURATION.normal;

const GATE_ONE_DISSOLVE_MODES = new Set(["split", "animation", "card"]);
const GATE_THREE_STAGE_MODES = new Set(["animation", "animation-3d"]);

interface WorkspaceLease {
  count: number;
  previousName: string;
}

const workspaceLeases = new WeakMap<HTMLElement, WorkspaceLease>();
const activeWorkspaceTransitions = new WeakMap<HTMLElement, ViewTransition>();
let activeDissolves = 0;

/** True for the mounted viewer surfaces governed by Gates 1 through 3. */
export function isViewerModeDissolve(
  previousMode: string,
  nextMode: string
): boolean {
  const isGateOnePair =
    GATE_ONE_DISSOLVE_MODES.has(previousMode) &&
    GATE_ONE_DISSOLVE_MODES.has(nextMode);
  const isGateTwoPair =
    (previousMode === "animation" && nextMode === "animation-3d") ||
    (previousMode === "animation-3d" && nextMode === "animation");
  const isGateThreePair =
    (GATE_THREE_STAGE_MODES.has(previousMode) && nextMode === "tunnel") ||
    (previousMode === "tunnel" && GATE_THREE_STAGE_MODES.has(nextMode));

  return (
    previousMode !== nextMode &&
    (isGateOnePair || isGateTwoPair || isGateThreePair)
  );
}

function acquireWorkspace(workspace: HTMLElement): void {
  const current = workspaceLeases.get(workspace);
  if (current) {
    current.count += 1;
    return;
  }

  workspaceLeases.set(workspace, {
    count: 1,
    previousName: workspace.style.viewTransitionName,
  });
  workspace.style.viewTransitionName = VIEWER_MODE_DISSOLVE_NAME;
}

function releaseWorkspace(workspace: HTMLElement): void {
  const current = workspaceLeases.get(workspace);
  if (!current) return;
  current.count -= 1;
  if (current.count > 0) return;

  workspace.style.viewTransitionName = current.previousName;
  workspaceLeases.delete(workspace);
}

function beginDissolve(workspace: HTMLElement): void {
  acquireWorkspace(workspace);
  activeDissolves += 1;
  document.documentElement.classList.add(VIEWER_MODE_DISSOLVE_CLASS);
}

function endDissolve(workspace: HTMLElement): void {
  releaseWorkspace(workspace);
  activeDissolves = Math.max(0, activeDissolves - 1);
  document.documentElement.classList.toggle(
    VIEWER_MODE_DISSOLVE_CLASS,
    activeDissolves > 0
  );
}

/**
 * Apply a viewer mode mutation through an opacity-only snapshot dissolve when
 * reduced motion is active. Unsupported browsers and ungoverned mode changes
 * receive the same synchronous mutation with no transition.
 */
export function withViewerModeDissolve(
  workspace: HTMLElement | null,
  previousMode: string,
  nextMode: string,
  mutate: () => void
): ViewTransition | null {
  if (
    !workspace?.isConnected ||
    !isViewerModeDissolve(previousMode, nextMode) ||
    !reducedMotion() ||
    typeof document.startViewTransition !== "function"
  ) {
    mutate();
    return null;
  }

  // A rapid reversal should describe the latest choice immediately. Letting
  // Chromium queue a second update behind the first dissolve makes the rail
  // feel unresponsive even though neither transition moves geometry.
  activeWorkspaceTransitions.get(workspace)?.skipTransition();
  beginDissolve(workspace);

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(() => {
      flushSync(mutate);
      // The browser pauses painting while this callback runs. Waiting for an
      // animation frame here deadlocks until Chromium's safety timeout, which
      // looks like a frozen viewer followed by a sudden mode swap. flushSync
      // publishes the Svelte destination in the same update instead.
    });
  } catch {
    endDissolve(workspace);
    mutate();
    return null;
  }

  activeWorkspaceTransitions.set(workspace, transition);
  ignoreViewTransitionSkip(transition);
  void transition.finished
    .catch(() => {})
    .finally(() => {
      if (activeWorkspaceTransitions.get(workspace) === transition) {
        activeWorkspaceTransitions.delete(workspace);
      }
      endDissolve(workspace);
    });
  return transition;
}
