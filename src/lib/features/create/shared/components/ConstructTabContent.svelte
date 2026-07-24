<!--
  ConstructTabContent.svelte

  Pure UI component that displays StartPositionPicker or OptionPicker
  based on the current sequence state. Receives all state and handlers as props.

  Flow: Start Position Picker → Option Viewer

  Uses instant content swap - the workspace expansion is the "hero" animation.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import OptionPicker from "$lib/features/create/construct/option-picker/components/OptionPicker.svelte";
  import StartPositionPicker from "$lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte";
  import type { SimplifiedStartPositionState } from "$lib/shared/create/state/start-position-state.svelte";
  import ConstructTutorialGuide from "../../construct/tutorial/components/ConstructTutorialGuide.svelte";
  import type { StartPosePath } from "../../construct/services/construct-analytics";
  // Props
  let {
    shouldShowStartPositionPicker,
    startPositionState,
    onOptionSelected,
    currentSequence = [],
    currentGridMode = GridMode.DIAMOND,
    initialStartPosition = null,
    lockStartGridMode = false,
    startPositionValidationMessage = null,
    isUndoingOption = false,
    onStartPositionNavigateToAdvanced,
    onStartPositionNavigateToDefault,
    isSideBySideLayout = () => false,
    onOpenFilters = () => {},
    onCloseFilters = () => {},
    isContinuousOnly = false,
    isFilterPanelOpen = false,
    onToggleContinuous = () => {},
    onStartPositionSubmitted = () => {},
  } = $props<{
    shouldShowStartPositionPicker: boolean;
    startPositionState?: SimplifiedStartPositionState | null;
    onOptionSelected: (option: PictographData) => Promise<void>;
    currentSequence?: PictographData[];
    currentGridMode?: GridMode;
    initialStartPosition?: PictographData | null;
    lockStartGridMode?: boolean;
    startPositionValidationMessage?: string | null;
    isUndoingOption?: boolean;
    onStartPositionNavigateToAdvanced?: () => void;
    onStartPositionNavigateToDefault?: () => void;
    isSideBySideLayout?: () => boolean;
    onOpenFilters?: () => void;
    onCloseFilters?: () => void;
    isContinuousOnly?: boolean;
    isFilterPanelOpen?: boolean;
    onToggleContinuous?: (value: boolean) => void;
    onStartPositionSubmitted?: (
      position: PictographData,
      path: StartPosePath
    ) => void;
  }>();
</script>

<div
  class="construct-tab-content"
  data-testid="construct-tab-content"
  data-picker-mode={shouldShowStartPositionPicker
    ? "start-position"
    : "options"}
>
  <ConstructTutorialGuide />
  <div class="content-container">
    <div class="construct-scroll-area transparent-scroll">
      <!-- Instant swap - workspace expansion is the visual transition -->
      <div class="picker-wrapper">
        {#if shouldShowStartPositionPicker}
          <StartPositionPicker
            {startPositionState}
            {initialStartPosition}
            lockedGridMode={lockStartGridMode ? currentGridMode : undefined}
            validationMessage={startPositionValidationMessage}
            onNavigateToAdvanced={onStartPositionNavigateToAdvanced}
            onNavigateToDefault={onStartPositionNavigateToDefault}
            {isSideBySideLayout}
            onPositionSubmitted={onStartPositionSubmitted}
          />
        {:else}
          <OptionPicker
            {onOptionSelected}
            {currentSequence}
            {currentGridMode}
            {isSideBySideLayout}
            {isUndoingOption}
            {isContinuousOnly}
            {onToggleContinuous}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .construct-tab-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    width: 100%;
    container-type: inline-size;
  }

  .content-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .construct-scroll-area {
    flex: 1;
    overflow: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .construct-scroll-area.transparent-scroll {
    background: transparent;
  }

  .picker-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }
</style>
