/**
 * TIKA Module DI Container
 *
 * Manages dependencies for the TIKA AI assistant module.
 */
import { createContainer } from "iti";
import { TIKASessionRepository } from "$lib/features/tika/services/implementations/TIKASessionRepository";

export function createTikaContainer() {
  return createContainer().add({
    tikaSessionRepository: () => new TIKASessionRepository(),
  });
}

export type TikaContainer = ReturnType<typeof createTikaContainer>;
