<!--
	Codex Pictograph Grid Component

	Organizes pictographs in rows/sections following the desktop layout.
	Matches desktop CodexPictographGrid functionality with proper row organization.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  // Props
  let { pictographsByLetter, letterRows, onPictographClick } = $props<{
    pictographsByLetter: Record<string, PictographData | null>;
    letterRows: string[][];
    onPictographClick?: (pictograph: PictographData) => void;
  }>();

  // Services
  const hapticService = getHapticFeedback();

  // Handle pictograph click
  function handlePictographClick(pictograph: PictographData) {
    hapticService?.trigger("selection");
    onPictographClick?.(pictograph);
  }

  // Create placeholder for missing pictographs
  function createPlaceholder(letter: string) {
    return {
      id: `placeholder-${letter}`,
      motions: {},
    } as PictographData;
  }

  // Define letter type sections with their row ranges, descriptions, and colors
  // startRow/endRow are ARRAY indices matching the JSON rows array order
  const letterTypeSections = [
    {
      name: "Type 1",
      description: "Dual-Shift",
      startRow: 0,
      endRow: 3,
      primaryColor: "#36c3ff",
      secondaryColor: "#6F2DA8",
    }, // A-V (rows 0-3)
    {
      name: "Type 2",
      description: "Shift",
      startRow: 4,
      endRow: 5,
      primaryColor: "#6F2DA8",
      secondaryColor: "#6F2DA8",
    }, // W-Z, Σ-Ω (rows 4-5, 4 letters each)
    {
      name: "Type 3",
      description: "Cross-Shift",
      startRow: 6,
      endRow: 7,
      primaryColor: "#26e600",
      secondaryColor: "#6F2DA8",
    }, // W--Z-, Σ--Ω- (rows 6-7, 4 letters each)
    {
      name: "Type 4",
      description: "Dash",
      startRow: 8,
      endRow: 8,
      primaryColor: "#26e600",
      secondaryColor: "#26e600",
    }, // Φ,Ψ,Λ (row 8)
    {
      name: "Type 5",
      description: "Dual-Dash",
      startRow: 9,
      endRow: 9,
      primaryColor: "#00b3ff",
      secondaryColor: "#26e600",
    }, // Φ-,Ψ-,Λ- (row 9)
    {
      name: "Type 6",
      description: "Static",
      startRow: 10,
      endRow: 10,
      primaryColor: "#eb7d00",
      secondaryColor: "#eb7d00",
    }, // α,β,γ (row 10)
  ];

  // Function to get section for a given row index
  function getSectionForRow(rowIndex: number) {
    return letterTypeSections.find(
      (section) => rowIndex >= section.startRow && rowIndex <= section.endRow
    );
  }

  // Function to check if this is the first row of a section
  function isFirstRowOfSection(rowIndex: number) {
    return letterTypeSections.some((section) => section.startRow === rowIndex);
  }

  const wordColors: Record<string, string> = {
    Shift: "#6F2DA8",
    Dual: "#00b3ff",
    Dash: "#26e600",
    Cross: "#26e600",
    Static: "#eb7d00",
  };

  // Returns an array of {text, color} parts for a description string
  function getDescriptionParts(description: string): { text: string; color: string }[] {
    const parts = description.split("-");
    return parts.flatMap((part, i) => {
      const color = wordColors[part] ?? "inherit";
      const entries: { text: string; color: string }[] = [{ text: part, color }];
      if (i < parts.length - 1) {
        entries.push({ text: "-", color: "inherit" });
      }
      return entries;
    });
  }
</script>

