/**
 * Page Layout Constants
 *
 * Constants and default values for page layout functionality.
 */

import type {
  DPIConfig,
  MeasurementUnit,
  PageMargins,
  PaperSpecification,
} from "../models/PageLayout";
import type { WordCardPaperSize } from "../types/PageLayoutTypes";

// ============================================================================
// CONSTANTS
// ============================================================================

export const PAPER_SIZES: Record<WordCardPaperSize, PaperSpecification> = {
  A4: {
    name: "A4",
    dimensions: { width: 595, height: 842 }, // 210mm x 297mm at 72 DPI
    displayName: "A4",
    description: '210mm × 297mm (8.27" × 11.69")',
  },
  A3: {
    name: "A3",
    dimensions: { width: 842, height: 1191 }, // 297mm x 420mm at 72 DPI
    displayName: "A3",
    description: '297mm × 420mm (11.69" × 16.54")',
  },
  Letter: {
    name: "Letter",
    dimensions: { width: 612, height: 792 }, // 8.5" x 11" at 72 DPI
    displayName: "US Letter",
    description: '8.5" × 11" (216mm × 279mm)',
  },
  Legal: {
    name: "Legal",
    dimensions: { width: 612, height: 1008 }, // 8.5" x 14" at 72 DPI
    displayName: "US Legal",
    description: '8.5" × 14" (216mm × 356mm)',
  },
  Tabloid: {
    name: "Tabloid",
    dimensions: { width: 792, height: 1224 }, // 11" x 17" at 72 DPI
    displayName: "Tabloid",
    description: '11" × 17" (279mm × 432mm)',
  },
};

export const DEFAULT_MARGINS: PageMargins = {
  top: 36, // 0.5 inch
  right: 18, // 0.25 inch
  bottom: 36, // 0.5 inch
  left: 18, // 0.25 inch
};

export const DEFAULT_DPI_CONFIG: DPIConfig = {
  screenDPI: 96,
  printDPI: 300,
  scaleFactor: 1.0,
};

export const MEASUREMENT_UNITS: Record<string, MeasurementUnit> = {
  points: { name: "points", pointsPerUnit: 1, displayName: "pt" },
  inches: { name: "inches", pointsPerUnit: 72, displayName: "in" },
  millimeters: {
    name: "millimeters",
    pointsPerUnit: 72 / 25.4,
    displayName: "mm",
  },
  centimeters: {
    name: "centimeters",
    pointsPerUnit: 72 / 2.54,
    displayName: "cm",
  },
};
