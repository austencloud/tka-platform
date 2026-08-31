/**
 * an slice — 2D animation settings <-> URL payload.
 * Capture: per-key diff vs POST-NORMALIZE defaults (null at defaults).
 * Seed: merge onto those same defaults (the sender diffed against them).
 *
 * Two stores, two sub-keys. `tka_trail_settings` is deliberately EXCLUDED: its
 * only reader is the per-engine `createAnimatorState()`, and
 * `TrailSettingsSynchronizer.handleSettingsChange` writes it only when no
 * external trail settings were supplied. Every viewer surface DOES supply them
 * (`AnimationPlayer.svelte` and `ViewerSplitPane.svelte` both pass
 * `animationSettings.trail`), so in the viewer that key is neither source nor
 * sink — it is shadowed by `tka_animation_settings.trail`. Encoding it would
 * put the same `TrailSettings` shape in the URL twice.
 *
 * Diff baselines are what a factory-fresh load actually HOLDS, not the raw
 * exported constants (the trap that stamped a bogus `fx=` onto untouched
 * viewers). For settings that happens to BE `DEFAULT_ANIMATION_SETTINGS`: the
 * forced-vivid block in `loadSettings()` writes exactly `DEFAULT_TRAIL_SETTINGS`
 * (asserted in `an-slice.test.ts`). For visibility it does not — `loadFromStorage`
 * forces `stepNumbers = true` and derives `tipEffortMap` from `effortPreset` — so
 * that baseline is read off a fresh ephemeral manager instead of a constant.
 *
 * `effortPreset` + `tipEffortMap` are ONE quantity, the same mirror-pair trap as
 * fx's `activeEffect`/`tipEffectMap`. Both are normalized before diffing and
 * always travel together.
 *
 * Capture reads RAW settings, not `getSettings()`. The `motionPolicySource`
 * overlay is installed in exactly one place (`FuseAnimationPreview.svelte:61`, a
 * Fuse preview borrowing another manager's path/effort policy) and never on the
 * global instance the viewer reads. Raw is the user-owned state, and it is what
 * `replaceAll` has to write back on restore.
 */
import type {
  AnimationSettings,
  AnimationSettingsState,
  TrailSettings,
} from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import {
  DEFAULT_ANIMATION_SETTINGS,
  DEFAULT_TRAIL_SETTINGS,
} from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import {
  AnimationVisibilityStateManager,
  type AnimationVisibilitySettings,
} from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { TipEffortMap } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { deepEqual } from "../viewer-url-state-codec";

/** `version` is schema metadata the loader always rewrites — never user state. */
interface AnimationSettingsPatch {
  bpm?: number;
  shouldLoop?: boolean;
  trail?: Partial<TrailSettings>;
}

export interface AnSlicePayload {
  settings?: AnimationSettingsPatch;
  visibility?: Partial<AnimationVisibilitySettings>;
}

/** The live globals, narrowed to what this slice reads. */
export interface AnSliceStores {
  settings: Pick<AnimationSettingsState, "snapshot">;
  visibility: Pick<AnimationVisibilityStateManager, "snapshot">;
}

/** The `tipEffortMap` that `loadFromStorage` derives for a given preset. */
function canonicalTipEffortMap(effort: EffortId): TipEffortMap {
  return effort === "linear" ? {} : { "*": { effort } };
}

/** Collapses the effortPreset/tipEffortMap mirror pair into one comparable form. */
function normalizeEffort(
  settings: AnimationVisibilitySettings
): Pick<AnimationVisibilitySettings, "effortPreset" | "tipEffortMap"> {
  const map = settings.tipEffortMap ?? {};
  const effort = (map["*"]?.effort ?? settings.effortPreset) as EffortId;
  const canonical = canonicalTipEffortMap(effort);
  return {
    effortPreset: effort,
    // An exotic per-tip map is not representable by the preset alone, so it
    // rides along verbatim instead of being flattened away.
    tipEffortMap: deepEqual(map, canonical) ? canonical : map,
  };
}

