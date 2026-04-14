import type { WallSegment, PavilionTemplate } from "./museum-types";
import { MUSEUM_DEFAULTS } from "./museum-types";

const H = MUSEUM_DEFAULTS.wallHeight;
const T = MUSEUM_DEFAULTS.wallThickness;

export interface TemplateDefinition {
  id: PavilionTemplate;
  walls: WallSegment[];
  maxSlots: number;
}

export const ALCOVE_TEMPLATE: TemplateDefinition = {
  id: "alcove",
  walls: [
    { start: { x: -4, z: 0 }, end: { x: 4, z: 0 }, height: H, thickness: T },
    { start: { x: -4, z: 0 }, end: { x: -4, z: 6 }, height: H, thickness: T },
  ],
  maxSlots: 4,
};

export const CORRIDOR_TEMPLATE: TemplateDefinition = {
  id: "corridor",
  walls: [
    { start: { x: -3, z: -5 }, end: { x: -3, z: 5 }, height: H, thickness: T },
    { start: { x: 3, z: -5 }, end: { x: 3, z: 5 }, height: H, thickness: T },
  ],
  maxSlots: 6,
};

export const COURTYARD_TEMPLATE: TemplateDefinition = {
  id: "courtyard",
  walls: [
    { start: { x: -5, z: -4 }, end: { x: 5, z: -4 }, height: H, thickness: T },
    { start: { x: -5, z: -4 }, end: { x: -5, z: 4 }, height: H, thickness: T },
    { start: { x: 5, z: -4 }, end: { x: 5, z: 4 }, height: H, thickness: T },
  ],
  maxSlots: 8,
};

export const QUAD_TEMPLATE: TemplateDefinition = {
  id: "quad",
  walls: [
    { start: { x: -5, z: -5 }, end: { x: 5, z: -5 }, height: H, thickness: T },
    { start: { x: -5, z: -5 }, end: { x: -5, z: 5 }, height: H, thickness: T },
    { start: { x: 5, z: -5 }, end: { x: 5, z: 5 }, height: H, thickness: T },
    { start: { x: -2, z: 5 }, end: { x: -5, z: 5 }, height: H, thickness: T },
    { start: { x: 2, z: 5 }, end: { x: 5, z: 5 }, height: H, thickness: T },
  ],
  maxSlots: 12,
};

export const TEMPLATES: Record<PavilionTemplate, TemplateDefinition> = {
  alcove: ALCOVE_TEMPLATE,
  corridor: CORRIDOR_TEMPLATE,
  courtyard: COURTYARD_TEMPLATE,
  quad: QUAD_TEMPLATE,
};
