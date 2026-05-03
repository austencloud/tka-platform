import type { CreateModuleEffectCoordinator } from "../implementations/CreateModuleEffectCoordinator";
import type { CreateModuleHandlers } from "../implementations/CreateModuleHandlers";
import type { DeepLinkSequenceHandler } from "../implementations/DeepLinkSequenceHandler";
import type { FirstStepAnalyzer } from "../implementations/FirstStepAnalyzer";
import type { NavigationSyncer } from "../implementations/NavigationSyncer";
import type { PanelPersister } from "../implementations/PanelPersister.svelte";
import type { SequenceJsonExporter } from "../implementations/SequenceJsonExporter";
import type { SequenceTransferHandler } from "../implementations/SequenceTransferHandler";
import type { SubDrawerStatePersister } from "../implementations/SubDrawerStatePersister";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { NavigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
import type { CreateModuleState } from "../../state/create-module-state.svelte";
import type { ConstructTabState } from "../../state/construct-tab-state.svelte";
import type { PanelCoordinationState } from "../../state/panel-coordination-state.svelte";
import type { ResponsiveLayoutManager } from "../implementations/ResponsiveLayoutManager";
import type { StepOperator } from "../implementations/StepOperator";
import type { Autosaver } from "../../services/Autosaver";
import type { LetterSource } from "$lib/features/create/spell/domain/models/spell-models";
import type { SequenceRepository } from "../implementations/SequenceRepository";
import type { SequencePersister } from "../implementations/SequencePersister";
import type { CreateModuleOrchestrator } from "../implementations/CreateModuleOrchestrator";
import type { StartPositionManager } from "$lib/features/create/construct/start-position-picker/services/implementations/StartPositionManager";
import type { ICreateModuleState } from "../../types/create-module-types";
import type { GeneratorTabState } from "../../state/generator-tab-state.svelte";
import type { AssembleTabState } from "../../state/assemble-tab-state.svelte";
import type { DurationPattern } from "../../domain/models/DurationPatternData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPType, Period } from "$lib/features/create/generate/circular/domain/models/circular-models";
export type { LOOPType };
import type { RotationDirectionPattern } from "../../domain/models/RotationDirectionPatternData";
import type { TurnPattern } from "../../domain/models/TurnPatternData";
import type { ActiveCreateModule } from "$lib/shared/foundation/ui/UITypes";
import type { Sharer } from "../../../../../shared/share/services/implementations/Sharer";

/**
 * Arrow selection context for adjustment operations
 */
export interface SelectedArrowContext {
  motionData: MotionData;
  pictographData: PictographData;
  color: MotionColor | string;
}

/**
 * Result of applying a WASD movement
 */
export interface ApplyMovementResult {
  /** The key used for saving (for auto-save scheduling) */
  targetKey: AdjustmentTargetKey;
  /** New X adjustment value */
  newX: number;
  /** New Y adjustment value */
  newY: number;
  /** Whether the operation succeeded */
  success: boolean;
}

/**
 * Target key for adjustment storage
 */
export interface AdjustmentTargetKey {
  gridMode: string;
  oriKey: string;
  letter: string;
  turnsTuple: string;
  arrowKey: string;
  propType?: string;
}

/**
 * Result of looking up current adjustment via cascading
 */
export interface CascadingLookupResult {
  adjustment: { x: number; y: number };
  layer: 1 | 2 | 3 | null;
}

/**
 * Configuration for CreateModule effects
 */
export interface CreateModuleEffectConfig {
  // State accessors (use getters to avoid stale closures)
  getCreateModuleState: () => CreateModuleState | null;
  getConstructTabState: () => ConstructTabState | null;
  panelState: PanelCoordinationState;
  navigationState: NavigationState;

  // Services
  layoutService: ResponsiveLayoutManager;
  NavigationSyncer: NavigationSyncer;
  getDeepLinker: () => DeepLinkSequenceHandler | null;
  getStepOperator: () => StepOperator | null;
  getAutosaver: () => Autosaver | null;

  // State flags
  isServicesInitialized: () => boolean;

  // Layout callbacks
  onLayoutChange: (shouldUseSideBySideLayout: boolean) => void;
  getShouldUseSideBySideLayout: () => boolean;
  setAnimatingStepNumber: (beat: number | null) => void;

  // Optional callbacks
  onCurrentWordChange?: (word: string) => void;
  onLetterSourcesChange?: (sources: LetterSource[] | null) => void;
  onTabAccessibilityChange?: (canAccess: boolean) => void;
}

/**
 * Parameters for clear sequence handler
 */
export interface ClearSequenceParams {
  CreateModuleState: CreateModuleState;
  constructTabState: ConstructTabState;
  panelState: PanelCoordinationState;
}

export interface CreateModuleInitializationResult {
  // State objects
  CreateModuleState: ICreateModuleState;
  constructTabState: ConstructTabState;
  // ARCHIVED: assemblerTabState removed (Feb 2026)
  generatorTabState: GeneratorTabState;
  // REMOVED: spellTabState - Spell mode unified into Generate tab (Feb 2026)
  assembleTabState: AssembleTabState;

  // Core services
  sequenceService: SequenceRepository;
  SequencePersister: SequencePersister;
  StartPositionManager: StartPositionManager;
  CreateModuleOrchestrator: CreateModuleOrchestrator;
  layoutService: ResponsiveLayoutManager;
  NavigationSyncer: NavigationSyncer;
  StepOperator: StepOperator;

  // UI coordination services
  handlers: CreateModuleHandlers;
  effectCoordinator: CreateModuleEffectCoordinator;
  deepLinkService: DeepLinkSequenceHandler;
  shareService: Sharer;
  panelPersistenceService: PanelPersister;
}

export interface SequenceLoadResult {
  /** Whether a sequence was loaded from deep link or pending edit */
  sequenceLoaded: boolean;
  /** Tab to navigate to (from deep link) */
  targetTab?: string;
  /** Whether creation method should be marked as selected */
  shouldMarkMethodSelected: boolean;
}

/**
 * Deep Link Sequence Service Contract
 *
 * Handles loading sequences from:
 * - Deep link URLs (shareable links)
 * - Pending edit transfers from Browser module
 *
 * Encapsulates the complex sequence enrichment logic
 * (position derivation, letter derivation, merging).
 *
 * Domain: Create module - Sequence Loading
 */
export interface DeepLinkLoadResult {
  /** Whether a sequence was loaded */
  loaded: boolean;
  /** The tab to navigate to (if specified in deep link) */
  targetTab?: string;
  /** Source of the loaded sequence */
  source?: "deepLink" | "pendingEdit";
}

/**
 * Result of applying a duration pattern to a sequence
 */
export interface DurationPatternApplyResult {
  /** Whether the application was successful */
  readonly success: boolean;
  /** The modified sequence (if successful) */
  readonly sequence?: SequenceData;
  /** Error message if not successful */
  readonly error?: string;
  /** Number of steps that were modified */
  readonly modifiedSteps?: number;
  /** Warnings about edge cases encountered */
  readonly warnings?: readonly string[];
}

/**
 * Result of starting an extension flow
 */
export interface ExtensionFlowStart {
  /** Whether extension is possible at all */
  canExtend: boolean;
  /** Analysis of the sequence's extension potential */
  analysis: ExtensionAnalysis | null;
  /** Bridge options if direct LOOPs not available */
  circularizationOptions: CircularizationOption[];
  /** Reason direct extension isn't available (if applicable) */
  directUnavailableReason: string | null;
  /** Error message if extension is impossible */
  errorMessage: string | null;
}

/**
 * Result of appending a bridge beat
 */
export interface BridgeAppendResult {
  /** Whether the bridge was successfully appended */
  success: boolean;
  /** The sequence with bridge appended (if successful) */
  sequence: SequenceData | null;
  /** Updated analysis after adding bridge */
  analysis: ExtensionAnalysis | null;
  /** Message to display to user */
  message: string;
}

/**
 * Result of applying a LOOP extension
 */
export interface ExtensionApplyResult {
  /** Whether the extension was successful */
  success: boolean;
  /** The extended sequence (if successful) */
  sequence: SequenceData | null;
  /** Number of steps added */
  stepsAdded: number;
  /** Message to display to user */
  message: string;
}

/**
 * FirstStepAnalyzer
 *
 * Pure logic for analyzing "First Beat" operations.
 * When user selects a beat to become the new first beat,
 * this determines if confirmation is needed and calculates results.
 */
export type FirstBeatAnalysisResult =
  | { action: "no-op"; reason: string }
  | { action: "immediate"; stepNumber: number }
  | { action: "confirm-needed"; stepNumber: number; stepsToRemove: number };

export interface FirstBeatResult {
  success: boolean;
  stepsRemoved: number;
  message: string;
}

/**
 * Result of validating LOOP options for a position pair
 */
export interface LOOPValidationResult {
  /** LOOP options that are valid for this position pair */
  available: LOOPOption[];
  /** LOOP options that exist but aren't valid for this position pair */
  unavailable: LOOPOption[];
}

/**
 * Create Module Navigation Sync Service Contract
 *
 * Handles bidirectional synchronization between global navigation state and Create Module state.
 * Manages tab switching within Create Module's tool panel (Construct and Generate).
 * Includes tab accessibility validation and navigation guard logic for construction workflow.
 *
 * Note: "animate" and "share" are now separate panels (not tabs within the tool panel).
 * "record" has not been reintegrated yet.
 *
 * Domain: Create Module - Navigation within Sequence Construction Interface
 * Extracted from CreateModule.svelte monolith to follow DI architecture.
 */
export type CreateTab = "construct" | "generate";

/** @deprecated Use CreateTab instead */
export type BuildSection = CreateTab;

/**
 * Minimal interface for CreateModule state needed for navigation sync
 */
export interface CreateModuleStateForSync {
  activeSection: string;
  isPersistenceInitialized: boolean;
  isNavigatingBack: boolean;
  isUpdatingFromToggle: boolean;
  canAccessEditTab: boolean;
  setActiveToolPanel: (panel: string) => void;
}

/**
 * Minimal interface for navigation state needed for navigation sync
 */
export interface NavigationStateForSync {
  currentSection: string;
  setCurrentSection: (section: string) => void;
}

/**
 * Panel Persistence Service Contract
 *
 * Manages saving and restoring panel states across navigation.
 * Handles the complex logic of:
 * - Detecting user-initiated panel closes vs navigation closes
 * - Saving open panel when navigating away
 * - Restoring panels when returning to a tab
 * - Closing all panels on module/tab changes
 */
export type PanelId =
  | "animation"
  | "stepEditor"
  | "videoRecord"
  | "filter"
  | "sequenceActions"
  | "cap"
  | "customize";

/**
 * Reversal Detection Service Contract
 *
 * Detects reversals between steps in sequences based on prop rotation direction changes.
 */
export interface ReversalInfo {
  blueReversal: boolean;
  redReversal: boolean;
}

export interface PictographWithReversals extends PictographData {
  blueReversal: boolean;
  redReversal: boolean;
}

/**
 * Specifies which hand(s) to apply pattern changes to
 */
export type TargetHand = "blue" | "red" | "both";

/**
 * Result of applying a rotation direction pattern to a sequence
 */
export interface RotationDirectionPatternApplyResult {
  /** Whether the application was successful */
  readonly success: boolean;
  /** The modified sequence (if successful) */
  readonly sequence?: SequenceData;
  /** Error message if not successful */
  readonly error?: string;
  /** Number of steps that were modified */
  readonly modifiedSteps?: number;
  /** Warnings about edge cases encountered (e.g., skipped motions) */
  readonly warnings?: readonly string[];
}

/**
 * Circular Sequence Type
 *
 * Defines the relationship between start and end positions:
 * - 'same': Ends at exact same position (e.g., beta1 to beta1)
 * - 'halved': Ends at opposite position (e.g., beta1 to beta5)
 * - 'quartered': Ends at adjacent 90° position (e.g., beta1 to beta3 or beta7)
 */
export type CircularType = "same" | "halved" | "quartered";

/**
 * LOOP (Linked Orbital Offset Pattern) Type
 *
 * Strict variations based on rotation and mirroring:
 * - 'rotated': Pure rotation without mirroring
 * - 'mirrored': Pure mirroring without rotation
 * - 'rotated-mirrored': Combination of rotation and mirroring
 * - 'static': No rotation or mirroring (same position)
 */
export type StrictLoopType =
  | "rotated"
  | "mirrored"
  | "rotated-mirrored"
  | "static";

/**
 * Circularity Analysis Result
 *
 * Complete analysis of a sequence's circular properties.
 */
export interface CircularityAnalysis {
  /** Whether the sequence forms a valid circular pattern */
  readonly isCircular: boolean;

  /** Type of circular relationship (same/halved/quartered) */
  readonly circularType: CircularType | null;

  /** Starting position of the sequence */
  readonly startPosition: GridPosition | null;

  /** Ending position of the sequence */
  readonly endPosition: GridPosition | null;

  /** Whether start position is a beta position */
  readonly startIsBeta: boolean;

  /** Whether end position is a beta position */
  readonly endIsBeta: boolean;

  /** Possible LOOP types this sequence could become */
  readonly possibleLoopTypes: readonly StrictLoopType[];

  /** Human-readable description of the circular relationship */
  readonly description: string;
}

/**
 * Result of equivalence comparison
 */
export interface EquivalenceResult {
  /** Whether the sequences are equivalent under any supported transform */
  readonly isEquivalent: boolean;

  /** Type of equivalence found (if any) */
  readonly equivalenceType: EquivalenceType | null;

  /** Details about the transform that makes them equivalent */
  readonly transform: TransformDetails | null;
}

/**
 * Types of equivalence supported
 */
export type EquivalenceType =
  | "identical" // Exact same sequence
  | "spatial-rotation" // Same sequence rotated around grid
  | "circular-rotation" // Same circular sequence starting at different beat
  | "combined"; // Both spatial and circular rotation

/**
 * Details about the transform that makes sequences equivalent
 */
export interface TransformDetails {
  /** Number of 45° steps rotated (0-7), null if no spatial rotation */
  readonly spatialRotationSteps: number | null;

  /** Number of beats shifted in circular sequence, null if no circular rotation */
  readonly circularOffset: number | null;

  /** Whether grid mode changed (odd spatial rotation steps) */
  readonly gridModeToggled: boolean;
}

/**
 * Canonical signature for a sequence
 * Used for efficient comparison and hashing
 */
export interface SequenceSignature {
  /** Word (letter sequence) */
  readonly word: string;

  /** Number of steps */
  readonly stepCount: number;

  /** Whether sequence is circular */
  readonly isCircular: boolean;

  /** Normalized beat signatures (rotation-invariant) */
  readonly beatSignatures: readonly StepSignature[];

  /** Hash for quick inequality check */
  readonly hash: string;
}

/**
 * Rotation-invariant signature for a single beat
 */
export interface StepSignature {
  /** Blue motion signature */
  readonly blue: MotionSignature;

  /** Red motion signature */
  readonly red: MotionSignature;

  /** Position group (alpha, beta, gamma, etc.) - not the numbered variant */
  readonly positionGroup: string;
}

/**
 * Rotation-invariant signature for a single motion
 */
export interface MotionSignature {
  /** Motion type: pro, anti, static, dash */
  readonly type: string;

  /** Rotation direction: cw, ccw, noRotation */
  readonly direction: string;

  /** Number of turns */
  readonly turns: number | string;

  /** Orientation transition: in→in, in→out, out→in, out→out */
  readonly orientationTransition: string;
}

/**
 * Input sequence data structure with required fields for export
 */
export interface ExportableSequenceData {
  word: string;
  startingPosition?: StepData;
  startPosition?: StepData;
  steps?: readonly StepData[];
}

/**
 * Condensed sequence data structure
 * Contains only essential information needed to reconstruct the sequence
 */
export interface CondensedSequenceData {
  word: string;
  startPosition?: CondensedStartPosition;
  steps: CondensedStepData[];
}

/**
 * Condensed start position data
 */
export interface CondensedStartPosition {
  letter: string;
  gridPosition?: string;
  motions: {
    blue: CondensedStartMotion;
    red: CondensedStartMotion;
  };
}

/**
 * Condensed start motion data (location and orientation only)
 */
export interface CondensedStartMotion {
  startLocation: string;
  startOrientation: string;
}

/**
 * Condensed step data
 */
export interface CondensedStepData {
  letter: string;
  stepNumber: number;
  gridPosition?: string;
  duration: number;
  blueReversal: boolean;
  redReversal: boolean;
  motions: {
    blue: CondensedMotionData;
    red: CondensedMotionData;
  };
}

/**
 * Condensed motion data (essential fields only)
 */
export interface CondensedMotionData {
  motionType: string;
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  turns: number;
  startOrientation: string;
  endOrientation: string;
}

/**
 * Describes the type of extension available for a sequence
 */
export type ExtensionType =
  | "already_complete" // End position equals start position
  | "half_rotation" // End position is 180° rotation of start (4 positions away)
  | "quarter_rotation" // End position is 90° rotation of start (2 positions away)
  | "not_extendable"; // End position is not a rotation of start

/**
 * Describes a single LOOP option available for extension
 * LOOP = Linked Orbital Offset Pattern
 */
export interface LOOPOption {
  /** The LOOP type */
  loopType: LOOPType;
  /** Human-readable name */
  name: string;
  /** Short description of what this LOOP does */
  description: string;
  /** Icon class (FontAwesome) */
  icon: string;
}

/**
 * Result of analyzing whether a sequence can be extended
 */
export interface ExtensionAnalysis {
  /** Whether extension is available */
  canExtend: boolean;
  /** The type of extension possible */
  extensionType: ExtensionType;
  /** Start position of the sequence */
  startPosition: GridPosition | null;
  /** Current end position of the sequence */
  currentEndPosition: GridPosition | null;
  /** Available LOOP options for extension (will actually work) */
  availableLOOPOptions: LOOPOption[];
  /** Unavailable LOOP options (exist but won't work for this sequence) */
  unavailableLOOPOptions: LOOPOption[];
  /** Human-readable description of the extension */
  description: string;
}

/**
 * Options for generating extension steps
 */
export interface ExtensionOptions {
  /** The LOOP type to use for extension */
  loopType: LOOPType;
  /** Period override (halved=2×, quartered=4×). If omitted, derived from position pair. */
  period?: import("$lib/features/create/generate/circular/domain/models/circular-models").Period;
  /** Difficulty level (1-3) */
  difficulty?: number;
  /** Turn intensity (0-1) */
  turnIntensity?: number;
}

/**
 * Describes the rotation relationship between end position and start position.
 * This affects which LOOPs are available and final sequence length.
 */
export type RotationRelation =
  | "exact" // End position equals start position (0°)
  | "quarter" // End position is 90° rotation of start (4x sequence length with rotated LOOPs)
  | "half"; // End position is 180° rotation of start (2x sequence length with mirrored LOOPs)

/**
 * Describes orientation alignment status for exact position matches.
 * When a sequence returns to its start position, orientations may or may not match.
 */
export interface OrientationAlignment {
  /** Whether both blue and red orientations match the start position */
  matches: boolean;
  /** End orientation of blue prop after adding bridge letter */
  blueEndOri: string;
  /** End orientation of red prop after adding bridge letter */
  redEndOri: string;
  /** Start orientation of blue prop (from sequence start position) */
  blueStartOri: string;
  /** Start orientation of red prop (from sequence start position) */
  redStartOri: string;
  /**
   * How many times the sequence needs to repeat to return to original orientations.
   * 1 = orientations already match (true loop)
   * 2 = orientations flip once, need 2 repetitions
   * 4 = orientations quarter-cycle, need 4 repetitions
   */
  repetitionsNeeded: 1 | 2 | 4;
}

/**
 * Option for making a non-loopable sequence circular via bridge letter.
 * When a sequence ends at a different position group than it starts,
 * adding a bridge letter can bring it to a position where LOOPs work.
 */
export interface CircularizationOption {
  /** Bridge letters needed to reach a loopable position */
  bridgeLetters: Letter[];
  /** The position we'd end at after adding bridge letters */
  endPosition: string;
  /** Available LOOP types for this ending position */
  availableLOOPs: LOOPOption[];
  /** Description for UI display */
  description: string;
  /** Pictograph data for visual display of the bridge letter */
  pictographData?: PictographData;
  /** Rotation relationship to start position (affects sequence length multiplier) */
  rotationRelation?: RotationRelation;
  /** Orientation alignment info (only for exact position matches) */
  orientationAlignment?: OrientationAlignment;
  /** Current sequence length (number of steps before extension) */
  currentLength?: number;
  /** Resulting sequence length after applying LOOP with this bridge */
  resultingLength?: number;
}

/**
 * SequenceJsonExporter
 *
 * Exports sequences to minimal JSON format for debugging/admin use.
 * Strips placement data fluff, keeps only essential motion data.
 */
export interface MinimalMotion {
  type: string;
  dir: string;
  startLoc: string;
  endLoc: string;
  turns: number;
  startOri: string;
  endOri: string;
}

export interface MinimalStep {
  step: number;
  letter: string;
  startPos: string;
  endPos: string;
  blue: MinimalMotion | null;
  red: MinimalMotion | null;
}

export interface SequenceKey {
  startPos: string;
  endPos: string;
  startLoc: string;
  endLoc: string;
  startOri: string;
  endOri: string;
  type: string;
  dir: string;
  turns: string;
}

export interface MinimalSequence {
  key: SequenceKey;
  name: string;
  word: string;
  isCircular: boolean;
  gridMode: string;
  startPosition: MinimalStep | null;
  steps: (MinimalStep | null)[];
}

/**
 * SequenceTransferHandler
 *
 * Handles transferring sequences between Create module tabs.
 * Primary use case: Edit in Constructor from Generator/Assembler.
 */
export type TransferCheckResult =
  | { action: "transfer"; sequence: SequenceData }
  | { action: "already-loaded" }
  | { action: "confirm-needed"; pendingSequence: SequenceData };

/**
 * SubDrawerStatePersister
 *
 * Persists sub-drawer state to sessionStorage for HMR survival.
 * Clears on tab close (session end).
 */
export type SubDrawerType =
  | "help"
  | "turnPattern"
  | "rotationDirection"
  | "duration"
  | "extend"
  | null;

/**
 * Result of applying a turn pattern to a sequence
 */
export interface TurnPatternApplyResult {
  /** Whether the application was successful */
  readonly success: boolean;
  /** The modified sequence (if successful) */
  readonly sequence?: SequenceData;
  /** Error message if not successful */
  readonly error?: string;
  /** Number of steps that were modified */
  readonly modifiedSteps?: number;
  /** Warnings about edge cases encountered */
  readonly warnings?: readonly string[];
}

/**
 * Types of undoable operations in the Create module
 */
export enum UndoOperationType {
  // Sequence construction operations
  SELECT_START_POSITION = "SELECT_START_POSITION",
  ADD_BEAT = "ADD_BEAT",
  REMOVE_BEATS = "REMOVE_BEATS",
  CLEAR_SEQUENCE = "CLEAR_SEQUENCE",

  // Beat modification operations
  UPDATE_BEAT = "UPDATE_BEAT",
  INSERT_BEAT = "INSERT_BEAT",
  BATCH_EDIT = "BATCH_EDIT",

  // Transform operations
  MIRROR_SEQUENCE = "MIRROR_SEQUENCE",
  FLIP_SEQUENCE = "FLIP_SEQUENCE",
  ROTATE_SEQUENCE = "ROTATE_SEQUENCE",
  SWAP_COLORS = "SWAP_COLORS",
  INVERT_SEQUENCE = "INVERT_SEQUENCE",
  REWIND_SEQUENCE = "REWIND_SEQUENCE",
  SHIFT_START = "SHIFT_START",

  // Pattern operations
  APPLY_TURN_PATTERN = "APPLY_TURN_PATTERN",
  APPLY_ROTATION_PATTERN = "APPLY_ROTATION_PATTERN",
  APPLY_DURATION_PATTERN = "APPLY_DURATION_PATTERN",
  EXTEND_SEQUENCE = "EXTEND_SEQUENCE",

  // Edit operations
  MODIFY_BEAT_PROPERTIES = "MODIFY_BEAT_PROPERTIES",

  // Generate operations
  GENERATE_SEQUENCE = "GENERATE_SEQUENCE",

  // Spell module operations
  SPELL_GENERATE = "SPELL_GENERATE",
  SPELL_APPLY_LOOP = "SPELL_APPLY_LOOP",
}

/**
 * Metadata for undo history entries
 */
export interface UndoMetadata {
  stepIndex?: number;
  stepsRemoved?: number;
  description?: string;
  [key: string]: unknown; // Allow additional metadata
}

/**
 * Snapshot of Create Module State at a specific point in time
 */
export interface CreateModuleStateSnapshot {
  sequence: SequenceData | null;
  selectedStepNumber: number | null; // 0=start, 1=first beat, 2=second beat
  activeSection: ActiveCreateModule | null;
  shouldShowStartPositionPicker?: boolean;
  timestamp: number;
}

/**
 * A single undoable action in the history
 */
export interface UndoHistoryEntry {
  id: string; // Unique identifier for this action
  type: UndoOperationType;
  timestamp: number;
  beforeState: CreateModuleStateSnapshot;
  afterState?: CreateModuleStateSnapshot; // Optional: for redo optimization
  metadata?: UndoMetadata;
}

/**
 * Result of cyclic equivalence comparison
 */
export interface WordCyclicEquivalenceResult {
  /** Whether the words are cyclic rotations of each other */
  readonly isEquivalent: boolean;

  /** Number of positions the first word needs to rotate to match the second (null if not equivalent) */
  readonly rotationOffset: number | null;

  /** The canonical (normalized) form of the word */
  readonly canonicalForm: string;
}
