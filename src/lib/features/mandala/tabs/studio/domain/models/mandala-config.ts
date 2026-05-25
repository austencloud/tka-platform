import type { SymmetryFold, MirrorAxis } from "../enums/mandala-enums";

/**
 * Color scheme for mandala elements.
 */
export interface ColorScheme {
  /** Primary color (typically blue) - hex value */
  primary: string;
  /** Secondary color (typically red) - hex value */
  secondary: string;
  /** Optional accent color */
  accent?: string;
}

/**
 * Grid dot visibility configuration.
 */
export interface GridDotConfig {
  /** Show cardinal points (N, E, S, W) */
  showCardinal: boolean;
  /** Show intercardinal points (NE, SE, SW, NW) */
  showIntercardinal: boolean;
  /** Show center dot */
  showCenter: boolean;
  /** Dot radius in canvas units */
  dotRadius: number;
  /** Dot color (hex) */
  dotColor: string;
}

/**
 * Configuration for mandala generation and display.
 */
export interface MandalaConfig {
  /** Number of rotational symmetry folds */
  foldCount: SymmetryFold;

  /** Enable mirror reflections between folds */
  enableMirror: boolean;

  /** Mirror axis type */
  mirrorAxis: MirrorAxis;

  /** Rotation offset for entire mandala (degrees) */
  rotationOffset: number;

  /** Show grid dots as structural elements */
  showGridDots: boolean;

  /** Grid dot configuration */
  gridDotConfig: GridDotConfig;

  /** Color scheme for elements */
  colorScheme: ColorScheme;

  /** Global element scale multiplier */
  elementScale: number;

  /** Canvas background color (null = transparent) */
  backgroundColor: string | null;
}

/**
 * Default TKA blue color.
 */
export const TKA_BLUE = "#2e3192";

/**
 * Default TKA red color.
 */
export const TKA_RED = "#ed1c24";

/**
 * Default grid dot color (black).
 */
export const GRID_DOT_COLOR = "#000000";

/**
 * Default configuration for new mandalas.
 */
export const DEFAULT_MANDALA_CONFIG: MandalaConfig = {
  foldCount: 4,
  enableMirror: true,
  mirrorAxis: "vertical",
  rotationOffset: 0,
  showGridDots: true,
  gridDotConfig: {
    showCardinal: true,
    showIntercardinal: false,
    showCenter: true,
    dotRadius: 12,
    dotColor: GRID_DOT_COLOR,
  },
  colorScheme: {
    primary: TKA_BLUE,
    secondary: TKA_RED,
  },
  elementScale: 1,
  backgroundColor: null,
};

/**
 * Create a new config with partial overrides.
 */
export function createMandalaConfig(
  overrides?: Partial<MandalaConfig>
): MandalaConfig {
  return {
    ...DEFAULT_MANDALA_CONFIG,
    ...overrides,
    gridDotConfig: {
      ...DEFAULT_MANDALA_CONFIG.gridDotConfig,
      ...overrides?.gridDotConfig,
    },
    colorScheme: {
      ...DEFAULT_MANDALA_CONFIG.colorScheme,
      ...overrides?.colorScheme,
    },
  };
}
