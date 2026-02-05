// ============================================================================
// @tka/pictograph - Shared pictograph rendering system
// ============================================================================

// Config injection
export type { PictographConfig } from "./config/PictographConfig";
export { DEFAULT_PICTOGRAPH_CONFIG } from "./config/PictographConfig";
export { setPictographConfig, getPictographConfig } from "./config/pictograph-context";

// Domain models (rendering-specific, not in @tka/types)
export type { PropPosition } from "./domain/PropPosition";
export type { PropAssets } from "./domain/PropAssets";
export type { PropRenderData } from "./domain/PropRenderData";
export type {
  ArrowAssets,
  ArrowPosition,
  ArrowState,
  ArrowLifecycleResult,
} from "./domain/arrow-models";
export {
  createArrowAssets,
  createArrowPosition,
  createArrowState,
  createArrowLifecycleResult,
} from "./domain/arrow-factories";
export type {
  PreparedRenderData,
  PreparedPictographData,
} from "./domain/PreparedPictographData";
export type {
  GridCoordinateData,
  GridData,
  GridDrawOptions,
  CombinedGridOptions,
  GenericGridDisplayOptions,
  GridValidationResult,
  GridPointData,
} from "./domain/grid-models";
export type {
  JsonPlacementData,
  GridPlacementData,
  AllPlacementData,
} from "./domain/PlacementDataTypes";

// Factories
export {
  createPictographData,
  createArrowPlacementData,
  createPropPlacementData,
  createPropPlacementFromPosition,
} from "./domain/factories";

// Constants
export { LETTER_TYPE_COLORS } from "./domain/pictograph-constants";
export { gridCoordinates } from "./constants/gridCoordinates";

// Arrow rotation maps
export {
  dashClockwiseMap,
  dashCounterClockwiseMap,
  dashNoRotationMap,
} from "./constants/arrow/DashRotationMaps";
export {
  floatClockwiseHandpathMap,
  floatCounterClockwiseHandpathMap,
} from "./constants/arrow/FloatRotationMaps";
export {
  proClockwiseMap,
  proCounterClockwiseMap,
  antiClockwiseMap,
  antiCounterClockwiseMap,
} from "./constants/arrow/ProAntiRotationMaps";
export {
  staticRadialClockwiseMap,
  staticRadialCounterClockwiseMap,
  staticNonRadialClockwiseMap,
  staticNonRadialCounterClockwiseMap,
  staticRadialOverrideMap,
  staticNonRadialOverrideMap,
} from "./constants/arrow/StaticRotationMaps";
export {
  type LocationPair,
  clockwiseCardinalPairs,
  counterClockwiseCardinalPairs,
  clockwiseDiagonalPairs,
  counterClockwiseDiagonalPairs,
  allClockwisePairs,
  allCounterClockwisePairs,
} from "./constants/arrow/HandpathDirectionMaps";

// Direction maps
export {
  LETTER_I_RADIAL_MAP,
  LETTER_I_NON_RADIAL_MAP,
  DIAMOND_RADIAL_MAP,
  DIAMOND_NON_RADIAL_MAP,
  BOX_RADIAL_MAP,
  BOX_NON_RADIAL_MAP,
  SHIFT_RADIAL_MAP,
  SHIFT_NON_RADIAL_MAP,
  type Loc,
  type DiamondLoc,
  type BoxLoc,
} from "./constants/DirectionMaps";

// Prop classification
export {
  BIG_UNILATERAL_PROPS,
  SMALL_UNILATERAL_PROPS,
  BIG_BILATERAL_PROPS,
  SMALL_BILATERAL_PROPS,
  BUUGENG_FAMILY_PROPS,
  isUnilateralProp,
  isBilateralProp,
  isBuugengFamilyProp,
  isBigProp,
  isSmallProp,
  getBilateralEndLabels,
  getBetaOffsetSize,
  type BigUnilateralProp,
  type SmallUnilateralProp,
  type BigBilateralProp,
  type SmallBilateralProp,
  type UnilateralProp,
  type BilateralProp,
} from "./constants/PropClassification";

// Prop type display registry
export {
  type PropTypeDisplayInfo,
  PROP_TYPE_DISPLAY_REGISTRY,
  VARIANT_PROP_TYPES,
  getAllPropTypes,
  getPropTypeDisplayInfo,
  findPropTypeByValue,
  hasVariations,
  getBasePropType,
  getAllVariations,
  getNextVariation,
  getVariationLabel,
  getVariationIndex,
  getTriquetraVariation,
} from "./constants/PropTypeDisplayRegistry";

// Utilities - arrow rotation
export {
  isClockwise,
  isCounterClockwise,
  isNoRotation,
  normalizeRotationDirection,
} from "./utils/arrow/RotationDirectionUtils";
export { RotationMapSelector } from "./utils/arrow/RotationMapSelector";

// Utilities - VTG
export {
  type VTGCalculationResult,
  calculateVTGFromPictograph,
  calculateVTG,
} from "./utils/vtg-calculator";

// Utilities - conversion
export {
  beatDataToPictographData,
  extractCorePictographData,
  pictographDataToStepData,
  hasStepContext,
  createStandalonePictographData,
} from "./utils/step-pictograph-conversion";

// Utilities - turn rendering
export {
  type TurnValue,
  type DirectionValue,
  type ParsedTurnsTuple,
  parseTurnsTuple,
  shouldDisplayTurn,
  getTurnNumberImagePath,
  getTurnNumberWidth,
} from "./utils/turn-tuple-parser";
export {
  type Dimensions,
  type Position,
  type TurnPositions,
  calculateTurnPositions,
} from "./utils/turn-position-calculator";

