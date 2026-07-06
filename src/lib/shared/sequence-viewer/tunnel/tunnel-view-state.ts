import { DEFAULT_CONFIG, FOLD_OPTIONS, type TunnelConfig } from "./tunnel-config";
import { DEFAULT_APPEARANCE, coerceSkins, type TunnelAppearance } from "./tunnel-appearance";

/**
 * Persisted tunnel-view config + chrome (the state the user last left the
 * kaleidoscope in). One localStorage key with SSR + quota guards.
 */
export interface TunnelViewState {
  /** The primitive config (see `tunnel-config.ts`). */
  config: TunnelConfig;
  gridVisible: boolean;
  /** Per-prop rainbow spectrum coloring. On = every copy fans across the
   *  spectrum; off = layers inherit the base/preset colors. */
  spectrum: boolean;
  /** The performer set — per-hand props each copy cycles through (see
   *  `tunnel-appearance.ts`). */
  skins: TunnelAppearance;
  /** False until the user edits the performer set; while false the center pair
   *  tracks the global prop instead of the default skin. */
  appearanceCustomized: boolean;
  /** Active rail section in the Art settings panel. */
  section: "tunnel" | "appearance" | "effects" | "effort" | "playback";
}

const STORAGE_KEY = "tka_tunnel_view_state";

const DEFAULTS: TunnelViewState = {
  config: { ...DEFAULT_CONFIG },
  gridVisible: false,
  spectrum: true,
  skins: [...DEFAULT_APPEARANCE],
  appearanceCustomized: false,
  section: "tunnel",
};

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

/** Named looks (2026-07-06 morning) → primitive config. */
const LOOK_TO_CONFIG: Record<string, Partial<TunnelConfig>> = {
  radial: {}, // fold carried from `density`
  mandala: { fold: 4, mirror: true },
  mirror: { fold: 1, mirror: true },
  flip: { fold: 1, flip: true },
  counter: { fold: 1, invert: true },
  echo: { fold: 1, echo: true },
  cross: { fold: 2, mirror: true },
};

/**
 * Resolve a persisted config, migrating older shapes:
 *  - the current `{ config }` snapshot,
 *  - the named-look era (`lookId` + `density` + `radialMirror`),
 *  - the pre-looks `fold` + `mirror` booleans.
 */
function resolveConfig(p: Record<string, unknown>): TunnelConfig {
  // Current shape.
  const c = p.config as Partial<TunnelConfig> | undefined;
  if (c && typeof c === "object") {
    const fold = FOLD_OPTIONS.includes(c.fold as number) ? (c.fold as number) : DEFAULT_CONFIG.fold;
    return {
      fold,
      mirror: bool(c.mirror, DEFAULT_CONFIG.mirror),
      flip: bool(c.flip, DEFAULT_CONFIG.flip),
      // `invert` was briefly named `counter` (2026-07-06) — read the old key too.
      invert: bool(c.invert ?? (c as { counter?: unknown }).counter, DEFAULT_CONFIG.invert),
      echo: bool(c.echo, DEFAULT_CONFIG.echo),
      staggerSteps:
        typeof c.staggerSteps === "number" && c.staggerSteps > 0 ? Math.floor(c.staggerSteps) : 0,
      speed: bool(c.speed, DEFAULT_CONFIG.speed),
    };
  }

  const density =
    typeof p.density === "number" && FOLD_OPTIONS.includes(p.density) ? p.density : 4;

  // Named-look era.
  if (typeof p.lookId === "string" && p.lookId in LOOK_TO_CONFIG) {
    const base: TunnelConfig = { ...DEFAULT_CONFIG, fold: density };
    const mapped = { ...base, ...LOOK_TO_CONFIG[p.lookId] };
    // Radial carried an explicit dihedral toggle.
    if (p.lookId === "radial" && p.radialMirror === true) mapped.mirror = true;
    return mapped;
  }
  // The split radial looks predate the merge.
  if (p.lookId === "duo") return { ...DEFAULT_CONFIG, fold: 2 };
  if (p.lookId === "pinwheel") return { ...DEFAULT_CONFIG, fold: 4 };
  if (p.lookId === "kaleido") return { ...DEFAULT_CONFIG, fold: 8 };

  // Pre-looks fold/mirror.
  if (typeof p.fold === "number" && FOLD_OPTIONS.includes(p.fold)) {
    return { ...DEFAULT_CONFIG, fold: p.fold, mirror: p.mirror === true };
  }

  return { ...DEFAULT_CONFIG };
}

export function loadTunnelViewState(): TunnelViewState {
  if (typeof localStorage === "undefined") return { ...DEFAULTS, config: { ...DEFAULT_CONFIG } };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, config: { ...DEFAULT_CONFIG } };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const section =
      p.section === "tunnel" ||
      p.section === "appearance" ||
      p.section === "effects" ||
      p.section === "effort" ||
      p.section === "playback"
        ? p.section
        : DEFAULTS.section;
    return {
      config: resolveConfig(p),
      gridVisible: bool(p.gridVisible, DEFAULTS.gridVisible),
      spectrum: bool(p.spectrum, DEFAULTS.spectrum),
      skins: coerceSkins(p.skins),
      appearanceCustomized: bool(p.appearanceCustomized, DEFAULTS.appearanceCustomized),
      section,
    };
  } catch {
    return { ...DEFAULTS, config: { ...DEFAULT_CONFIG } };
  }
}

export function saveTunnelViewState(state: TunnelViewState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded / private browsing — non-fatal
  }
}
