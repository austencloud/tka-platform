import type { TunnelConfig } from "./tunnel-fold-math";

export interface TunnelPreset {
  id: string;
  name: string;
  config: TunnelConfig;
}

const STORAGE_KEY = "tka_tunnel_presets";

export function loadTunnelPresets(): TunnelPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TunnelPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveTunnelPresets(presets: TunnelPreset[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // quota exceeded / private browsing — non-fatal
  }
}
