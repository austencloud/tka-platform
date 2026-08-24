import type { CollectedTunnel } from "$lib/features/tunnel-collection/domain/tunnel-collection-types";

const STORAGE_KEY = "tka:tunnel-creator-handoff";

export interface TunnelCreatorHandoff {
  tunnelId: string;
  tunnelName: string;
  composition?: CollectedTunnel["composition"];
  formation: CollectedTunnel["snapshot"]["tunnel"]["config"];
  createdAt: number;
}

export function saveTunnelCreatorHandoff(tunnel: CollectedTunnel): void {
  if (typeof sessionStorage === "undefined") return;
  const handoff: TunnelCreatorHandoff = {
    tunnelId: tunnel.id,
    tunnelName: tunnel.name,
    composition: tunnel.composition,
    formation: tunnel.snapshot.tunnel.config,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
}

export function consumeTunnelCreatorHandoff(): TunnelCreatorHandoff | null {
  if (typeof sessionStorage === "undefined") return null;
  const serialized = sessionStorage.getItem(STORAGE_KEY);
  if (!serialized) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const handoff = JSON.parse(serialized) as TunnelCreatorHandoff;
    if (!handoff.tunnelId || !handoff.tunnelName || !handoff.formation) {
      return null;
    }
    return handoff;
  } catch {
    return null;
  }
}
