<!--
  CardGridLayout.svelte

  Renders the ChoreoCard grid section: uniform grid and duration-aware
  layout with start position, step cells, QR code, and mandala fill cells.
  Handles both standard and scroll modes. Extracted from ChoreoCard.svelte.
-->
<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import type { AnimationConfig } from "svelte/animate";

  function safeFlip(
    node: Element,
    animation: { from: DOMRect; to: DOMRect },
    params: Parameters<typeof flip>[2]
  ): AnimationConfig {
    if (!animation.from.width || !animation.from.height ||
        !animation.to.width || !animation.to.height) {
      return { duration: 0 };
    }
    return flip(node, animation, params);
  }
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { TimelineRow } from "$lib/shared/create/utils/grid-calculations";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import CellRenderer from "./CellRenderer.svelte";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

  interface CellData {
    index: number;
    label: string;
    imageUrl: string;
    isLoaded: boolean;
    gridColumn: number;
    gridRow: number;
    duration: number;
    fadeOutUrl?: string;
  }

  interface MandalaPlacement {
    row: number;
    col: number;
    variant: "blue" | "red" | "full";
  }

  interface Props {
    sequence: SequenceData;
    cells: CellData[];
    visibleCells: CellData[];
    effectiveColumns: number;
    effectiveRows: number;
    hasMixedDurations: boolean;
    durationRows: TimelineRow[];
    durationColCount: number;
    includeStartPosition: boolean;
    needsScroll: boolean;
    showHighlight: boolean;
    highlightedStepIndex: number | null;
    showQRCode: boolean;
    qrDataUrl: string | null;
    qrGridPosition: { gridColumn: number; gridRow: number } | null;
    showMandala: boolean;
    mandalaPlacements: MandalaPlacement[];
    flipDuration: number;
    cellWidth: number;
    activeDarkMode: boolean;
    bluePropType: PropType | undefined;
    redPropType: PropType | undefined;
    onStepClick: ((stepIndex: number) => void) | undefined;
    onGridScrollRefChange: (el: HTMLDivElement | undefined) => void;
    // CellRenderer pass-through props
    showStepNumbers: boolean;
    crossfadeActive: boolean;
    isBrowseSoloMode: boolean;
    isMotionSoloMode: boolean;
    soloColor: "blue" | "red" | undefined;
    stepNumFontSize: number;
    formatDuration: (d: number) => string;
    getMotionSoloMotion: (cellIndex: number) => MotionData | undefined;
    formatSoloTurns: (turns: number | "fl" | undefined | null) => string;
    shortOrientation: (ori: string | undefined | null) => string | null;
  }

  /** Fraction of the cell width the mandala occupies. Tweak for breathing room. */
  const MANDALA_CELL_SCALE = 0.78;

  const {
    sequence,
    cells,
    visibleCells,
    effectiveColumns,
    effectiveRows,
    hasMixedDurations,
    durationRows,
    durationColCount,
    includeStartPosition,
    needsScroll,
    showHighlight,
    highlightedStepIndex,
    showQRCode,
    qrDataUrl,
    qrGridPosition,
    showMandala,
    mandalaPlacements,
    flipDuration,
    cellWidth,
    activeDarkMode,
    bluePropType,
    redPropType,
    onStepClick,
    onGridScrollRefChange,
    showStepNumbers,
    crossfadeActive,
    isBrowseSoloMode,
    isMotionSoloMode,
    soloColor,
    stepNumFontSize,
    formatDuration,
    getMotionSoloMotion,
    formatSoloTurns,
    shortOrientation,
  }: Props = $props();

  const scaleDuration = $derived(flipDuration > 0 ? 200 : 0);
  const isLightBackground = $derived(settingsService.settings.backgroundType === BackgroundType.CELESTIAL);

  // Bind helper: forward the scroll ref to the parent
  function bindGridScrollRef(node: HTMLDivElement) {
    onGridScrollRefChange(node);
    return {
      destroy() {
        onGridScrollRefChange(undefined);
      }
    };
  }
