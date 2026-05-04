export interface MuseumExhibit {
  slotId: string;
  sequenceId: string;
  assignedAt: number;
}

export interface ExhibitSlot {
  id: string;
  pavilionId: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  rotationY: number;
  type: "wall" | "performer";
}

export interface PavilionLayout {
  id: string;
  template: PavilionTemplate;
  position: { x: number; z: number };
  rotationY: number;
  walls: WallSegment[];
  slots: ExhibitSlot[];
}

export interface WallSegment {
  start: { x: number; z: number };
  end: { x: number; z: number };
  height: number;
  thickness: number;
}

export type PavilionTemplate = "alcove" | "corridor" | "courtyard" | "quad";

export interface MuseumGroundsLayout {
  clearingCenter: { x: number; z: number };
  clearingRadius: number;
  pavilions: PavilionLayout[];
}

export interface MuseumConfig {
  wallHeight: number;
  wallThickness: number;
  slotHeight: number;
  slotSpacing: number;
  platformRadius: number;
  platformHeight: number;
  platformOffset: number;
}

export const MUSEUM_DEFAULTS: MuseumConfig = {
  wallHeight: 4.0,
  wallThickness: 0.3,
  slotHeight: 1.6,
  slotSpacing: 2.5,
  platformRadius: 1.0,
  platformHeight: 0.3,
  platformOffset: 2.0,
};
