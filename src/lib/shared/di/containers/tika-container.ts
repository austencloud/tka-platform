/**
 * TIKA Module DI Container
 *
 * Manages dependencies for the TIKA AI assistant module.
 */
import { createContainer } from "iti";
import { TikaSessionRepository } from "$lib/features/tika/services/implementations/TikaSessionRepository";
import { TikaMarkdownParser } from "$lib/features/tika/services/implementations/TikaMarkdownParser";
import { TikaMessageExtractor } from "$lib/features/tika/services/implementations/TikaMessageExtractor";
import { TikaSessionFormatter } from "$lib/features/tika/services/implementations/TikaSessionFormatter";

export function createTikaContainer() {
  return createContainer().add({
    tikaSessionRepository: () => new TikaSessionRepository(),
    tikaMarkdownParser: () => new TikaMarkdownParser(),
    tikaMessageExtractor: () => new TikaMessageExtractor(),
    tikaSessionFormatter: () => new TikaSessionFormatter(),
  });
}

export type TikaContainer = ReturnType<typeof createTikaContainer>;
