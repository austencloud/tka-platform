/**
 * Placeable Object Registry
 *
 * Unified flat catalog of everything that can be placed in the museum editor -
 * wall fixtures, floor furniture, and anything else the placement system supports.
 *
 * The picker panel browses this list. The placement system reads it to know where
 * each object can go and how to position it.
 */

import type { MuseumFurnitureRole, WingTheme } from "./museum-grid-types";
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
  /** Furniture role consumed by MuseumModelLoader. */
  furnitureRole?: MuseumFurnitureRole;
  /** Half-width and half-depth of the collision footprint in metres. */
  collisionHalfExtents?: readonly [halfWidth: number, halfDepth: number];
  /** False while the editor cannot persist this placement category. */
  editorEnabled?: boolean;
  /** Optional material tint applied to a cloned GLB instance. */
  materialTint?: string;
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
  {
    id: "bench",
    label: "Museum bench",
    category: "furniture",
    surface: "floor",
    modelPath: "/assets/museum/models/furniture/bench.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 2.5,
    furnitureRole: "bench",
    collisionHalfExtents: [0.55, 0.3],
    materialTint: "#76563d",
    editorEnabled: false,
  },
  {
    id: "pedestal",
    label: "Display table",
    category: "furniture",
    surface: "floor",
    modelPath: "/assets/museum/models/furniture/tableCoffee.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 3.5,
    furnitureRole: "pedestal",
    collisionHalfExtents: [1.2, 0.75],
    materialTint: "#6a513d",
    editorEnabled: false,
  },
  {
    id: "bookshelf",
    label: "Closed bookcase",
    category: "furniture",
    surface: "floor_against_wall",
    modelPath: "/assets/museum/models/furniture/bookcaseClosedWide.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 2.5,
    furnitureRole: "bookshelf",
    collisionHalfExtents: [1.05, 0.36],
    materialTint: "#554235",
    editorEnabled: false,
  },
  {
    id: "lamp",
    label: "Floor lamp",
    category: "furniture",
    surface: "floor",
    modelPath: "/assets/museum/models/furniture/lampRoundFloor.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 2,
    furnitureRole: "lamp",
    collisionHalfExtents: [0.2, 0.2],
    editorEnabled: false,
  },
  {
    id: "plant",
    label: "Potted plant",
    category: "furniture",
    surface: "floor",
    modelPath: "/assets/museum/models/furniture/pottedPlant.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 2,
    furnitureRole: "plant",
    collisionHalfExtents: [0.28, 0.28],
    editorEnabled: false,
  },
  {
    id: "desk",
    label: "Reception desk",
    category: "furniture",
    surface: "floor_against_wall",
    modelPath: "/assets/museum/models/furniture/desk.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 2,
    furnitureRole: "desk",
    collisionHalfExtents: [0.78, 0.44],
    materialTint: "#6d523d",
    editorEnabled: false,
  },
  {
    id: "desk-chair",
    label: "Desk chair",
    category: "furniture",
    surface: "floor",
    modelPath: "/assets/museum/models/furniture/chairDesk.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 1.5,
    furnitureRole: "desk-chair",
    collisionHalfExtents: [0.28, 0.28],
    materialTint: "#6d523d",
    editorEnabled: false,
  },
  {
    id: "trashcan",
    label: "Waste bin",
    category: "furniture",
    surface: "floor",
    modelPath: "/assets/museum/models/furniture/trashcan.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 1.25,
    furnitureRole: "trashcan",
    collisionHalfExtents: [0.18, 0.18],
    materialTint: "#3f4548",
    editorEnabled: false,
  },
  {
    id: "coat-rack",
    label: "Coat rack",
    category: "furniture",
    surface: "floor_against_wall",
    modelPath: "/assets/museum/models/furniture/coatRackStanding.glb",
    mountHeight: 0,
    wallOffset: 0,
    scale: 2,
    furnitureRole: "coat-rack",
    collisionHalfExtents: [0.32, 0.32],
    materialTint: "#51443a",
    editorEnabled: false,
  },
  {
    id: "rug",
    label: "Rectangular rug",
    category: "furniture",
    surface: "floor",
    modelPath: "/assets/museum/models/furniture/rugRectangle.glb",
    mountHeight: 0.012,
    wallOffset: 0,
    scale: 2.5,
    furnitureRole: "rug",
    materialTint: "#67423f",
    editorEnabled: false,
  },
];

export function getPlaceableObject(id: string): PlaceableObjectDef | undefined {
  return PLACEABLE_OBJECTS.find((o) => o.id === id);
}

export function getFurnitureObjectByRole(
  role: MuseumFurnitureRole
): PlaceableObjectDef | undefined {
  return PLACEABLE_OBJECTS.find((object) => object.furnitureRole === role);
}

export const MUSEUM_FURNITURE_OBJECTS = PLACEABLE_OBJECTS.filter(
  (object): object is PlaceableObjectDef & { furnitureRole: MuseumFurnitureRole } =>
    object.category === "furniture" && object.furnitureRole !== undefined
);
