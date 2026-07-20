<!--
OptionPicker.svelte - Main option picker orchestrator

Single responsibility: Coordinate option loading, preparation, and selection.
Delegates all rendering to child components.
-->
<script lang="ts">
  import { getOptionFilter } from "$lib/features/create/construct/option-picker/get-option-filter";
  import { getOptionLoader } from "$lib/features/create/construct/option-picker/get-option-loader";
  import { organizePictographs } from "$lib/features/create/construct/option-picker/services/option-organizer";
  import { getOptionSorter } from "$lib/features/create/construct/option-picker/get-option-sorter";
  import { getDarkModeProvider } from "$lib/shared/animation-engine/get-dark-mode-provider";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { onMount } from "svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import { applyPendingTurnsToOption } from "$lib/shared/create/services/apply-turns-to-motion";
  import {
    clampTurnToLevel,
    levelForTurns,
    type TurnLevel,
    type TurnValue,
  } from "$lib/shared/create/services/level-turn-values";
  import { countDirectionReversals } from "$lib/features/create/construct/option-picker/services/reversal-checker";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";
  import { calculateDeviceAwareSize } from "../services/option-grid-fit-calculator";

  import { createOptionPickerState } from "../state/option-picker-state.svelte";
  import { applyPoiLegalComposerFilter } from "$lib/features/levels/poi-lab/services/apply-poi-legal-filter";
  import type { OptionLoader } from "$lib/features/create/construct/option-picker/services/option-loader";
  import type { OptionSorter } from "$lib/features/create/construct/option-picker/services/option-sorter";
  import type {
    OrganizedSection,
    SortMethod,
  } from "$lib/features/create/construct/option-picker/domain/option-picker-types";
  import type {
    DeviceAwareSizingParams,
    DeviceAwareSizingResult,
  } from "../services/types";
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/prepared-pictograph-data";
  import type { PictographPreparer } from "../services/pictograph-preparer";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { DarkModeProvider } from "$lib/shared/animation-engine/services/dark-mode-provider";
  import OptionPickerContent from "./OptionPickerContent.svelte";

  // Props
  interface Props {
    currentSequence: PictographData[];
    currentGridMode: GridMode;
    onOptionSelected: (option: PictographData) => void | Promise<void>;
    isContinuousOnly?: boolean;
    onToggleContinuous?: (value: boolean) => void;
    isSideBySideLayout?: () => boolean;
    isUndoingOption?: boolean;
    /** Optional predicate to further filter options (e.g., loop-only for tutorials) */
    filterPredicate?: (option: PictographData) => boolean;
    /** Hide the All/Continuous filter UI (e.g. simplified tutorial grid) */
    hideFilters?: boolean;
    /** Explicit prop types for demo/preview rendering (bypasses global
     *  settings) — same convention as StepCell/PictographContainer. Also feeds
     *  the poi-legality gate, so a surface pinned to a non-poi prop is never
     *  emptied by a user's poi setting. */
    bluePropTypeOverride?: PropType;
    redPropTypeOverride?: PropType;
    /** Explicit pending turns (bypasses the sticky localStorage turns). Same
     *  bypass convention as the prop overrides: an embedded/demo surface pins
     *  its own turns so a user's sticky Create-tab turns never leak in. */
    blueTurnsOverride?: number | "fl";
    redTurnsOverride?: number | "fl";
  }

  const {
    currentSequence,
    currentGridMode,
    onOptionSelected,
    isContinuousOnly = false,
    onToggleContinuous,
    isSideBySideLayout = () => false,
    isUndoingOption = false,
    filterPredicate,
    hideFilters = false,
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
    blueTurnsOverride = undefined,
    redTurnsOverride = undefined,
  }: Props = $props();

  // State
  let pickerState = $state<ReturnType<typeof createOptionPickerState> | null>(
    null
  );
  let preparedOptions = $state<PreparedPictographData[]>([]);
  let isReady = $state(false);
  let isSelecting = $state(false);
  let initError = $state<string | null>(null);

  // Internal continuous filter state - initialize with default
  let internalContinuousOnly = $state(false);

  // Sticky pending turns applied to every option (persist across selections AND
  // across reloads — survives HMR / full refresh via localStorage).
  interface PendingTurnsState {
    blueTurns: TurnValue;
    redTurns: TurnValue;
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    /** Working level — decides which turn buttons the header offers. */
    level?: TurnLevel;
  }
  const pendingTurnsPersistence = createPersistenceHelper<PendingTurnsState>({
    key: "tka-option-picker-pending-turns",
    defaultValue: {
      blueTurns: 0,
      redTurns: 0,
      blueRotation: RotationDirection.CLOCKWISE,
      redRotation: RotationDirection.CLOCKWISE,
      level: 2,
    },
  });
  const loadedTurns = pendingTurnsPersistence.load();

  let blueTurns = $state<TurnValue>(loadedTurns.blueTurns);
  let redTurns = $state<TurnValue>(loadedTurns.redTurns);
  // Turns persisted before the level selector existed carry no level — infer the
  // lowest level that still permits them, so nobody's sticky turns get clamped
  // away on first load. Floor at 2 so the turn buttons are reachable by default.
  let level = $state<TurnLevel>(
    loadedTurns.level ??
      (Math.max(
        2,
        levelForTurns(loadedTurns.blueTurns, loadedTurns.redTurns)
      ) as TurnLevel)
  );
  // Chosen spin direction for dash/static hands with turns (one bit per hand,
  // set via the turns-bar toggle — no per-tile fan-out). Shifts ignore these.
  let blueRotation = $state<RotationDirection>(loadedTurns.blueRotation);
  let redRotation = $state<RotationDirection>(loadedTurns.redRotation);

  // An override pins the hand's turns; otherwise the sticky internal state runs.
  const effectiveBlueTurns = $derived(blueTurnsOverride ?? blueTurns);
  const effectiveRedTurns = $derived(redTurnsOverride ?? redTurns);

  // Persist every change so the picker reopens with the same sticky turns.
  // Overridden surfaces never write — their pinned turns aren't the user's.
  $effect(() => {
    if (blueTurnsOverride !== undefined || redTurnsOverride !== undefined)
      return;
    pendingTurnsPersistence.setupAutoSave({
      blueTurns,
      redTurns,
      blueRotation,
      redRotation,
      level,
    });
  });

  function handleBlueTurnsChange(value: TurnValue) {
    blueTurns = value;
  }
  function handleRedTurnsChange(value: TurnValue) {
    redTurns = value;
  }
  // Dropping a level snaps both hands into that level's palette (a float or a
  // half turn can't survive a move to Level 2) — the same clamp the Generate
  // panel applies when a level change invalidates the current value.
  function handleLevelChange(next: TurnLevel) {
    level = next;
    blueTurns = clampTurnToLevel(blueTurns, next);
    redTurns = clampTurnToLevel(redTurns, next);
  }
  function handleBlueRotationChange(dir: RotationDirection) {
    blueRotation = dir;
  }
  function handleRedRotationChange(dir: RotationDirection) {
    redRotation = dir;
  }

  // Apply sticky turns to each option, then prepare for rendering.
  function prepareWithTurns(
    filtered: PictographData[]
  ): Promise<PreparedPictographData[]> {
    // One tile per option: apply the chosen per-hand spin direction to dash/static
    // hands rather than fanning out CW/CCW tiles (keeps the grid scannable).
    const noTurns = effectiveBlueTurns === 0 && effectiveRedTurns === 0;
    let turned = noTurns
      ? filtered
      : filtered.map((o) =>
          applyPendingTurnsToOption(
            o,
            effectiveBlueTurns,
            effectiveRedTurns,
            blueRotation,
            redRotation
          )
        );

    // When Continuous is on, drop any dash/static option whose chosen spin
    // direction reverses against the established direction. Direction-only (not
    // full getReversalCount) so the turns>1 magnitude heuristic doesn't nuke
    // every option at 2+ turns.
    if (!noTurns && internalContinuousOnly && currentSequence.length >= 2) {
      turned = turned.filter(
        (o) => countDirectionReversals(o, currentSequence) === 0
      );
    }

    const s = getSettings();
    return preparer!.prepareBatch(turned, {
      bluePropType: bluePropTypeOverride ?? s.bluePropType,
      redPropType: redPropTypeOverride ?? s.redPropType,
    });
  }

  // Single effect: always push the prop value to both internal state and pickerState
  $effect(() => {
    internalContinuousOnly = isContinuousOnly;
    if (pickerState) {
      pickerState.setContinuousOnly(isContinuousOnly);
    }
  });

  // Services
  let preparer: PictographPreparer | null = null;
  let hapticService = $state<HapticFeedback | null>(null);
  let sizerService = $state<
    ((params: DeviceAwareSizingParams) => DeviceAwareSizingResult) | null
  >(null);
  let organizerService = $state<
    | ((
        pictographs: PictographData[],
        sortMethod: SortMethod
      ) => OrganizedSection[])
    | null
  >(null);

  // Dark Mode tracking - needed to re-prepare props when theme changes
  let darkMode = $state(false);
  let darkModeProvider: DarkModeProvider | null = null;

  // Brief debounce to prevent double-tap during option loading
  const SELECTION_DEBOUNCE_MS = 300;

  // Handle continuous toggle - updates internal state and notifies parent
  function handleToggleContinuous(value: boolean) {
    internalContinuousOnly = value;
    if (pickerState) {
      pickerState.setContinuousOnly(value);
    }
    onToggleContinuous?.(value);
  }

  function handleSlotClicked(typeSection: string, slotIndex: number) {
    pickerState?.recordClickSlot(typeSection, slotIndex);
  }

  // Load options when sequence changes
  $effect(() => {
    if (!pickerState || !isReady) return;

    if (currentSequence.length > 0) {
      pickerState.loadOptions(currentSequence, currentGridMode);
    } else {
      pickerState.reset();
    }
  });

  // Prepare options when filtered options change, Dark Mode changes, or prop type changes
  // Dark Mode affects prop colors which are baked in during preparation
  // Prop type settings determine which prop SVGs to render
  $effect(() => {
    if (!pickerState || !preparer) {
      preparedOptions = [];
      return;
    }

    // Access filteredOptions and state (reactive) - tracks when options or filters change
    let filtered = pickerState.filteredOptions;
    const currentState = pickerState.state;
    // Apply external filter predicate if provided (e.g., loop-only for tutorials)
    const _filterPredicate = filterPredicate;
    if (_filterPredicate) {
      filtered = filtered.filter(_filterPredicate);
    }
    // Include darkMode as dependency - prop colors need re-preparation when theme changes
    const _darkMode = darkMode;
    // Include prop type settings as dependencies - re-prepare when prop type changes (P button)
    const settings = getSettings();
    const _bluePropType = settings.bluePropType;
    const _redPropType = settings.redPropType;

    // Skip while loading - prevents preparing intermediate states when
    // currentSequence updates before options finish loading
    if (currentState === "loading") {
      return;
    }

    if (filtered.length === 0) {
      // Don't clear preparedOptions - keep old ones visible so grid
      // slots stay mounted and can transition when new data arrives
      return;
    }

    // Track effective turns + spin directions so a change re-renders the options
    const _blueTurns = effectiveBlueTurns;
    const _redTurns = effectiveRedTurns;
    const _blueRotation = blueRotation;
    const _redRotation = redRotation;
    void _blueTurns;
    void _redTurns;
    void _blueRotation;
    void _redRotation;

    prepareWithTurns(filtered).then((prepared) => {
      preparedOptions = prepared;
      isSelecting = false;
    });
  });

  // (Continuous sync handled by single effect above)

  // Handle option selection - run load+prepare as a direct async pipeline
  // in parallel with the step grid animation. Bypasses the reactive hops
  // (parent updates sequence → prop flows back → load effect → prepare effect)
  // which would serialize the two animations.
  function handleSelect(option: PreparedPictographData) {
    if (!pickerState || isSelecting) return;

    hapticService?.trigger("selection");
    isSelecting = true;

    // Notify parent first (triggers step grid animation synchronously)
    onOptionSelected(option);

    // When a filterPredicate is provided (e.g., tutorial loop filter), skip the fast
    // path and let the reactive $effect handle reloading. The predicate may change
    // based on the parent's state update from onOptionSelected, and the fast path
    // would capture the stale predicate value.
    if (filterPredicate) {
      isSelecting = false;
      return;
    }

    // Run load → prepare as one async pipeline, concurrent with step grid animation
    const nextSequence = [...currentSequence, option as PictographData];
    (async () => {
      try {
        await pickerState!.loadOptions(nextSequence, currentGridMode);
        // Immediately prepare - don't wait for reactive effect scheduling
        let filtered = pickerState!.filteredOptions;
        // Apply external filter predicate if provided (e.g., loop-only for tutorials)
        if (filterPredicate) {
          filtered = filtered.filter(filterPredicate);
        }
        if (preparer && filtered.length > 0) {
          const prepared = await prepareWithTurns(filtered);
          preparedOptions = prepared;
        }
      } finally {
        isSelecting = false;
      }
    })();
  }

  // Initialize services - extracted so the error UI can retry
  let darkModeUnsubscribe: (() => void) | null = null;

  function initialize() {
    initError = null;

    // Drop any subscription from a previous attempt before re-subscribing
    darkModeUnsubscribe?.();
    darkModeUnsubscribe = null;

    try {
      const loader = getOptionLoader();
      const filter = getOptionFilter();
      const sorter = getOptionSorter();

      organizerService = organizePictographs;
      sizerService = calculateDeviceAwareSize;
      preparer = pictographPreparer as PictographPreparer;
      hapticService = getHapticFeedback();

      // Subscribe to Dark Mode changes for prop color updates
      try {
        darkModeProvider = getDarkModeProvider();
        darkModeUnsubscribe = darkModeProvider.subscribe((value) => {
          darkMode = value;
        });
      } catch {
        // Provider not available yet, will default to false
      }

      pickerState = createOptionPickerState({
        optionLoader: loader,
        filterService: filter,
        optionSorter: sorter,
        poiFilter: (opts, previous) =>
          applyPoiLegalComposerFilter(opts, previous, {
            bluePropType: bluePropTypeOverride,
            redPropType: redPropTypeOverride,
          }),
      });

      // Initialize with the prop value BEFORE marking ready
      // This ensures filtering is applied when options first load
      if (isContinuousOnly) {
        pickerState.setContinuousOnly(isContinuousOnly);
        internalContinuousOnly = isContinuousOnly;
      }

      isReady = true;
    } catch (error) {
      console.error("Failed to initialize option picker:", error);
      initError =
        error instanceof Error
          ? error.message
          : "Failed to initialize option picker";
    }
  }

  // Retry a failed option load - clears the error and reloads the current sequence
  function retryLoadOptions() {
    pickerState?.clearError();
    if (currentSequence.length > 0) {
      pickerState?.loadOptions(currentSequence, currentGridMode);
    }
  }

  onMount(() => {
    initialize();

    return () => {
      if (darkModeUnsubscribe) {
        darkModeUnsubscribe();
      }
    };
  });
