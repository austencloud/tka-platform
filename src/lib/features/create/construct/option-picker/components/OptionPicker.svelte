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
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { onMount } from "svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import { applyTurnsToOptionVariants } from "$lib/shared/create/services/apply-turns-to-motion";
  import { countDirectionReversals } from "$lib/features/create/construct/option-picker/services/reversal-checker";
  import { calculateDeviceAwareSize } from "../services/option-grid-fit-calculator";

  import { createOptionPickerState } from "../state/option-picker-state.svelte";
  import type { OptionLoader } from "$lib/features/create/construct/option-picker/services/option-loader";
  import type { OptionSorter } from "$lib/features/create/construct/option-picker/services/option-sorter";
  import type { OrganizedSection, SortMethod } from "$lib/features/create/construct/option-picker/domain/option-picker-types";
  import type { DeviceAwareSizingParams, DeviceAwareSizingResult } from "../services/types";
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

  // Sticky pending turns applied to every option (persist across selections)
  let blueTurns = $state<number | "fl">(0);
  let redTurns = $state<number | "fl">(0);

  function handleBlueTurnsChange(delta: number) {
    if (blueTurns === "fl") return;
    blueTurns = Math.max(0, blueTurns + delta);
  }
  function handleRedTurnsChange(delta: number) {
    if (redTurns === "fl") return;
    redTurns = Math.max(0, redTurns + delta);
  }
  function handleResetTurns() {
    blueTurns = 0;
    redTurns = 0;
  }

  // Apply sticky turns to each option, then prepare for rendering.
  function prepareWithTurns(
    filtered: PictographData[]
  ): Promise<PreparedPictographData[]> {
    // Fan out ambiguous rotation directions: dash/static hands with turns ≥ 1
    // become CW + CCW tiles (different end orientations, both valid next steps).
    const noTurns = blueTurns === 0 && redTurns === 0;
    let turned = noTurns
      ? filtered
      : filtered.flatMap((o) => applyTurnsToOptionVariants(o, blueTurns, redTurns));

    // pickerState applied the continuous filter to the 0-turn base options, but
    // the fanned CW/CCW variants carry new rotation directions that pickerState
    // never saw. When Continuous is on, drop any variant whose spin direction
    // reverses against the established direction. Direction-only (not full
    // getReversalCount) so the turns>1 magnitude heuristic doesn't nuke every
    // option at 2+ turns.
    if (!noTurns && internalContinuousOnly && currentSequence.length >= 2) {
      turned = turned.filter(
        (o) => countDirectionReversals(o, currentSequence) === 0
      );
    }

    const s = getSettings();
    return preparer!.prepareBatch(turned, {
      bluePropType: s.bluePropType,
      redPropType: s.redPropType,
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
  let sizerService = $state<((params: DeviceAwareSizingParams) => DeviceAwareSizingResult) | null>(null);
  let organizerService = $state<((pictographs: PictographData[], sortMethod: SortMethod) => OrganizedSection[]) | null>(null);

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

    // Track sticky turns so a turn change re-renders the options
    const _blueTurns = blueTurns;
    const _redTurns = redTurns;
    void _blueTurns;
    void _redTurns;

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
        error instanceof Error ? error.message : "Failed to initialize option picker";
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
    {currentSequence}
    onSlotClicked={handleSlotClicked}
    lastClickedSlot={pickerState?.lastClickedSlot ?? null}
    {blueTurns}
    {redTurns}
    onBlueTurnsChange={handleBlueTurnsChange}
    onRedTurnsChange={handleRedTurnsChange}
    onResetTurns={handleResetTurns}
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
