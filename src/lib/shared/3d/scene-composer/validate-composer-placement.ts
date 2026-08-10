import type { ComposerPlacement, PlacementConstraints } from "./types";

interface ValidationOptions {
  isNew?: boolean;
  ignoreId?: string;
}

export function validateComposerPlacement(
  placement: ComposerPlacement,
  existing: ComposerPlacement[],
  constraints: PlacementConstraints | undefined,
  options: ValidationOptions = {}
): string | null {
  if (!constraints) return null;
  const peers = existing.filter((item) => item.id !== options.ignoreId);
  const catalogPeers = peers.filter((item) => item.source !== "native");

  if (
    options.isNew &&
    constraints.maxObjects !== undefined &&
    catalogPeers.length >= constraints.maxObjects
  ) {
    return `Scene limit: ${constraints.maxObjects} objects`;
  }

  const typeLimit = constraints.maxPerType?.[placement.objectKey];
  if (
    options.isNew &&
    typeLimit !== undefined &&
    catalogPeers.filter((item) => item.objectKey === placement.objectKey)
      .length >= typeLimit
  ) {
    return `${placement.objectKey} limit: ${typeLimit}`;
  }

  for (const zone of constraints.exclusionZones ?? []) {
    const dx = placement.position[0] - zone.center[0];
    const dy = placement.position[1] - zone.center[1];
    const dz = placement.position[2] - zone.center[2];
    if (dx * dx + dy * dy + dz * dz < zone.radius * zone.radius) {
      return zone.reason;
    }
  }

  if (constraints.minSpacing !== undefined) {
    for (const peer of peers) {
      if (peer.visible === false) continue;
      const dx = placement.position[0] - peer.position[0];
      const dz = placement.position[2] - peer.position[2];
      if (Math.hypot(dx, dz) < constraints.minSpacing) {
        return `Keep props ${constraints.minSpacing}m apart`;
      }
    }
  }

  return constraints.validate?.(placement, peers) ?? null;
}
