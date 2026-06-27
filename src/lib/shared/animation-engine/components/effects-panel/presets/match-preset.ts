/**
 * Honest preset matching.
 *
 * The "Choose a Look" row must highlight a chip ONLY when the live config
 * actually equals that preset. The authoritative signal is
 * `config.activePresets[effect]` (set by applyPreset, cleared to null by any
 * manual updateEffect). When that signal is null — a fresh effect select, a
 * reload, or a tuner-written base default — we fall back to comparing the live
 * config against each preset's static `patch`. A chip lights up iff every field
 * the preset patches equals the live value. No match → no highlight (the honest
 * "Custom / base default" state).
 *
 * Presets with an empty patch (the per-effect "Custom" chips that only open the
 * Customize panel) or a dynamic `resolvePatch` (trail/fire custom colors) are
 * NOT auto-matched: an empty patch would vacuously match everything, and a
 * resolvePatch preset has no static fields to compare. Those chips light up only
 * via the explicit `activePresets` signal when the user clicks them.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";

/**
 * Structural equality for preset-patch values. Patch fields are scalars
 * (number/string/boolean/null), string arrays (palettes), or — defensively —
 * shallow objects. No functions, no nested arrays-of-objects live in a patch.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => valuesEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    if (ak.length !== bk.length) return false;
    return ak.every((k) =>
      valuesEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}

/** True if every field of `patch` equals the same field in `effectConfig`. */
export function configMatchesPatch(
  effectConfig: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  const keys = Object.keys(patch);
  if (keys.length === 0) return false; // empty patch never auto-matches
  return keys.every((k) => valuesEqual(effectConfig[k], patch[k]));
}

/**
 * The id of the preset whose static patch the live `effectConfig` matches, or
 * null when none does. First match wins (preset ids are unique; patches don't
 * overlap on every field, so at most one matches in practice).
 */
export function matchPresetId(
  group: EffectPresetGroup,
  effectConfig: Record<string, unknown>,
): string | null {
  for (const preset of group.presets as EffectPreset[]) {
    if (!preset.patch || preset.resolvePatch) continue;
    if (configMatchesPatch(effectConfig, preset.patch as Record<string, unknown>)) {
      return preset.id;
    }
  }
  return null;
}
