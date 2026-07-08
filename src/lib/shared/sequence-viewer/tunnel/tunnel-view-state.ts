import {
  DEFAULT_CONFIG,
  FOLD_OPTIONS,
  imageCount,
  resolveSpeedOverrides,
  type TunnelConfig,
} from "./tunnel-config";

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
  /** Active rail section in the Art settings panel. */
  section: "tunnel" | "speed" | "effects" | "effort" | "playback";
}

const STORAGE_KEY = "tka_tunnel_view_state";

const DEFAULTS: TunnelViewState = {
  config: { ...DEFAULT_CONFIG },
  gridVisible: false,
  spectrum: true,
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
    const mirror = bool(c.mirror, DEFAULT_CONFIG.mirror);
    const flip = bool(c.flip, DEFAULT_CONFIG.flip);
    return {
      fold,
      mirror,
      flip,
      // `invert` was briefly named `counter` (2026-07-06) — read the old key too.
      invert: bool(c.invert ?? (c as { counter?: unknown }).counter, DEFAULT_CONFIG.invert),
      echo: bool(c.echo, DEFAULT_CONFIG.echo),
      staggerSteps:
        typeof c.staggerSteps === "number" && c.staggerSteps > 0 ? Math.floor(c.staggerSteps) : 0,
      // Migrate the short-lived `speedPattern` mode + legacy boolean `speed` into
      // the override-only model (fills spread across this config's copies).
      speedOverrides: resolveSpeedOverrides(
        c as Record<string, unknown>,
        imageCount({ ...DEFAULT_CONFIG, fold, mirror, flip }),
      ),
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
    // A stored "appearance" (the retired Cast tab) falls through to "tunnel".
    const section =
      p.section === "tunnel" ||
      p.section === "speed" ||
      p.section === "effects" ||
      p.section === "effort" ||
      p.section === "playback"
        ? p.section
        : DEFAULTS.section;
    return {
      config: resolveConfig(p),
      gridVisible: bool(p.gridVisible, DEFAULTS.gridVisible),
      spectrum: bool(p.spectrum, DEFAULTS.spectrum),
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
