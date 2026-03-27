/**
 * Sequence Mandala ITI Container
 *
 * Provides services for rendering sequence-derived mandalas:
 * - MandalaGeometryCalculator: computes prop tip paths from sequence steps
 * - MandalaRenderer: renders MandalaPaths to SVG or Canvas
 */

import { createContainer } from "iti";
import { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";
import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";

export const sequenceMandalaContainer = createContainer()
	.add({ mandalaGeometryCalculator: () => new MandalaGeometryCalculator() })
	.add({ mandalaRenderer: () => new MandalaRenderer() });

export type SequenceMandalaContainer = typeof sequenceMandalaContainer;