</script>

{#if hasMixedDurations && durationRows.length > 0}
  <!-- Duration-aware layout: start position as fixed column barrier, step rows to the right -->
  {@const startCell = cells.find(c => c.index === -1)}
  {@const stepMaxUnits = durationColCount - (includeStartPosition ? 1 : 0)}
  {#if needsScroll}
    <div class="grid-scroll-container themed-scrollbar" use:bindGridScrollRef>
      <div class="duration-layout" class:dark-mode={activeDarkMode} style="--max-units: {durationColCount}; --step-max: {stepMaxUnits};">
        {#if includeStartPosition && startCell}
          <div class="duration-start-col" class:dark-mode={activeDarkMode} transition:fade|local={{ duration: scaleDuration }}>
            <div
              class="pictograph-cell"
              class:dark-mode={activeDarkMode}
              class:current={showHighlight && highlightedStepIndex === -1}
            >
              <CellRenderer
                cell={startCell}
                showDurBadge={false}
                {showStepNumbers}
                {activeDarkMode}
                {crossfadeActive}
                {isBrowseSoloMode}
                {isMotionSoloMode}
                {soloColor}
                {stepNumFontSize}
                {hasMixedDurations}
                {formatDuration}
                {getMotionSoloMotion}
                {formatSoloTurns}
                {shortOrientation}
              />
            </div>
            {#if showQRCode}
              <div class="pictograph-cell qr-cell" class:dark-mode={activeDarkMode} transition:fade|local={{ duration: scaleDuration }}>
                {#if qrDataUrl}
                  <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
                {/if}
              </div>
            {/if}
          </div>
        {/if}
        <div class="duration-steps-area">
          {#each durationRows as row, rowIdx (rowIdx)}
            <div class="duration-row">
              {#each row.steps as { stepIndex, duration } (stepIndex)}
                {@const cell = cells.find(c => c.index === stepIndex)}
                {#if cell}
                  <div class="duration-cell" class:dark-mode={activeDarkMode} style="--dur: {duration}; flex: {duration};">
                    {#if onStepClick}
                      <button
                        class="pictograph-cell clickable"
                        class:dark-mode={activeDarkMode}
                        class:current={showHighlight && highlightedStepIndex === cell.index}
                        class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                        onclick={() => onStepClick(cell.index)}
                        type="button"
                        aria-label="Go to step {cell.label}"
                      >
                        <CellRenderer
                          {cell}
                          showDurBadge={true}
                          {showStepNumbers}
                          {activeDarkMode}
                          {crossfadeActive}
                          {isBrowseSoloMode}
                          {isMotionSoloMode}
                          {soloColor}
                          {stepNumFontSize}
                          {hasMixedDurations}
                          {formatDuration}
                          {getMotionSoloMotion}
                          {formatSoloTurns}
                          {shortOrientation}
                        />
                      </button>
                    {:else}
                      <div
                        class="pictograph-cell"
                        class:dark-mode={activeDarkMode}
                        class:current={showHighlight && highlightedStepIndex === cell.index}
                        class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                      >
                        <CellRenderer
                          {cell}
                          showDurBadge={true}
                          {showStepNumbers}
                          {activeDarkMode}
                          {crossfadeActive}
                          {isBrowseSoloMode}
                          {isMotionSoloMode}
                          {soloColor}
                          {stepNumFontSize}
                          {hasMixedDurations}
                          {formatDuration}
                          {getMotionSoloMotion}
                          {formatSoloTurns}
                          {shortOrientation}
                        />
                      </div>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="duration-layout" class:dark-mode={activeDarkMode} style="--max-units: {durationColCount}; --step-max: {stepMaxUnits};">
      {#if includeStartPosition && startCell}
        <div class="duration-start-col" class:dark-mode={activeDarkMode}>
          <div
            class="pictograph-cell"
            class:dark-mode={activeDarkMode}
            class:current={showHighlight && highlightedStepIndex === -1}
          >
            <CellRenderer
              cell={startCell}
              showDurBadge={false}
              {showStepNumbers}
              {activeDarkMode}
              {crossfadeActive}
              {isBrowseSoloMode}
              {isMotionSoloMode}
              {soloColor}
              {stepNumFontSize}
              {hasMixedDurations}
              {formatDuration}
              {getMotionSoloMotion}
              {formatSoloTurns}
              {shortOrientation}
            />
          </div>
          {#if showQRCode && qrDataUrl}
            <div class="pictograph-cell qr-cell" class:dark-mode={activeDarkMode} transition:fade|local={{ duration: scaleDuration }}>
              <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
            </div>
          {/if}
        </div>
      {/if}
      <div class="duration-steps-area">
        {#each durationRows as row, rowIdx (rowIdx)}
          <div class="duration-row">
            {#each row.steps as { stepIndex, duration } (stepIndex)}
              {@const cell = cells.find(c => c.index === stepIndex)}
              {#if cell}
                <div class="duration-cell" class:dark-mode={activeDarkMode} style="--dur: {duration}; flex: {duration};">
                  {#if onStepClick}
                    <button
                      class="pictograph-cell clickable"
                      class:dark-mode={activeDarkMode}
                      class:current={showHighlight && highlightedStepIndex === cell.index}
                      class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                      onclick={() => onStepClick(cell.index)}
                      type="button"
                      aria-label="Go to step {cell.label}"
                    >
                      <CellRenderer
                        {cell}
                        showDurBadge={true}
                        {showStepNumbers}
                        {activeDarkMode}
                        {crossfadeActive}
                        {isBrowseSoloMode}
                        {isMotionSoloMode}
                        {soloColor}
                        {stepNumFontSize}
                        {hasMixedDurations}
                        {formatDuration}
                        {getMotionSoloMotion}
                        {formatSoloTurns}
                        {shortOrientation}
                      />
                    </button>
                  {:else}
                    <div
                      class="pictograph-cell"
                      class:dark-mode={activeDarkMode}
                      class:current={showHighlight && highlightedStepIndex === cell.index}
                      class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                    >
                      <CellRenderer
                        {cell}
                        showDurBadge={true}
                        {showStepNumbers}
                        {activeDarkMode}
                        {crossfadeActive}
                        {isBrowseSoloMode}
                        {isMotionSoloMode}
                        {soloColor}
                        {stepNumFontSize}
                        {hasMixedDurations}
                        {formatDuration}
                        {getMotionSoloMotion}
                        {formatSoloTurns}
                        {shortOrientation}
                      />
                    </div>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {/if}
{:else if needsScroll}
  <!-- Uniform grid: scroll mode -->
  {@const startCellScroll = cells.find(c => c.index === -1)}
  <div class="grid-scroll-container themed-scrollbar" use:bindGridScrollRef>
    <div
      class="grid-section"
      class:dark-mode={activeDarkMode}
      style="grid-template-columns: repeat({effectiveColumns}, 1fr);"
    >
      {#if startCellScroll && includeStartPosition}
        <div
          class="cell-flip-wrapper"
          style="grid-column: 1; grid-row: 1;"
          transition:scale|local={{ duration: scaleDuration, easing: cubicOut }}
        >
          <div class="pictograph-cell" class:dark-mode={activeDarkMode}>
            <CellRenderer
              cell={startCellScroll}
              showDurBadge={false}
              {showStepNumbers}
              {activeDarkMode}
              {crossfadeActive}
              {isBrowseSoloMode}
              {isMotionSoloMode}
              {soloColor}
              {stepNumFontSize}
              {hasMixedDurations}
              {formatDuration}
              {getMotionSoloMotion}
              {formatSoloTurns}
              {shortOrientation}
            />
          </div>
        </div>
      {/if}
      {#each visibleCells as cell (cell.index)}
        <div
          class="cell-flip-wrapper"
          style="grid-column: {cell.gridColumn}; grid-row: {cell.gridRow};"
          animate:safeFlip={{ duration: flipDuration, easing: cubicOut }}
        >
        {#if onStepClick && cell.index >= 0}
          <button
            class="pictograph-cell clickable"
            class:dark-mode={activeDarkMode}
            class:current={showHighlight && highlightedStepIndex === cell.index}
            class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
            onclick={() => onStepClick(cell.index)}
            type="button"
            aria-label="Go to step {cell.label}"
          >
            <CellRenderer
              {cell}
              showDurBadge={true}
              {showStepNumbers}
              {activeDarkMode}
              {crossfadeActive}
              {isBrowseSoloMode}
              {isMotionSoloMode}
              {soloColor}
              {stepNumFontSize}
              {hasMixedDurations}
              {formatDuration}
              {getMotionSoloMotion}
              {formatSoloTurns}
              {shortOrientation}
            />
          </button>
        {:else}
          <div
            class="pictograph-cell"
            class:dark-mode={activeDarkMode}
            class:current={showHighlight && highlightedStepIndex === cell.index}
            class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
          >
            <CellRenderer
              {cell}
              showDurBadge={true}
              {showStepNumbers}
              {activeDarkMode}
              {crossfadeActive}
              {isBrowseSoloMode}
              {isMotionSoloMode}
              {soloColor}
              {stepNumFontSize}
              {hasMixedDurations}
              {formatDuration}
              {getMotionSoloMotion}
              {formatSoloTurns}
              {shortOrientation}
            />
          </div>
        {/if}
        </div>
      {/each}
      {#if qrGridPosition && qrDataUrl}
        <div
          class="cell-flip-wrapper qr-cell-wrapper"
          style="grid-column: {qrGridPosition.gridColumn}; grid-row: {qrGridPosition.gridRow};"
          transition:scale|local={{ duration: scaleDuration, easing: cubicOut }}
        >
          <div class="pictograph-cell qr-cell" class:dark-mode={activeDarkMode}>
            <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
          </div>
        </div>
      {/if}
      {#each mandalaPlacements as placement (placement.row + "-" + placement.col + "-" + placement.variant)}
        <div
          class="cell-flip-wrapper mandala-cell-wrapper"
          style="grid-column: {placement.col}; grid-row: {placement.row};"
          transition:fade|local={{ duration: scaleDuration }}
        >
          <div class="pictograph-cell mandala-cell" class:light-bg={isLightBackground}>
            <SequenceMandala
              {sequence}
              mode="card-back"
              style="stroke"
              show={placement.variant === "full" ? "both" : placement.variant}
              size={Math.round((cellWidth || 120) * MANDALA_CELL_SCALE)}
              darkMode={activeDarkMode}
              {bluePropType}
              {redPropType}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <!-- Uniform grid: standard mode -->
  {@const startCell = cells.find(c => c.index === -1)}
  <div
    class="grid-section"
    class:dark-mode={activeDarkMode}
    style="grid-template-columns: repeat({effectiveColumns}, 1fr);"
  >
    {#if startCell && includeStartPosition}
      <div
        class="cell-flip-wrapper"
        style="grid-column: 1; grid-row: 1;"
        transition:scale|local={{ duration: scaleDuration, easing: cubicOut }}
      >
        <div class="pictograph-cell" class:dark-mode={activeDarkMode}>
          <CellRenderer
            cell={startCell}
            showDurBadge={false}
            {showStepNumbers}
            {activeDarkMode}
            {crossfadeActive}
            {isBrowseSoloMode}
            {isMotionSoloMode}
            {soloColor}
            {stepNumFontSize}
            {hasMixedDurations}
            {formatDuration}
            {getMotionSoloMotion}
            {formatSoloTurns}
            {shortOrientation}
          />
        </div>
      </div>
    {/if}
    {#each visibleCells as cell (cell.index)}
      <div
        class="cell-flip-wrapper"
        style="grid-column: {cell.gridColumn}; grid-row: {cell.gridRow};"
        animate:safeFlip={{ duration: flipDuration, easing: cubicOut }}
      >
      {#if onStepClick && cell.index >= 0}
        <button
          class="pictograph-cell clickable"
          class:dark-mode={activeDarkMode}
          class:current={showHighlight && highlightedStepIndex === cell.index}
          class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
          onclick={() => onStepClick(cell.index)}
          type="button"
          aria-label="Go to step {cell.label}"
        >
          <CellRenderer
            {cell}
            showDurBadge={true}
            {showStepNumbers}
            {activeDarkMode}
            {crossfadeActive}
            {isBrowseSoloMode}
            {isMotionSoloMode}
            {soloColor}
            {stepNumFontSize}
            {hasMixedDurations}
            {formatDuration}
            {getMotionSoloMotion}
            {formatSoloTurns}
            {shortOrientation}
          />
        </button>
      {:else}
        <div
          class="pictograph-cell"
          class:dark-mode={activeDarkMode}
          class:current={showHighlight && highlightedStepIndex === cell.index}
          class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
        >
          <CellRenderer
            {cell}
            showDurBadge={true}
            {showStepNumbers}
            {activeDarkMode}
            {crossfadeActive}
            {isBrowseSoloMode}
            {isMotionSoloMode}
            {soloColor}
            {stepNumFontSize}
            {hasMixedDurations}
            {formatDuration}
            {getMotionSoloMotion}
            {formatSoloTurns}
            {shortOrientation}
          />
        </div>
      {/if}
      </div>
    {/each}
    {#if qrGridPosition && qrDataUrl}
      <div
        class="cell-flip-wrapper qr-cell-wrapper"
        style="grid-column: {qrGridPosition.gridColumn}; grid-row: {qrGridPosition.gridRow};"
        transition:scale|local={{ duration: scaleDuration, easing: cubicOut }}
      >
        <div class="pictograph-cell qr-cell" class:dark-mode={activeDarkMode}>
          <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
        </div>
      </div>
    {/if}
    {#each mandalaPlacements as placement (placement.row + "-" + placement.col + "-" + placement.variant)}
      <div
        class="cell-flip-wrapper mandala-cell-wrapper"
        style="grid-column: {placement.col}; grid-row: {placement.row};"
        transition:fade|local={{ duration: scaleDuration }}
      >
        <div class="pictograph-cell mandala-cell" class:light-bg={isLightBackground}>
          <SequenceMandala
            {sequence}
            mode="card-back"
            style="stroke"
            show={placement.variant === "full" ? "both" : placement.variant}
            size={Math.round((cellWidth || 120) * MANDALA_CELL_SCALE)}
            darkMode={activeDarkMode}
            {bluePropType}
            {redPropType}
          />
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Scroll container for long sequences (>16 beats) */
  .grid-scroll-container {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
  }

  /* Duration-aware layout - start column barrier + step rows to the right */
  .duration-layout {
    display: flex;
    width: 100%;
    min-height: 0;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .duration-layout.dark-mode {
    background: #000;
  }

  /* Start position: fixed column that spans the full height as a barrier */
  .duration-start-col {
    flex: 0 0 calc(1 / var(--max-units, 5) * 100%);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .duration-start-col.dark-mode {
    background: #0a0a0f;
  }

  .duration-start-col .pictograph-cell {
    width: 100%;
    aspect-ratio: 1;
  }

  .duration-start-col :global(.cell-image) {
    width: 100%;
    height: auto;
    display: block;
  }

  /* Steps area: fills remaining width, stacks rows vertically */
  .duration-steps-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .duration-row {
    display: flex;
    gap: 0;
    width: 100%;
  }

  .duration-cell {
    /* flex distributes width proportionally within the row.
       max-width caps each cell so rows with fewer total units
       don't stretch cells beyond their proportion of the max step row. */
    max-width: calc(var(--dur, 1) / var(--step-max, 4) * 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    /* Background matches pictograph so wider cells have seamless side fill */
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .duration-cell.dark-mode {
    background: #0a0a0f;
  }

  .duration-cell .pictograph-cell {
    width: 100%;
    aspect-ratio: auto;
  }

  .duration-cell :global(.cell-image) {
    /* Image fills the cell width; height follows natural aspect ratio */
    width: 100%;
    height: auto;
    display: block;
  }

  /* Grid section - CSS Grid layout */
  .grid-section {
    display: grid;
    gap: 0;
    min-height: 0;
    min-width: 0;
    width: 100%;
    /* Fill remaining space after header/footer. 1fr rows divide the available
       height evenly so the last row isn't clipped behind the footer. Cells
       keep aspect-ratio: 1 but shrink slightly from perfect squares to fit. */
    flex: 1;
    grid-auto-rows: 1fr;
    max-width: 100%;
    overflow: hidden;
    /* Light mode background for empty cells */
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .grid-section.dark-mode {
    /* Dark mode background for empty cells */
    background: #000;
  }

  /* Wrapper for FLIP animation - a real grid item so Svelte can measure bounding rects.
     The pictograph-cell inside fills it completely. */
  .cell-flip-wrapper {
    overflow: hidden;
  }

  .cell-flip-wrapper > .pictograph-cell {
    width: 100%;
  }

  /* Individual pictograph cell */
  .pictograph-cell {
    position: relative;
    /* Container context for step-number-overlay cqw/cqh units */
    container-type: inline-size;
    aspect-ratio: 1;
    overflow: hidden;
    box-sizing: border-box;
    /* Subtle border for cell separation */
    border: 1px solid rgba(0, 0, 0, 0.08);
    /* Button reset for clickable variant */
    background: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: default;
    transition: border-color 350ms ease;
  }

  button.pictograph-cell {
    cursor: pointer;
  }

  .pictograph-cell.dark-mode {
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* Clickable cells */
  .pictograph-cell.clickable {
    cursor: pointer;
  }

  /* No individual cell hover scale in viewer - whole pane scales instead */

  .pictograph-cell.clickable:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
    z-index: 5;
  }

  /* Current step - "Elevated Luxury" selection with scale + glow */
  .pictograph-cell.current {
    z-index: 10;
  }

  /* Golden selection overlay - rendered via ::after so it paints ON TOP of
     the cell image. Stays within cell bounds so nothing overflows. */
  .pictograph-cell.current::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 3px solid rgba(251, 191, 36, 0.9);
    box-shadow: inset 0 0 14px rgba(251, 191, 36, 0.5);
    pointer-events: none;
    animation: cellSelectionGlowIn 0.4s ease-out forwards;
  }

  @keyframes cellSelectionGlowIn {
    0% {
      border-color: rgba(251, 191, 36, 0);
      box-shadow: inset 0 0 0 rgba(251, 191, 36, 0);
    }
    100% {
      border-color: rgba(251, 191, 36, 0.9);
      box-shadow: inset 0 0 14px rgba(251, 191, 36, 0.5);
    }
  }

  /* Played cells (already passed) - dim to distinguish from upcoming */
  .pictograph-cell.played {
    opacity: 0.6;
    transition: opacity 0.15s ease-out;
  }

  /* QR code cell - occupies the last row of column 1, under the start position.
     In duration layouts (flex column), margin-top: auto pushes it to the bottom. */
  .qr-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: auto;
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .qr-cell.dark-mode {
    background: #000;
  }

  .qr-code-image {
    width: 80%;
    height: 80%;
    object-fit: contain;
    -webkit-user-drag: none;
    user-select: none;
  }

  /* Mandala fill cell - sits in empty col-0 cells and shows blue/red/full path viz. */
  .mandala-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    background: transparent;
  }

  .mandala-cell.light-bg {
    background: var(--dm-pictograph-bg, #0a0a0f);
    border-radius: 8px;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .pictograph-cell,
    .grid-section,
    .duration-layout,
    .duration-start-col,
    .duration-cell {
      transition: none;
    }

    .pictograph-cell.current::after {
      animation: none;
    }

    .grid-scroll-container {
      scroll-behavior: auto;
    }
  }
</style>
