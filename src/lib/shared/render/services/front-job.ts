import type { CardFrontLayout } from "./card-front-assembler";
import type { LayerRenderOptions, LayerVisibility } from "./types";
import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { MandalaPaths, MandalaPalette } from "../../mandala/domain/mandala-types";
import type { MandalaPlacement } from "../../sequence-viewer/services/getMandalaPlacements";

export interface FrontJobCell {
  prepared: PreparedPictographData;
  col: number;
  row: number;
  stepNumber: number | undefined;
  duration: number;
}

export interface FrontJobMandala {
  paths: MandalaPaths;
  placements: MandalaPlacement[];
  palette: MandalaPalette;
}

export interface FrontJobQr {
  /** Payload URL, resolved on the main thread (shortcode already resolved). */
  matrixText: string;
  cell: { col: number; row: number };
  darkColor: string;
  lightColor: string;
  eccLevel: "L" | "M" | "Q" | "H";
}

export interface FrontJobFooter {
  show: boolean;
  leftLabel?: string;
  rightLabel?: string;
  notes?: string;
  /**
   * Footer element icon (TnD `iconPath`), rasterized to a bitmap on the MAIN
   * thread in buildFrontJob and carried INLINE in the job (it is per-card, not
   * part of the per-deck glyph seed). Undefined when no iconPath is set.
   * TRANSFERABLE — composeFront (Task 8) must include this in the postMessage
   * transfer list when present.
   */
  iconBitmap?: ImageBitmap;
  textColor: string;
  mutedColor: string;
}

export interface FrontJobHeader {
  show: boolean;
  word: string;
}

/**
 * Fully plain (structuredClone-able, no class instances / functions) description
 * of a card front, built on the main thread and rendered in a worker by
 * paintFrontJob. See docs/superpowers/specs/active/2026-05-30-full-card-in-worker-design.md.
 */
export interface FrontJob {
  canvasWidth: number;
  canvasHeight: number;
  layout: CardFrontLayout;
  cells: FrontJobCell[];
  cellOptions: LayerRenderOptions;
  cellVisibility: LayerVisibility;
  background: { fill: string; accentColor?: string; accentTintOpacity?: number };
  isDarkMode: boolean;
  mandala: FrontJobMandala | null;
  qr: FrontJobQr | null;
  header: FrontJobHeader;
  footer: FrontJobFooter;
}
