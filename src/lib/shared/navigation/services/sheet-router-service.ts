import { browser } from "$app/environment";
import {
  pushState as svelteKitPushState,
  replaceState as svelteKitReplaceState,
} from "$app/navigation";
import type { SheetType, RouteState, AnimationPanelState } from "./types";

export class SheetRouter {
  private parseRouteState(): RouteState {
    if (!browser) return {};

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

  private updateURL(
    state: RouteState,
    mode: "push" | "replace" = "push"
  ): void {
    if (!browser) return;

    const url = new URL(window.location.href);

    url.searchParams.delete("sheet");
    url.searchParams.delete("spotlight");
    url.searchParams.delete("animSeqId");
    url.searchParams.delete("animSpeed");
    url.searchParams.delete("animPlaying");
    url.searchParams.delete("animStep");
    url.searchParams.delete("animGrid");

    if (state.sheet) {
      url.searchParams.set("sheet", state.sheet);
    }
    if (state.spotlight) {
      url.searchParams.set("spotlight", state.spotlight);
    }

    if (state.sheet === "animation" && state.animationPanel) {
      if (state.animationPanel.sequenceId) {
        url.searchParams.set("animSeqId", state.animationPanel.sequenceId);
      }
      if (
        state.animationPanel.speed !== undefined &&
        state.animationPanel.speed !== 1
      ) {
        url.searchParams.set(
          "animSpeed",
          state.animationPanel.speed.toString()
        );
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

    if (mode === "push") {
      svelteKitPushState(url, state);
    } else {
      svelteKitReplaceState(url, state);
    }
  }

  private dispatchRouteChange(state: RouteState): void {
    if (!browser) return;
    window.dispatchEvent(new CustomEvent("route-change", { detail: state }));
  }

  openSheet(sheetType: SheetType): void {
    if (!sheetType || !browser) return;

    const currentState = this.parseRouteState();
    const newState: RouteState = { ...currentState, sheet: sheetType };

    this.updateURL(newState, "push");
    this.dispatchRouteChange(newState);
  }

  closeSheet(): void {
    if (!browser) return;

    const currentState = this.parseRouteState();

    if (currentState.sheet) {
      const newState: RouteState = { ...currentState };
      delete newState.sheet;

      this.updateURL(newState, "replace");
      this.dispatchRouteChange(newState);
    } else {
      this.dispatchRouteChange(currentState);
    }
  }

  getCurrentSheet(): SheetType {
    const state = this.parseRouteState();
    return state.sheet ?? null;
  }

  openSpotlight(sequenceId: string): void {
    if (!sequenceId || !browser) return;

    const currentState = this.parseRouteState();
    const newState: RouteState = { ...currentState, spotlight: sequenceId };

    this.updateURL(newState, "push");
    this.dispatchRouteChange(newState);
  }

  closeSpotlight(): void {
    if (!browser) return;

    const currentState = this.parseRouteState();

    if (currentState.spotlight) {
      const newState: RouteState = { ...currentState };
      delete newState.spotlight;

      this.updateURL(newState, "replace");
      this.dispatchRouteChange(newState);
    } else {
      this.dispatchRouteChange(currentState);
    }
  }

  getCurrentSpotlight(): string | null {
    const state = this.parseRouteState();
    return state.spotlight ?? null;
  }

  getSpotlightShareURL(sequenceId: string): string {
    if (!browser) return "";

    const url = new URL(window.location.origin);
    url.searchParams.set("spotlight", sequenceId);
    return url.toString();
  }

  openAnimationPanel(animationState?: AnimationPanelState): void {
    if (!browser) return;

    const currentState = this.parseRouteState();
    const newState: RouteState = {
      ...currentState,
      sheet: "animation",
      animationPanel: animationState ?? {},
    };

    this.updateURL(newState, "push");
    this.dispatchRouteChange(newState);
  }

  updateAnimationPanelState(
    animationState: Partial<AnimationPanelState>
  ): void {
    if (!browser) return;

    const currentState = this.parseRouteState();

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

    this.updateURL(newState, "replace");
    this.dispatchRouteChange(newState);
  }

  getCurrentAnimationPanelState(): AnimationPanelState | null {
    const state = this.parseRouteState();
    return state.animationPanel ?? null;
  }

  getCurrentRouteState(): RouteState {
    return this.parseRouteState();
  }

  closeAll(): void {
    if (!browser) return;

    const currentState = this.parseRouteState();
    const hasAnyRoute = currentState.sheet ?? currentState.spotlight;

    if (hasAnyRoute) {
      this.updateURL({}, "replace");
      this.dispatchRouteChange({});
    }
  }

  onRouteChange(callback: (state: RouteState) => void): () => void {
    if (!browser) return () => {};

    const handlePopState = () => {
      const currentState = this.parseRouteState();
      callback(currentState);
    };

    const handleRouteChange = (event: Event) => {
      const customEvent = event as CustomEvent<RouteState>;
      callback(customEvent.detail);
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("route-change", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("route-change", handleRouteChange);
    };
  }
}
