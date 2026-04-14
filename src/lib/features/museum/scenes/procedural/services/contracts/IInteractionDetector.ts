import type { ExhibitSlot } from "../../domain/museum-types";

export interface InteractionTarget {
  slot: ExhibitSlot;
  distance: number;
}

export interface IInteractionDetector {
  findInteractableSlot(
    playerPosition: { x: number; y: number; z: number },
    cameraDirection: { x: number; y: number; z: number },
    slots: ExhibitSlot[]
  ): InteractionTarget | null;
}