function normalizedVisibility(
  settings: AnimationVisibilitySettings
): AnimationVisibilitySettings {
  return { ...settings, ...normalizeEffort(settings) };
}

let visibilityBaseline: AnimationVisibilitySettings | null = null;

/**
 * What the visibility manager holds after a factory-fresh load. Read off an
 * ephemeral instance so the baseline can never drift from `getDefaultSettings`.
 */
export function postNormalizeVisibilityDefaults(): AnimationVisibilitySettings {
  visibilityBaseline ??= normalizedVisibility(
    new AnimationVisibilityStateManager({ ephemeral: true }).snapshot()
  );
  return visibilityBaseline;
}

/** What the settings store holds after a factory-fresh `loadSettings()`. */
export function postNormalizeAnimationDefaults(): AnimationSettings {
  return {
    ...DEFAULT_ANIMATION_SETTINGS,
    trail: { ...DEFAULT_TRAIL_SETTINGS },
  };
}

function captureSettings(
  snapshot: AnimationSettings
): AnimationSettingsPatch | null {
  const base = postNormalizeAnimationDefaults();
  const patch: AnimationSettingsPatch = {};

  if (snapshot.bpm !== base.bpm) patch.bpm = snapshot.bpm;
  if (snapshot.shouldLoop !== base.shouldLoop) {
    patch.shouldLoop = snapshot.shouldLoop;
  }

  const trail: Partial<TrailSettings> = {};
  for (const key of Object.keys(base.trail) as (keyof TrailSettings)[]) {
    if (!deepEqual(snapshot.trail[key], base.trail[key])) {
      (trail as Record<string, unknown>)[key] = snapshot.trail[key];
    }
  }
  if (Object.keys(trail).length > 0) patch.trail = trail;

  return Object.keys(patch).length > 0 ? patch : null;
}

function captureVisibility(
  snapshot: AnimationVisibilitySettings
): Partial<AnimationVisibilitySettings> | null {
  const base = postNormalizeVisibilityDefaults();
  const live = normalizedVisibility(snapshot);
  const patch: Partial<AnimationVisibilitySettings> = {};

  for (const key of Object.keys(base) as (keyof AnimationVisibilitySettings)[]) {
    // The mirror pair is one quantity, handled below: both fields or neither.
    if (key === "effortPreset" || key === "tipEffortMap") continue;
    if (!deepEqual(live[key], base[key])) {
      (patch as Record<string, unknown>)[key] = live[key];
    }
  }

  if (
    live.effortPreset !== base.effortPreset ||
    !deepEqual(live.tipEffortMap, base.tipEffortMap)
  ) {
    patch.effortPreset = live.effortPreset;
    patch.tipEffortMap = live.tipEffortMap;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function captureAnSlice(stores: AnSliceStores): AnSlicePayload | null {
  const settings = captureSettings(stores.settings.snapshot());
  const visibility = captureVisibility(stores.visibility.snapshot());

  const payload: AnSlicePayload = {};
  if (settings) payload.settings = settings;
  if (visibility) payload.visibility = visibility;

  return Object.keys(payload).length > 0 ? payload : null;
}

export interface AnSliceSeed {
  settings: AnimationSettings;
  visibility: AnimationVisibilitySettings;
}

/** Full store payloads ready for `replaceAll`, merged onto the diff baselines. */
export function seedFromAnSlice(payload: AnSlicePayload): AnSliceSeed {
  const settings = postNormalizeAnimationDefaults();
  if (payload.settings) {
    const { trail, ...top } = payload.settings;
    Object.assign(settings, top);
    if (trail) Object.assign(settings.trail, trail);
  }

  const visibility = structuredClone(postNormalizeVisibilityDefaults());
  if (payload.visibility) Object.assign(visibility, payload.visibility);

  return { settings, visibility: normalizedVisibility(visibility) };
}
