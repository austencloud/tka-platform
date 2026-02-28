/**
 * Mandala Generator ITI Container
 *
 * Provides services for mandala generation and transformation.
 */

import { createContainer } from "iti";
import { MandalaTransformer } from "$lib/features/mandala-generator/services/implementations/MandalaTransformer";

export const mandalaContainer = createContainer().add({
  mandalaTransformer: () => new MandalaTransformer(),
});

export type MandalaContainer = typeof mandalaContainer;
