<!--
OptionPicker.svelte - Main option picker orchestrator

Single responsibility: Coordinate option loading, preparation, and selection.
Delegates all rendering to child components.
-->
<script lang="ts">
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";

  import { createFadeState } from "../state/fade-state.svelte";
  import { createOptionPickerState } from "../state/option-picker-state.svelte";
  import type { IOptionLoader } from "../services/contracts/IOptionLoader";
  import type { IOptionFilter } from "../services/contracts/IOptionFilter";
  import type { IOptionSorter } from "../services/contracts/IOptionSorter";
  import type { IOptionOrganizer } from "../services/contracts/IOptionOrganizer";
  import type { IOptionGridFitCalculator } from "../services/contracts/IGridFitCalculator";
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import type { IPictographPreparer } from "../services/PictographPreparer";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IDarkModeProvider } from "$lib/shared/animation-engine/services/contracts/IDarkModeProvider";
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
  }

  const {
    currentSequence,
    currentGridMode,
    onOptionSelected,
    isContinuousOnly = false,
    onToggleContinuous,
    isSideBySideLayout = () => false,
    isUndoingOption = false,
  }: Props = $props();

  // State
  const fadeState = createFadeState();
  let pickerState = $state<ReturnType<typeof createOptionPickerState> | null>(
    null
  );
  let preparedOptions = $state<PreparedPictographData[]>([]);
  let isReady = $state(false);

  // Internal continuous filter state - initialize with default
  let internalContinuousOnly = $state(false);

  // Sync from prop
  $effect(() => {
    internalContinuousOnly = isContinuousOnly;
  });

  // Services
  let preparer: IPictographPreparer | null = null;
  let hapticService = $state<IHapticFeedback | null>(null);
  let sizerService = $state<IOptionGridFitCalculator | null>(null);
  let organizerService = $state<IOptionOrganizer | null>(null);

  // Dark Mode tracking - needed to re-prepare props when theme changes
  let darkMode = $state(false);
  let darkModeProvider: IDarkModeProvider | null = null;

  // Track if we're waiting for new options after a selection
  let pendingFadeIn = $state(false);

  // Handle continuous toggle - updates internal state and notifies parent
  function handleToggleContinuous(value: boolean) {
    internalContinuousOnly = value;
    if (pickerState) {
      pickerState.setContinuousOnly(value);
    }
    onToggleContinuous?.(value);
  }

  // Load options when sequence changes (don't block on fade)
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
    const filtered = pickerState.filteredOptions;
    const currentState = pickerState.state;
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
      preparedOptions = [];
      return;
    }

    preparer.prepareBatch(filtered).then((prepared) => {
      preparedOptions = prepared;
      // Fade in after new options are ready
      if (pendingFadeIn) {
        pendingFadeIn = false;
        fadeState.fadeIn();
      }
    });
  });

  // Sync internal state when prop changes from parent
  $effect(() => {
    if (isContinuousOnly !== internalContinuousOnly) {
      internalContinuousOnly = isContinuousOnly;
      if (pickerState) {
        pickerState.setContinuousOnly(isContinuousOnly);
      }
    }
  });

  // Handle option selection with fade
  async function handleSelect(option: PreparedPictographData) {
    if (!pickerState || fadeState.isFading) return;

    hapticService?.trigger("selection");

    // Mark that we need to fade in after new options load
    pendingFadeIn = true;

    // Fade out, wait, then notify parent
    await fadeState.fadeOut();
    onOptionSelected(option);
    pickerState.selectOption(option);
  }

  // Initialize services
  onMount(() => {
    let darkModeUnsubscribe: (() => void) | null = null;

    try {
      const loader = container.items.optionLoader as IOptionLoader;
      const filter = container.items.optionFilter as IOptionFilter;
      const sorter = container.items.optionSorter as IOptionSorter;

      organizerService = container.items.optionOrganizer as IOptionOrganizer;
      sizerService = container.items.optionGridFitCalculator as IOptionGridFitCalculator;
      preparer = pictographPreparer as IPictographPreparer;
      hapticService = container.items.hapticFeedback as IHapticFeedback;

      // Subscribe to Dark Mode changes for prop color updates
      try {
        darkModeProvider = container.items.darkModeProvider as IDarkModeProvider;
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
    }

    return () => {
      if (darkModeUnsubscribe) {
        darkModeUnsubscribe();
      }
    };
  });
</script>

{#if !isReady}
  <div class="loading">Initializing...</div>
{:else if pickerState?.error}
  <div class="error">
    <p>Error: {pickerState.error}</p>
    <button onclick={() => pickerState?.clearError()}>Retry</button>
  </div>
{:else}
  <OptionPickerContent
    options={preparedOptions}
    {organizerService}
    {sizerService}
    isFading={fadeState.isFading}
    onSelect={handleSelect}
    isContinuousOnly={internalContinuousOnly}
    onToggleContinuous={handleToggleContinuous}
    {isSideBySideLayout}
    {currentSequence}
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