<div class="codex-pictograph-grid">
  {#each letterRows as row, rowIndex}
    <!-- Add section header if this is the first row of a section -->
    {#if isFirstRowOfSection(rowIndex)}
      {@const section = getSectionForRow(rowIndex)}
      {#if section}
        <div class="section-header">
          <div class="section-header-container">
            <span class="section-text">
              <span class="section-type">{section.name}:</span>
              {#each getDescriptionParts(section.description) as part}<span style:color={part.color}>{part.text}</span>{/each}
            </span>
          </div>
        </div>
      {/if}
    {/if}

    <div class="pictograph-row" data-row={rowIndex}>
      {#each row as letter}
        {@const pictograph =
          pictographsByLetter[letter] || createPlaceholder(letter)}
        {@const isPlaceholder = !pictographsByLetter[letter]}

        <button
          class="pictograph-item"
          class:placeholder={isPlaceholder}
          onclick={() => !isPlaceholder && handlePictographClick(pictograph)}
          title={letter}
          aria-label={letter}
          disabled={isPlaceholder}
        >
          {#if isPlaceholder}
            <!-- Placeholder for missing pictographs -->
            <span class="placeholder-letter">{letter}</span>
          {:else}
            <!-- Actual pictograph - simplified container structure -->
            <PictographContainer pictographData={pictograph} />
          {/if}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .codex-pictograph-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: transparent;
    /* CSS variable for container width - defaults to 700px (drawer width minus padding) */
    --grid-container-width: 100%;
    --grid-gap: 8px;
    --max-columns: 8;
    /* Calculate cell size: (container - gaps) / max columns */
    --cell-size: calc(
      (
          var(--grid-container-width) - (var(--max-columns) - 1) *
            var(--grid-gap) - 32px
        ) /
        var(--max-columns)
    );
  }

  .section-header {
    display: flex;
    justify-content: center;
    margin: 16px 0 8px 0;
  }

  .section-header:first-child {
    margin-top: 0;
  }

  .section-header-container {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 8px;
    padding: 6px 16px;
  }

  .section-text {
    display: inline-block;
    font-family: var(--font-sans, system-ui);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
  }

  .section-type {
    color: var(--theme-text);
    font-weight: 600;
  }

  .pictograph-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--grid-gap);
    margin: 0 auto;
    max-width: 100%;
    padding: 4px 0;
    flex-wrap: nowrap;
  }

  /* Responsive cell sizing based on container width */
  .pictograph-row > * {
    /* Use min() to cap at reasonable max size */
    width: min(var(--cell-size), 80px);
    height: min(var(--cell-size), 80px);
    flex-shrink: 0;
  }

  /* Desktop: larger cells when drawer is wide */
  @media (min-width: 769px) {
    .codex-pictograph-grid {
      --cell-size: calc((660px - 7 * 8px) / 8); /* ~75px per cell */
    }
  }

  /* Mobile: full width, calculate for 8 columns */
  @media (max-width: 768px) {
    .codex-pictograph-grid {
      padding: 12px;
      gap: 10px;
      --grid-gap: 6px;
      /* On mobile, use viewport width minus drawer padding */
      --cell-size: calc((100vw - 24px - 7 * 6px) / 8);
    }

    .pictograph-row > * {
      width: var(--cell-size);
      height: var(--cell-size);
      min-width: 36px;
      min-height: var(--min-touch-target);
    }
  }

  /* Very small screens */
  @media (max-width: 400px) {
    .codex-pictograph-grid {
      padding: 8px;
      --grid-gap: 4px;
      --cell-size: calc((100vw - 16px - 7 * 4px) / 8);
    }

    .pictograph-row > * {
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }
  }

  .pictograph-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--desktop-spacing-xs); /* Reduced gap */
    padding: var(--desktop-spacing-xs); /* Reduced padding */
    background: var(--desktop-bg-tertiary); /* Back to transparent background */
    border: 1px solid var(--desktop-border-tertiary);
    border-radius: var(--desktop-border-radius-sm);
    cursor: pointer;
    transition: all var(--desktop-transition-normal);
    min-width: fit-content;
    position: relative;
    overflow: hidden;
  }

  .pictograph-item:not(.placeholder):hover {
    background: var(--desktop-bg-secondary);
    border-color: var(--desktop-border-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .pictograph-item:not(.placeholder):active {
    transform: translateY(0);
    box-shadow: 0 2px 6px var(--theme-shadow);
  }

  .pictograph-item.placeholder {
    cursor: default;
    opacity: 0.6;
    background: var(--desktop-bg-quaternary);
    border-style: dashed;
    border-color: var(--desktop-border-disabled);
  }

  .placeholder-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--desktop-bg-quaternary);
    border: 1px dashed var(--desktop-border-disabled);
    border-radius: var(--desktop-border-radius-xs);
    color: var(--desktop-text-disabled);
    font-weight: bold;
    font-size: var(--desktop-font-size-sm);
  }

  /* Row-specific styling */
  .pictograph-row[data-row="0"] .pictograph-item:hover {
    border-color: var(--desktop-primary-blue-border);
  }

  .pictograph-row[data-row="1"] .pictograph-item:hover {
    border-color: var(--desktop-primary-green-border);
  }

  .pictograph-row[data-row="2"] .pictograph-item:hover {
    border-color: var(--desktop-primary-purple-border);
  }

  .pictograph-row[data-row="3"] .pictograph-item:hover {
    border-color: var(--desktop-primary-orange-border);
  }

  .pictograph-row[data-row="4"] .pictograph-item:hover {
    border-color: var(--desktop-primary-red-border);
  }

  /* Animation for loading */
  .pictograph-item:not(.placeholder) {
    animation: fadeInUp var(--duration-emphasis) ease-out;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Additional mobile adjustments for items */
  @media (max-width: 768px) {
    .pictograph-item {
      padding: 2px;
    }

    .section-header {
      margin: 12px 0 6px 0;
    }

    .section-text {
      font-size: var(--font-size-compact, 12px);
    }
  }

  @media (max-width: 480px) {
    .pictograph-item {
      padding: 1px;
      gap: 0;
    }

    .section-header-container {
      padding: 4px 12px;
    }

    .section-text {
      font-size: var(--font-size-compact, 12px);
    }
  }

</style>
