import { createAnimationScope } from "$lib/shared/animation-engine/state/animation-scope.svelte";
import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { PillId } from "$lib/shared/animation-panel/pill-nav/pill-types";
import {
  HERO_TIP_EFFECT_MAP,
  HERO_TRAIL_PRESET,
} from "$lib/shared/landing/data/hero-trail-preset";

/**
 * Presentation state for the Shape Matrix hero. It is intentionally separate
 * from matrix navigation: changing a flower or relationship replaces the
 * sequence, while playback, display, effects, and disassembly remain stage
 * choices.
 */
export function createShapeMatrixAnimationState() {
  const scope = createAnimationScope({ persistence: "ephemeral" });
  scope.settings.setBpm(60);
  scope.visibility.setBpm(60);
  scope.effects.replace({
    ...scope.effects.config,
    trails: {
      ...scope.effects.trails,
      thickness: Math.max(1, HERO_TRAIL_PRESET.lineWidth - 2),
      brightness: HERO_TRAIL_PRESET.maxOpacity,
      trackingMode: "right_end",
    },
    tipEffectMap: { ...HERO_TIP_EFFECT_MAP },
    activeEffect: "trails",
  });

  let playing = $state(true);
  let activeSection = $state<PillId | null>(null);
  let closeRequest = $state(0);
  let disassembled = $state(false);
  let pendingDisassembly = $state<boolean | null>(null);

  function setPlaying(next: boolean): void {
    playing = next;
  }

  function togglePlaying(): void {
    playing = !playing;
  }

  function setBpm(next: number): void {
    scope.settings.setBpm(next);
    scope.visibility.setBpm(next);
  }

  function setPlaybackMode(next: PlaybackMode): void {
    scope.visibility.setPlaybackMode(next);
  }

  function setActiveSection(next: PillId | null): void {
    activeSection = next;
    if (next !== null || pendingDisassembly === null) return;

    disassembled = pendingDisassembly;
    pendingDisassembly = null;
  }

  function requestDisassembled(next: boolean): void {
    if (activeSection !== null) {
      pendingDisassembly = next;
      closeRequest += 1;
      return;
    }

    disassembled = next;
  }

  return {
    scope,
    get playing() {
      return playing;
    },
    get bpm() {
      return scope.settings.bpm;
    },
    get playbackMode() {
      return scope.visibility.getPlaybackMode();
    },
    get activeSection() {
      return activeSection;
    },
    get closeRequest() {
      return closeRequest;
    },
    get disassembled() {
      return disassembled;
    },
    setPlaying,
    togglePlaying,
    setBpm,
    setPlaybackMode,
    setActiveSection,
    requestDisassembled,
  };
}

export type ShapeMatrixAnimationState = ReturnType<
  typeof createShapeMatrixAnimationState
>;
