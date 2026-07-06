import { DEFAULT_DENSITY, DEFAULT_LOOK_ID, getLook } from "./tunnel-looks";

/**
 * Persisted tunnel-view look + tuning (the config the user last left the
 * kaleidoscope in). One localStorage key with SSR + quota guards.
 */
export interface TunnelViewState {
  /** Selected look id (see `tunnel-looks.ts`). */
  lookId: string;
  /** Radial arm count (ignored by fixed looks). */
  density: number;
  /** Radial dihedral Mirror toggle (ignored by non-mirrorable looks). */
  radialMirror: boolean;
  gridVisible: boolean;
  /** Per-prop rainbow spectrum coloring. On = every copy fans across the
   *  spectrum; off = layers inherit the base/preset colors. */
  spectrum: boolean;
  /** Active rail section in the Art settings panel (Tunnel/Effects/Effort/Playback). */
  section: "tunnel" | "effects" | "effort" | "playback";
}

const STORAGE_KEY = "tka_tunnel_view_state";

const DEFAULTS: TunnelViewState = {
  lookId: DEFAULT_LOOK_ID,
  density: DEFAULT_DENSITY,
  radialMirror: false,
  gridVisible: false,
  spectrum: true,
  section: "tunnel",
};

/** Resolve a persisted (lookId, density), migrating older shapes:
 *  - the split radial looks (duo/pinwheel/kaleido) → Radial + its arm count,
 *  - pre-looks fold/mirror state (fold 2|4|8, mirror bool). */
function resolveLookAndDensity(p: Record<string, unknown>): { lookId: string; density: number } {
  const density =
    typeof p.density === "number" && p.density > 0 ? p.density : DEFAULTS.density;

  // Split radial looks → merged Radial with the matching arm count.
  if (p.lookId === "duo") return { lookId: "radial", density: 2 };
  if (p.lookId === "pinwheel") return { lookId: "radial", density: 4 };
  if (p.lookId === "kaleido") return { lookId: "radial", density: 8 };
  if (typeof p.lookId === "string" && getLook(p.lookId)) return { lookId: p.lookId, density };

  // Pre-looks fold/mirror.
  if (p.mirror === true) return { lookId: "mandala", density };
  if (p.fold === 2) return { lookId: "radial", density: 2 };
  if (p.fold === 8) return { lookId: "radial", density: 8 };
  if (p.fold === 4) return { lookId: "radial", density: 4 };

  return { lookId: DEFAULTS.lookId, density: DEFAULTS.density };
}

export function loadTunnelViewState(): TunnelViewState {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const { lookId, density } = resolveLookAndDensity(p);
    const section =
      p.section === "tunnel" ||
      p.section === "effects" ||
      p.section === "effort" ||
      p.section === "playback"
        ? p.section
        : DEFAULTS.section;
    return {
      lookId,
      density,
      radialMirror: typeof p.radialMirror === "boolean" ? p.radialMirror : DEFAULTS.radialMirror,
      gridVisible: typeof p.gridVisible === "boolean" ? p.gridVisible : DEFAULTS.gridVisible,
      spectrum: typeof p.spectrum === "boolean" ? p.spectrum : DEFAULTS.spectrum,
      section,
    };
  } catch {
    return { ...DEFAULTS };
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
