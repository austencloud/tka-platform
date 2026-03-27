import type { MuseumExhibit } from "../../domain/museum-types";

export interface MuseumMetadata {
  name: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
}

export interface IMuseumPersister {
  loadMuseum(userId: string): Promise<{
    meta: MuseumMetadata;
    exhibits: Map<string, MuseumExhibit>;
  } | null>;

  saveExhibit(userId: string, slotId: string, sequenceId: string): Promise<void>;
  removeExhibit(userId: string, slotId: string): Promise<void>;
  updateMetadata(userId: string, meta: Partial<MuseumMetadata>): Promise<void>;
  createMuseum(userId: string, name: string): Promise<void>;
}
