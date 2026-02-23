/**
 * Conjoined Lab ITI Container
 *
 * Provides layout calculation services for the dual-grid conjoined visualization.
 */

import { createContainer } from "iti";
import { ConjoinedLayoutCalculator } from "$lib/features/conjoined-lab/services/implementations/ConjoinedLayoutCalculator";

export const conjoinedLabContainer = createContainer().add({
  conjoinedLayoutCalculator: () => new ConjoinedLayoutCalculator(),
});

export type ConjoinedLabContainer = typeof conjoinedLabContainer;
