/**
 * Sheet Router - Route-based navigation management
 *
 * Provides utilities to open/close sheets and other route-based views via URL changes
 * while maintaining native app feel. Handles browser back button and history management.
 */

/**
 * Available sheet types that can be opened via routes
 */
export type SheetType =
  | "settings"
  | "auth"
  | "terms"
  | "privacy"
  | "animation"
  | null;

/**
 * Animation panel state for URL persistence
 */
export interface AnimationPanelState {
  sequenceId?: string; // Current sequence being animated
  speed?: number; // Playback speed (default 1)
  isPlaying?: boolean; // Playback state
  currentStep?: number; // Current beat position
  gridVisible?: boolean; // Grid visibility setting
}

/**
 * Route state that can include sheets, spotlight, and other navigable content
 */
export interface RouteState {
  sheet?: SheetType;
  spotlight?: string; // Sequence ID
  animationPanel?: AnimationPanelState;
  // Future: quiz, library items, etc.
}

/**
 * Parse URL search params into RouteState
 */
function parseRouteState(): RouteState {
  if (typeof window === "undefined") return {};

  const url = new URL(window.location.href);
  const state: RouteState = {};

  const sheet = url.searchParams.get("sheet");
  if (
    sheet &&
    (sheet === "settings" ||
      sheet === "profile-settings" ||
      sheet === "auth" ||
      sheet === "terms" ||
      sheet === "privacy" ||
      sheet === "animation")
  ) {
    state.sheet = sheet as SheetType;
  }

  const spotlight = url.searchParams.get("spotlight");
  if (spotlight) {
    state.spotlight = spotlight;
  }

  // Parse animation panel state if animation sheet is open
  if (sheet === "animation") {
    const animSeqId = url.searchParams.get("animSeqId");
    const animSpeed = url.searchParams.get("animSpeed");
    const animStep = url.searchParams.get("animStep");
    const animGrid = url.searchParams.get("animGrid");

    state.animationPanel = {
      ...(animSeqId ? { sequenceId: animSeqId } : {}),
      speed: animSpeed ? parseFloat(animSpeed) : 1,
      isPlaying: url.searchParams.get("animPlaying") === "true",
      currentStep: animStep ? parseInt(animStep, 10) : 0,
      gridVisible: animGrid !== "false",
    };
  }

  return state;
}

/**
 * Update URL with new route state
 */
function updateURL(state: RouteState, mode: "push" | "replace" = "push"): void {
  const url = new URL(window.location.href);

  // Clear all route params first
  url.searchParams.delete("sheet");
  url.searchParams.delete("spotlight");
  url.searchParams.delete("animSeqId");
  url.searchParams.delete("animSpeed");
  url.searchParams.delete("animPlaying");
  url.searchParams.delete("animStep");
  url.searchParams.delete("animGrid");

  // Set new params
  if (state.sheet) {
    url.searchParams.set("sheet", state.sheet);
  }
  if (state.spotlight) {
    url.searchParams.set("spotlight", state.spotlight);
  }

  // Set animation panel params if present
  if (state.sheet === "animation" && state.animationPanel) {
    if (state.animationPanel.sequenceId) {
      url.searchParams.set("animSeqId", state.animationPanel.sequenceId);
    }
    if (
      state.animationPanel.speed !== undefined &&
      state.animationPanel.speed !== 1
    ) {
      url.searchParams.set("animSpeed", state.animationPanel.speed.toString());
    }
    if (state.animationPanel.isPlaying) {
      url.searchParams.set("animPlaying", "true");
    }
    if (
      state.animationPanel.currentStep !== undefined &&
      state.animationPanel.currentStep !== 0
    ) {
      url.searchParams.set(
        "animStep",
        state.animationPanel.currentStep.toString()
      );
    }
    if (state.animationPanel.gridVisible === false) {
      url.searchParams.set("animGrid", "false");
    }
  }

  // Update history
  if (mode === "push") {
    window.history.pushState(state, "", url);
  } else {
    window.history.replaceState(state, "", url);
  }
}

// ============================================================================
// SHEET MANAGEMENT
// ============================================================================

/**
 * Open a sheet by pushing a new history entry
 * This allows the back button to close the sheet naturally
 */
export function openSheet(sheetType: SheetType): void {
  if (!sheetType) return;

  const currentState = parseRouteState();
  const newState: RouteState = { ...currentState, sheet: sheetType };

  updateURL(newState, "push");

  // Dispatch custom event for components to listen to
  window.dispatchEvent(new CustomEvent("route-change", { detail: newState }));
}

/**
 * Close the current sheet by going back in history or replacing URL
 * This provides native back button behavior when possible
 */
export function closeSheet(): void {
  const currentState = parseRouteState();

  if (currentState.sheet) {
    // Clear the sheet from the URL (works even without history)
    const newState: RouteState = { ...currentState };
    delete newState.sheet;

    updateURL(newState, "replace");

    // Dispatch event to update components
    window.dispatchEvent(new CustomEvent("route-change", { detail: newState }));
  } else {
    // No sheet in URL, just dispatch close event
    window.dispatchEvent(
      new CustomEvent("route-change", { detail: currentState })
    );
  }
}