// Utilities - letter images
export {
  isDashLetter,
  getBaseLetter,
  getLetterImagePath,
} from "./utils/letter-image-getter";

// Utilities - rotation overrides
export {
  RotationOverrideChecker,
  type ISpecialPlacer,
  type IRotationAngleOverrideKeyGenerator,
} from "./utils/arrow/RotationOverrideChecker";

// Utilities - SVG colors
export {
  type ThemeMode,
  MOTION_COLOR_MAP,
  getMotionColor,
  applyColorToSvg,
  applyMotionColorToSvg,
} from "./utils/svg-color-utils";

// Utilities - grid coordinates
export {
  parseCoordinates,
  createGridPointData,
} from "./utils/grid-coordinate-utils";

// Utilities - direction
export {
  getOppositeDirection,
  getEndLocation,
} from "./services/prop/implementations/DirectionUtils";

// ============================================================================
// Services
// ============================================================================

// Grid services
export type { IGridModeDeriver } from "./services/grid/contracts/IGridModeDeriver";
export { GridModeDeriver } from "./services/grid/implementations/GridModeDeriver";
export type { IGridPositionDeriver } from "./services/grid/contracts/IGridPositionDeriver";
export { GridPositionDeriver } from "./services/grid/implementations/GridPositionDeriver";

// Arrow rendering services
export type { IArrowPathResolver } from "./services/arrow/rendering/contracts/IArrowPathResolver";
export { ArrowPathResolver } from "./services/arrow/rendering/implementations/ArrowPathResolver";
export type { IArrowSvgColorTransformer } from "./services/arrow/rendering/contracts/IArrowSvgColorTransformer";
export { ArrowSvgColorTransformer } from "./services/arrow/rendering/implementations/ArrowSvgColorTransformer";
export type { IArrowSvgParser } from "./services/arrow/rendering/contracts/IArrowSvgParser";
export { ArrowSvgParser } from "./services/arrow/rendering/implementations/ArrowSvgParser";
export type {
  IArrowSvgLoader,
  ArrowSvgLoadOptions,
} from "./services/arrow/rendering/contracts/IArrowSvgLoader";
export { ArrowSvgLoader } from "./services/arrow/rendering/implementations/ArrowSvgLoader";

// Arrow positioning services
export type { IArrowLocationCalculator } from "./services/arrow/positioning/contracts/IArrowLocationCalculator";
export { ArrowLocationCalculator } from "./services/arrow/positioning/implementations/ArrowLocationCalculator";
export type { IArrowRotationCalculator } from "./services/arrow/positioning/contracts/IArrowRotationCalculator";
export { ArrowRotationCalculator } from "./services/arrow/positioning/implementations/ArrowRotationCalculator";
export type { IDashLocationCalculator } from "./services/arrow/positioning/contracts/IDashLocationCalculator";
export { DashLocationCalculator } from "./services/arrow/positioning/implementations/DashLocationCalculator";
export type { IShiftLocationCalculator } from "./services/arrow/positioning/contracts/IShiftLocationCalculator";
export { ShiftLocationCalculator } from "./services/arrow/positioning/implementations/ShiftLocationCalculator";
export type { IStaticLocationCalculator } from "./services/arrow/positioning/contracts/IStaticLocationCalculator";
export { StaticLocationCalculator } from "./services/arrow/positioning/implementations/StaticLocationCalculator";
export type {
  HandpathDirection,
  IHandpathDirectionCalculator,
} from "./services/arrow/positioning/contracts/IHandpathDirectionCalculator";
export { HandpathDirectionCalculator } from "./services/arrow/positioning/implementations/HandpathDirectionCalculator";

// Prop services
export { PropRotAngleManager } from "./services/prop/implementations/PropRotAngleManager";
export type { IBetaDetector } from "./services/prop/contracts/IBetaDetector";
export { BetaDetector } from "./services/prop/implementations/BetaDetector";
export type { IOrientationChecker } from "./services/prop/contracts/IOrientationChecker";
export { OrientationChecker } from "./services/prop/implementations/OrientationChecker";
export type { IDirectionCalculator } from "./services/prop/contracts/IDirectionCalculator";
export { ShiftMotionHandler } from "./services/prop/implementations/ShiftMotionHandler";
export { StaticDashMotionHandler } from "./services/prop/implementations/StaticDashMotionHandler";
export { LetterIHandler } from "./services/prop/implementations/LetterIHandler";
export { LetterGHHandler } from "./services/prop/implementations/LetterGHHandler";
export { LetterYZHandler } from "./services/prop/implementations/LetterYZHandler";
export { BetaPropDirectionCalculator } from "./services/prop/implementations/BetaPropDirectionCalculator";
export { DefaultPropPositioner } from "./services/prop/implementations/DefaultPropPositioner";
export type {
  IPropSvgLoader,
  PropSvgLoadOptions,
} from "./services/prop/contracts/IPropSvgLoader";
export { PropSvgLoader } from "./services/prop/implementations/PropSvgLoader";
export type { IPropPlacer } from "./services/prop/contracts/IPropPlacer";
export { PropPlacer } from "./services/prop/implementations/PropPlacer";

// Shared services
export type { ISvgPreloader } from "./services/shared/contracts/ISvgPreloader";
export { SvgPreloader } from "./services/shared/implementations/SvgPreloader";
