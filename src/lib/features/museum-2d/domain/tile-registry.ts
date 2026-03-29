import type { TileType } from "./museum-grid-types";

export interface TileMetadata {
  walkable: boolean;
  interactable: boolean;
  solid: boolean;
  renders3D: boolean;
  cssClass: string;
  icon?: string;
  label: string;
}

const TILE_REGISTRY: Record<TileType, TileMetadata> = {
  floor:               { walkable: true,  interactable: false, solid: false, renders3D: true,  cssClass: "tile-floor",     label: "Floor" },
  wall:                { walkable: false, interactable: false, solid: true,  renders3D: true,  cssClass: "tile-wall",      label: "Wall" },
  door:                { walkable: true,  interactable: false, solid: false, renders3D: true,  cssClass: "tile-door",      label: "Door" },
  "exhibit-panel":     { walkable: false, interactable: true,  solid: true,  renders3D: true,  cssClass: "tile-exhibit",   label: "Exhibit", icon: "fa-image" },
  "performer-station": { walkable: false, interactable: true,  solid: true,  renders3D: true,  cssClass: "tile-performer", label: "Performer", icon: "fa-person" },
  torch:               { walkable: false, interactable: false, solid: false, renders3D: true,  cssClass: "tile-torch",     label: "Torch", icon: "fa-fire" },
  pedestal:            { walkable: false, interactable: true,  solid: true,  renders3D: true,  cssClass: "tile-pedestal",  label: "Pedestal", icon: "fa-cube" },
  trigger:             { walkable: true,  interactable: false, solid: false, renders3D: false, cssClass: "tile-trigger",   label: "Trigger" },
  corridor:            { walkable: true,  interactable: false, solid: false, renders3D: true,  cssClass: "tile-corridor",  label: "Corridor" },
  rope:                { walkable: false, interactable: false, solid: true,  renders3D: true,  cssClass: "tile-rope",      label: "Rope", icon: "fa-minus" },
  scaffolding:         { walkable: false, interactable: false, solid: true,  renders3D: true,  cssClass: "tile-scaffolding", label: "Scaffolding", icon: "fa-triangle-exclamation" },
  sign:                { walkable: false, interactable: true,  solid: true,  renders3D: false, cssClass: "tile-sign",      label: "Sign", icon: "fa-sign-hanging" },
};

export function getTileMetadata(type: TileType): TileMetadata {
  return TILE_REGISTRY[type];
}

export function isWalkable(type: TileType): boolean {
  return TILE_REGISTRY[type].walkable;
}

export function isSolid(type: TileType): boolean {
  return TILE_REGISTRY[type].solid;
}

export function isInteractable(type: TileType): boolean {
  return TILE_REGISTRY[type].interactable;
}
