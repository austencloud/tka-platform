import { DEFAULT_CONFIG, FOLD_OPTIONS, type TunnelConfig } from "./tunnel-config";

/**
 * User-saved mandala presets — a personal library on top of the built-in
 * {@link TUNNEL_PRESETS}. You dial a look in the tuner, name it, and it joins the
 * preset grid. Persisted to localStorage (per device); built-ins are read-only,
 * only these are editable/deletable.
 */
export interface UserTunnelPreset {
  id: string;
  name: string;
  config: TunnelConfig;
}

const STORAGE_KEY = "tka_tunnel_user_presets";
const MAX_PRESETS = 24; // a sane cap — this is a personal shortlist, not a dump
const MAX_NAME = 40;

const bool = (v: unknown, f: boolean): boolean => (typeof v === "boolean" ? v : f);

/** Harden a persisted config back into a full, valid TunnelConfig. */
function coerceConfig(c: Partial<TunnelConfig> | undefined): TunnelConfig {
  if (!c || typeof c !== "object") return { ...DEFAULT_CONFIG };
  const fold = FOLD_OPTIONS.includes(c.fold as number) ? (c.fold as number) : DEFAULT_CONFIG.fold;
  return {
    fold,
    mirror: bool(c.mirror, false),
    flip: bool(c.flip, false),
    invert: bool(c.invert, false),
    echo: bool(c.echo, false),
    staggerSteps:
      typeof c.staggerSteps === "number" && c.staggerSteps > 0 ? Math.floor(c.staggerSteps) : 0,
    speed: bool(c.speed, false),
  };
}

function load(): UserTunnelPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p): p is Record<string, unknown> => !!p && typeof (p as { id?: unknown }).id === "string")
      .slice(0, MAX_PRESETS)
      .map((p) => ({
        id: String(p.id),
        name: String(p.name ?? "Mandala").slice(0, MAX_NAME),
        config: coerceConfig(p.config as Partial<TunnelConfig> | undefined),
      }));
  } catch {
    return [];
  }
}

function persist(list: UserTunnelPreset[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota exceeded / private browsing — non-fatal
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `u-${Date.now()}`;
}

class TunnelUserPresetStore {
  presets = $state<UserTunnelPreset[]>([]);

  constructor() {
    // Runs on first import; on the client localStorage is present, so the saved
    // library is available immediately. SSR yields an empty list (guarded).
    this.presets = load();
  }

  /** Save the current config as a named preset (appended; oldest trimmed at cap). */
  add(name: string, config: TunnelConfig): UserTunnelPreset {
    const preset: UserTunnelPreset = {
      id: newId(),
      name: name.trim().slice(0, MAX_NAME) || "My Mandala",
      config: { ...config },
    };
    this.presets = [...this.presets, preset].slice(-MAX_PRESETS);
    persist(this.presets);
    return preset;
  }

  remove(id: string): void {
    this.presets = this.presets.filter((p) => p.id !== id);
    persist(this.presets);
  }
}

export const tunnelUserPresets = new TunnelUserPresetStore();
