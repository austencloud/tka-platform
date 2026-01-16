<!--
SimpleNavigationSidebar - Responsive Navigation

Provides simple navigation matching desktop functionality:
- Single header based on sort method
- Simple buttons for each section
- Scroll-to-section navigation (not filtering)
- Horizontal layout on portrait mobile (above content)
- Vertical layout on wider screens (left sidebar)

Matches the desktop Python app navigation pattern exactly.
-->
<script lang="ts">
  import { ExploreSortMethod } from "./../../../shared/domain/enums/discover-enums.ts";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
    import { onMount } from "svelte";

  let hapticService: IHapticFeedback;

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    currentSortMethod = "ALPHABETICAL",
    availableSections = [],
    onSectionClick = () => {},
    isHorizontal = false, // New prop for layout mode
  } = $props<{
    currentSortMethod?: ExploreSortMethod;
    availableSections?: string[];
    onSectionClick?: (section: string) => void;
    isHorizontal?: boolean; // true = horizontal (portrait mobile), false = vertical (wider screens)
  }>();

  // Get header text based on sort method
  function getHeaderText(sortMethod: ExploreSortMethod): string {
    switch (sortMethod) {
      case ExploreSortMethod.ALPHABETICAL:
        return "Letter";
      case ExploreSortMethod.DIFFICULTY_LEVEL:
        return "Level";
      case ExploreSortMethod.SEQUENCE_LENGTH:
        return "Length";
      case ExploreSortMethod.DATE_ADDED:
        return "Date";
      default:
        return "Navigation";
    }
  }

  // Handle section button click
  function handleSectionClick(section: string) {
    hapticService?.trigger("selection");
    onSectionClick(section);
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Get display text for section button - remove counts and extract clean text
  function getSectionDisplayText(
    section: string,
    sortMethod: ExploreSortMethod
  ): string {
    // Remove count information like "(15 sequences)" from the section title
    let cleanText = section.replace(/\s*\(\d+\s+sequences?\)$/, "");

    if (
      sortMethod === ExploreSortMethod.DIFFICULTY_LEVEL &&
      cleanText.startsWith("Level ")
    ) {
      return cleanText.replace("Level ", "");
    }

    // For alphabetical sorting, extract just the letter (remove emoji prefixes if any)
    if (sortMethod === ExploreSortMethod.ALPHABETICAL) {
      // Extract the letter portion before the hyphen (handles "A - 4 steps" format)
      const parts = cleanText.split(" - ");
      if (parts.length > 1 && parts[0]) {
        return parts[0].trim(); // Return just "A" or "γ" etc.
      }

      // Fallback: Remove any emoji prefixes and extract the first letter (English or Unicode)
      const match = cleanText.match(/([A-Z\u0370-\u03FF\u0400-\u04FF])/i);
      return match ? match[1] || cleanText : cleanText;
    }

    // For other sort methods, remove emoji prefixes but keep the main text
    if (sortMethod === ExploreSortMethod.DIFFICULTY_LEVEL) {
      cleanText = cleanText.replace(/^[🟢🟡🔴⚪]\s*/, "");
    } else if (sortMethod === ExploreSortMethod.AUTHOR) {
      cleanText = cleanText.replace(/^👤\s*/, "");
    } else if (sortMethod === ExploreSortMethod.DATE_ADDED) {
      cleanText = cleanText.replace(/^📅\s*/, "");
    }

    return cleanText;
  }

  // Deduplicate sections when sorting alphabetically (to handle sub-grouped sections like "A - 4 steps", "A - 8 steps")
  const uniqueSections = $derived(() => {
    if (currentSortMethod === ExploreSortMethod.ALPHABETICAL) {
      const seen = new Set<string>();
      return availableSections.filter((section: string) => {
        const letter = getSectionDisplayText(section, currentSortMethod);
        if (seen.has(letter)) {
          return false;
        }
        seen.add(letter);
        return true;
      });
    }
    return availableSections;
  });
</script>

<div class="simple-navigation-sidebar" class:horizontal={isHorizontal}>
  <!-- Header -->
  <div class="nav-header">
    <h3 class="header-text">{getHeaderText(currentSortMethod)}</h3>
    {#if !isHorizontal}
      <div class="header-line"></div>
    {/if}
  </div>

  <!-- Navigation Buttons -->
  <div class="nav-buttons">
    {#each uniqueSections() as section (section)}
      <button
        class="nav-button"
        onclick={() => handleSectionClick(section)}
        type="button"
      >
        {getSectionDisplayText(section, currentSortMethod)}
      </button>
    {/each}
  </div>

  <!-- Spacer to push content to top (vertical layout only) -->
  {#if !isHorizontal}
    <div class="nav-spacer"></div>
  {/if}
</div>

<style>
  /* Base styles - Vertical (sidebar) layout by default */
  .simple-navigation-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    background: var(--theme-card-bg);
    border-right: 1px solid var(--theme-stroke-strong);
    width: clamp(80px, 10vw, 160px);
    flex-shrink: 0;
    overflow: hidden;
  }

  /* Horizontal layout - top bar (all screen sizes) */
  .simple-navigation-sidebar.horizontal {
    flex-direction: row;
    height: auto;
    width: 100%;
    padding: 12px 16px;
    border-right: none;
    border-bottom: none;
    background: transparent;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 1rem;
    align-items: center;
  }

  .nav-header {
    display: none; /* Hide header in vertical mode - buttons are self-explanatory */
  }

  /* Horizontal header - show and make compact */
  .simple-navigation-sidebar.horizontal .nav-header {
    display: flex;
    align-items: center;
    margin-bottom: 0;
    flex-shrink: 0;
    padding-right: 12px;
    margin-right: 12px;
    border-right: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
  }

  .header-text {
    color: var(--theme-text, white);
    font-size: clamp(0.8rem, 2.2vw, 1.1rem);
    font-weight: bold;
    text-align: center;
    margin: 0 0 0.5rem 0;
    padding: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Horizontal header text - inline, slightly larger */
  .simple-navigation-sidebar.horizontal .header-text {
    margin: 0;
    padding: 0;
    font-size: 0.95rem;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .header-line {
    height: 1px;
    background-color: var(--theme-text, white);
    margin: 0;
  }

  /* Vertical buttons - column layout */
  .nav-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  /* Horizontal buttons - row layout with scroll */
  .simple-navigation-sidebar.horizontal .nav-buttons {
    flex-direction: row;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    padding-right: 0;
    padding-bottom: 0;
    gap: 0.75rem;
  }

  .nav-button {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    color: var(--theme-text, white);
    padding: clamp(0.75rem, 2vw, 1rem) clamp(0.5rem, 1.5vw, 0.75rem);
    border-radius: 6px;
    cursor: pointer;
    font-size: clamp(1.1rem, 2.5vw, 1.4rem);
    font-weight: 600;
    transition: all 0.2s ease;
    text-align: center;
    min-height: clamp(48px, 8vw, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Horizontal buttons - compact with min-width, optimized for top bar */
  .simple-navigation-sidebar.horizontal .nav-button {
    padding: 8px 16px;
    font-size: 1rem;
    font-weight: 600;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    flex-shrink: 0;
    white-space: nowrap;
    border-radius: 8px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong);
  }

  .nav-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(in srgb, var(--theme-text, white) 50%, transparent);
    transform: translateY(-1px);
  }

  .nav-button:active {
    transform: translateY(0);
    background: color-mix(in srgb, var(--theme-text, white) 30%, transparent);
  }

  .nav-spacer {
    flex-shrink: 0;
    height: 1rem;
  }

  /* Custom scrollbar for vertical nav-buttons */
  .nav-buttons::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  .nav-buttons::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .nav-buttons::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;
  }

  .nav-buttons::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Horizontal scrollbar styling */
  .simple-navigation-sidebar.horizontal .nav-buttons::-webkit-scrollbar {
    height: 6px;
  }

  /* Mobile-first responsive adjustments */
  @media (max-width: 480px) {
    .simple-navigation-sidebar {
      width: clamp(80px, 20vw, 140px);
      padding: 1rem 0.75rem;
    }

    .header-text {
      font-size: 1rem;
      padding: 0.25rem;
    }

    .nav-button {
      padding: 0.75rem 0.5rem;
      font-size: 1rem;
      min-height: var(--min-touch-target);
      border-radius: 8px;
    }

    /* Horizontal mode overrides for mobile */
    .simple-navigation-sidebar.horizontal {
      padding: 0.75rem;
    }

    .simple-navigation-sidebar.horizontal .header-text {
      font-size: 0.95rem;
    }

    .simple-navigation-sidebar.horizontal .nav-button {
      padding: 0.6rem 1rem;
      font-size: 1rem;
      min-width: var(--min-touch-target);
    }
  }

  /* Tablet responsive adjustments */
  @media (min-width: 481px) and (max-width: 768px) {
    .simple-navigation-sidebar {
      width: clamp(75px, 18vw, 130px);
    }

    .header-text {
      font-size: 0.9375rem;
    }

    .nav-button {
      padding: 0.6875rem 0.5rem;
      font-size: 1.0625rem;
      min-height: var(--min-touch-target);
    }
  }
</style>
