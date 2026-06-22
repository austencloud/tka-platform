import type { Fold } from "./tunnel-fold-math";

/**
 * Persisted tunnel-view look (the live config the user last left the kaleidoscope
 * in), kept separate from saved presets (`tunnel-presets.ts`). Mirrors that file's
 * load/save shape so both read/write a single localStorage key with the same
 * SSR + quota guards.
 */
export interface TunnelViewState {
  fold: Fold;
  mirror: boolean;
  gridVisible: boolean;
  /** Per-prop rainbow spectrum coloring. On = every kaleidoscope copy fans
   *  across the spectrum; off = layers inherit the base/preset colors so the
   *  Effects panel's "Choose a Look" / custom colors drive every prop. */
  spectrum: boolean;
  /** Active rail section in the Art settings panel (Tunnel/Effects/Effort/Playback). */
  section: "tunnel" | "effects" | "effort" | "playback";
}

const STORAGE_KEY = "tka_tunnel_view_state";

const DEFAULTS: TunnelViewState = {
  fold: 4,
  mirror: false,
  gridVisible: false,
  spectrum: true,
  section: "tunnel",
};

export function loadTunnelViewState(): TunnelViewState {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<TunnelViewState>;
    const fold = p.fold === 2 || p.fold === 4 || p.fold === 8 ? p.fold : DEFAULTS.fold;
    const section =
      p.section === "tunnel" ||
      p.section === "effects" ||
      p.section === "effort" ||
      p.section === "playback"
        ? p.section
        : DEFAULTS.section;
    return {
      fold,
      mirror: typeof p.mirror === "boolean" ? p.mirror : DEFAULTS.mirror,
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
