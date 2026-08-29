/**
 * Scoped flag: when set on a scan-origin /sequence host, descendant
 * ChoreoCards render their cells with probeCloud=true so a cold scanner
 * downloads pre-rendered pictograph images instead of rasterizing them.
 * Unset everywhere else (browse gallery, drawer viewer) => probeCloud stays off.
 */
import { getContext, setContext } from "svelte";

const KEY = Symbol("scan-card-cloud-probe");

export function setScanCardCloudProbe(enabled: boolean): void {
  setContext(KEY, enabled);
}

export function getScanCardCloudProbe(): boolean {
  return getContext<boolean>(KEY) ?? false;
}
