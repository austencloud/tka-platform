import { DEFAULT_LOOK_ID, getLook } from "./tunnel-looks";

/**
 * Persisted tunnel-view look (the live config the user last left the
 * kaleidoscope in). One localStorage key with SSR + quota guards.
 */
export interface TunnelViewState {
  /** Selected look id (see `tunnel-looks.ts`). */
  lookId: string;
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
  lookId: DEFAULT_LOOK_ID,
  gridVisible: false,
  spectrum: true,
  section: "tunnel",
};

/** Resolve a persisted look id, migrating pre-looks state that stored
 *  `fold` (2|4|8) + `mirror` (bool). Unknown → undefined (caller defaults). */
function resolveLookId(p: Record<string, unknown>): string | undefined {
  if (typeof p.lookId === "string" && getLook(p.lookId)) return p.lookId;
  // Legacy fold/mirror → nearest curated look.
  if (p.mirror === true) return "mandala";
  if (p.fold === 2) return "duo";
  if (p.fold === 8) return "kaleido";
  if (p.fold === 4) return "pinwheel";
  return undefined;
}

export function loadTunnelViewState(): TunnelViewState {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const section =
      p.section === "tunnel" ||
      p.section === "effects" ||
      p.section === "effort" ||
      p.section === "playback"
        ? p.section
        : DEFAULTS.section;
    return {
      lookId: resolveLookId(p) ?? DEFAULTS.lookId,
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