/**
 * Get the currently open sheet from URL
 */
export function getCurrentSheet(): SheetType {
  const state = parseRouteState();
  return state.sheet ?? null;
}

// ============================================================================
// SPOTLIGHT MANAGEMENT
// ============================================================================

/**
 * Open a spotlight view with a sequence ID
 * This allows sharing and bookmarking specific sequences
 */
export function openSpotlight(sequenceId: string): void {
  if (!sequenceId) return;

  const currentState = parseRouteState();
  const newState: RouteState = { ...currentState, spotlight: sequenceId };

  updateURL(newState, "push");

  // Dispatch custom event
  window.dispatchEvent(new CustomEvent("route-change", { detail: newState }));
}

/**
 * Close the spotlight view
 */
export function closeSpotlight(): void {
  const currentState = parseRouteState();

  if (currentState.spotlight) {
    // Clear the spotlight from the URL (works even without history)
    const newState: RouteState = { ...currentState };
    delete newState.spotlight;

    updateURL(newState, "replace");

    // Dispatch event to update components
    window.dispatchEvent(new CustomEvent("route-change", { detail: newState }));
  } else {
    // No spotlight in URL
    window.dispatchEvent(
      new CustomEvent("route-change", { detail: currentState })
    );
  }
}

/**
 * Get the currently open spotlight sequence ID from URL
 */
export function getCurrentSpotlight(): string | null {
  const state = parseRouteState();
  return state.spotlight ?? null;
}

/**
 * Get the shareable URL for a spotlight sequence
 */
export function getSpotlightShareURL(sequenceId: string): string {
  const url = new URL(window.location.origin);
  url.searchParams.set("spotlight", sequenceId);
  return url.toString();
}

// ============================================================================
// ANIMATION PANEL MANAGEMENT
// ============================================================================

/**
 * Open the animation panel with optional state
 * This allows the animation panel to persist through page refreshes
 */
export function openAnimationPanel(animationState?: AnimationPanelState): void {
  const currentState = parseRouteState();
  const newState: RouteState = {
    ...currentState,
    sheet: "animation",
    animationPanel: animationState ?? {},
  };

  updateURL(newState, "push");

  // Dispatch custom event
  window.dispatchEvent(new CustomEvent("route-change", { detail: newState }));
}

/**
 * Update the animation panel state in the URL without pushing new history
 * This is useful for updating playback state, current beat, etc. without creating
 * new history entries for every change
 */
export function updateAnimationPanelState(
  animationState: Partial<AnimationPanelState>
): void {
  const currentState = parseRouteState();

  if (currentState.sheet !== "animation") {
    console.warn(
      "Cannot update animation panel state when animation sheet is not open"
    );
    return;
  }

  const newState: RouteState = {
    ...currentState,
    animationPanel: {
      ...currentState.animationPanel,
      ...animationState,
    },
  };

  updateURL(newState, "replace");

  // Dispatch custom event
  window.dispatchEvent(new CustomEvent("route-change", { detail: newState }));
}

/**
 * Get the current animation panel state from URL
 */
export function getCurrentAnimationPanelState(): AnimationPanelState | null {
  const state = parseRouteState();
  return state.animationPanel ?? null;
}

// ============================================================================
// GENERAL ROUTE MANAGEMENT
// ============================================================================

/**
 * Get current route state (all active routes)
 */
export function getCurrentRouteState(): RouteState {
  return parseRouteState();
}

/**
 * Close all route-based views (sheets, spotlight, etc.)
 */
export function closeAll(): void {
  const currentState = parseRouteState();
  const hasAnyRoute = currentState.sheet ?? currentState.spotlight;

  if (hasAnyRoute) {
    // Clear all params
    updateURL({}, "replace");
    window.dispatchEvent(new CustomEvent("route-change", { detail: {} }));
  }
}

/**
 * Listen for route changes (sheets, spotlight, etc.)
 */
export function onRouteChange(
  callback: (state: RouteState) => void
): () => void {
  const handlePopState = () => {
    const currentState = parseRouteState();
    callback(currentState);
  };

  const handleRouteChange = (event: Event) => {
    const customEvent = event as CustomEvent<RouteState>;
    callback(customEvent.detail);
  };

  // Listen to popstate (back/forward button)
  window.addEventListener("popstate", handlePopState);

  // Listen to custom route change events
  window.addEventListener("route-change", handleRouteChange);

  // Return cleanup function
  return () => {
    window.removeEventListener("popstate", handlePopState);
    window.removeEventListener("route-change", handleRouteChange);
  };
}

// ============================================================================
// LEGACY COMPATIBILITY (for existing code)
// ============================================================================

/**
 * @deprecated Use onRouteChange instead
 * Listen for sheet changes only
 */
export function onSheetChange(
  callback: (sheet: SheetType) => void
): () => void {
  return onRouteChange((state) => {
    callback(state.sheet ?? null);
  });
}
