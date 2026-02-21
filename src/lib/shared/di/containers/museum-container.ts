import { createContainer } from "iti";
import { MuseumPersister } from "$lib/features/museum/services/implementations/MuseumPersister";
import { InteractionDetector } from "$lib/features/museum/services/implementations/InteractionDetector";

export function createMuseumContainer() {
  return createContainer()
    .add({
      museumPersister: () => new MuseumPersister(),
      interactionDetector: () => new InteractionDetector(),
    });
}

export type MuseumContainer = ReturnType<typeof createMuseumContainer>;
