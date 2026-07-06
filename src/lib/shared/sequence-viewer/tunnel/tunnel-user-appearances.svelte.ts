import { coerceSkins, type TunnelAppearance } from "./tunnel-appearance";

/**
 * User-saved performer sets — a personal library on top of the built-in
 * {@link APPEARANCE_PRESETS}. You dial a cast in the Appearance panel, name it,
 * and it joins the preset grid. Persisted to localStorage (per device);
 * built-ins are read-only, only these are editable/deletable. Mirrors
 * {@link tunnelUserPresets} (mandala geometry) — separate library, same shape.
 */
export interface UserTunnelAppearance {
  id: string;
  name: string;
  skins: TunnelAppearance;
}

const STORAGE_KEY = "tka_tunnel_user_appearances";
const MAX_APPEARANCES = 24; // a personal shortlist, not a dump
const MAX_NAME = 40;

function load(): UserTunnelAppearance[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p): p is Record<string, unknown> => !!p && typeof (p as { id?: unknown }).id === "string")
      .slice(0, MAX_APPEARANCES)
      .map((p) => ({
        id: String(p.id),
        name: String(p.name ?? "Cast").slice(0, MAX_NAME),
        skins: coerceSkins(p.skins),
      }));
  } catch {
    return [];
  }
}

function persist(list: UserTunnelAppearance[]): void {
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
  return `a-${Date.now()}`;
}

class TunnelUserAppearanceStore {
  appearances = $state<UserTunnelAppearance[]>([]);

  constructor() {
    // Runs on first import; on the client localStorage is present, so the saved
    // library is available immediately. SSR yields an empty list (guarded).
    this.appearances = load();
  }

  /** Save a performer set as a named appearance (appended; oldest trimmed at cap). */
  add(name: string, skins: TunnelAppearance): UserTunnelAppearance {
    const appearance: UserTunnelAppearance = {
      id: newId(),
      name: name.trim().slice(0, MAX_NAME) || "My Cast",
      skins: coerceSkins(skins),
    };
    this.appearances = [...this.appearances, appearance].slice(-MAX_APPEARANCES);
    persist(this.appearances);
    return appearance;
  }

  remove(id: string): void {
    this.appearances = this.appearances.filter((a) => a.id !== id);
    persist(this.appearances);
  }
}

export const tunnelUserAppearances = new TunnelUserAppearanceStore();
