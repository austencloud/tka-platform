import { AnimationVisibilityStateManager } from "./animation-visibility-state.svelte";
import {
  createAnimationSettingsState,
  type AnimationSettingsState,
} from "./animation-settings-state.svelte";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { PersistenceMode } from "./persistence-adapter";

export interface AnimationScopeOptions {
  /** Persistence tier. "ephemeral" → nothing persists; "local"/"account" → persists. */
  persistence: PersistenceMode;
  /** Required when persistence === "account". */
  userId?: string;
}

/**
 * Per-surface animation state. Phase 0: a composition facade over the three
 * existing stores, constructed in the chosen persistence mode. Phase 2 collapses
 * those stores into owned slices; consumers that read `scope.visibility` /
 * `scope.settings` / `scope.effects` keep working across that change.
 */
export class AnimationScope {
  readonly visibility: AnimationVisibilityStateManager;
  readonly settings: AnimationSettingsState;
  readonly effects: ReturnType<typeof createEffectsConfigState>;

  constructor(options: AnimationScopeOptions) {
    const ephemeral = options.persistence === "ephemeral";
    this.visibility = new AnimationVisibilityStateManager({ ephemeral });
    this.settings = createAnimationSettingsState({ ephemeral });
    // Effects config is per-instance by construction; presets persistence is
    // handled by the local adapter in Phase 2 (EffectsPanel localStorage moves there).
    this.effects = createEffectsConfigState();
  }

  /** Single source of truth for playback speed. 1.0 == 60 BPM. */
  get speed(): number {
    return this.settings.bpm / 60;
  }
}

export function createAnimationScope(
  options: AnimationScopeOptions,
): AnimationScope {
  return new AnimationScope(options);
}
