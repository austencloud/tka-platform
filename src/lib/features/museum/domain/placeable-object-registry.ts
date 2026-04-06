/**
 * Placeable Object Registry
 *
 * Unified flat catalog of everything that can be placed in the museum editor —
 * wall fixtures, floor furniture, and anything else the placement system supports.
 *
 * The picker panel browses this list. The placement system reads it to know where
 * each object can go and how to position it.
 */

import type { WingTheme } from "./museum-grid-types";
import { FIXTURE_REGISTRY } from "./fixture-registry";

/** Where on the room geometry an object can be mounted */
export type PlacementSurface = "wall" | "floor" | "floor_against_wall";

export interface PlaceableObjectDef {
  id: string;
  label: string;
  category: "fixture" | "furniture";
  surface: PlacementSurface;
  modelPath: string;
  /** Height above floor where the object's origin is mounted (metres) */
  mountHeight: number;
  /** Distance the object is pulled away from the wall surface (metres) */
  wallOffset: number;
  scale: number;
  /** Which wing theme this fixture belongs to (fixtures only) */
  wingTheme?: WingTheme;
  hasFlame?: boolean;
  hasEmbers?: boolean;
  lightColor?: string;
  lightIntensity?: number;
}

function buildFixtureDefs(): PlaceableObjectDef[] {
  const entries = Object.entries(FIXTURE_REGISTRY) as [
    WingTheme,
    (typeof FIXTURE_REGISTRY)[WingTheme],
  ][];
  return entries.map(([theme, config]) => ({
    id: `${theme}-fixture`,
    label: `${config.label} (${config.era})`,
    category: "fixture" as const,
    surface: "wall" as const,
    modelPath: config.modelPath,
    mountHeight: 1.25,
    wallOffset: 0.175,
    scale: config.scale,
    wingTheme: theme,
    hasFlame: config.hasFlame,
    hasEmbers: config.hasEmbers,
    lightColor: config.lightColor,
    lightIntensity: config.lightIntensity,
  }));
}

export const PLACEABLE_OBJECTS: PlaceableObjectDef[] = [
  ...buildFixtureDefs(),
];

export function getPlaceableObject(id: string): PlaceableObjectDef | undefined {
  return PLACEABLE_OBJECTS.find((o) => o.id === id);
}
