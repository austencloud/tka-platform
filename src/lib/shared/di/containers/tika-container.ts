/**
 * TIKA Module DI Container
 *
 * Manages dependencies for the TIKA AI assistant module.
 */
import { createContainer } from "iti";
import { TikaSessionRepository } from "$lib/features/tika/services/implementations/TikaSessionRepository";

export function createTikaContainer() {
  return createContainer().add({
    tikaSessionRepository: () => new TikaSessionRepository(),
  });
}

export type TikaContainer = ReturnType<typeof createTikaContainer>;