</script>

{#if initError}
  <div class="error" role="alert">
    <p>Couldn't start the option picker: {initError}</p>
    <button onclick={initialize}>Retry</button>
  </div>
{:else if !isReady}
  <div class="loading">Initializing...</div>
{:else if pickerState?.error}
  <div class="error" role="alert">
    <p>Error: {pickerState.error}</p>
    <button onclick={retryLoadOptions}>Retry</button>
  </div>
{:else}
  <OptionPickerContent
    options={preparedOptions}
    {organizerService}
    {sizerService}
    onSelect={handleSelect}
    isContinuousOnly={internalContinuousOnly}
    onToggleContinuous={handleToggleContinuous}
    {isSideBySideLayout}
    {hideFilters}
    {currentSequence}
    onSlotClicked={handleSlotClicked}
    lastClickedSlot={pickerState?.lastClickedSlot ?? null}
    blueTurns={effectiveBlueTurns}
    redTurns={effectiveRedTurns}
    {level}
    onLevelChange={handleLevelChange}
    {blueRotation}
    {redRotation}
    onBlueTurnsChange={handleBlueTurnsChange}
    onRedTurnsChange={handleRedTurnsChange}
    onBlueRotationChange={handleBlueRotationChange}
    onRedRotationChange={handleRedRotationChange}
  />
{/if}

<style>
  .loading,
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1rem;
    text-align: center;
    color: var(--text-muted);
  }

  .error button {
    margin-top: 0.5rem;
    min-height: var(--min-touch-target, 48px); /* WCAG AAA touch target */
    padding: 0.5rem 1.5rem;
    background: var(--theme-accent, var(--primary-color));
    color: white;
    border: none;
    border-radius: var(--border-radius, 8px);
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    transition: all var(--duration-normal) ease;
  }

  .error button:hover {
    opacity: 0.9;
  }

  .error button:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .error button {
      transition: none;
    }
  }
</style>
