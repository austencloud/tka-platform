<!--
PositionsDiscoveryPhase - First phase of the Positions lesson.
Users discover alpha/beta/gamma by placing hands on an interactive grid.
No text explanation — pure discovery through interaction.
-->
<script lang="ts">
  import PlacementGrid from './PlacementGrid.svelte';
  import PositionVisualizer from './PositionVisualizer.svelte';
  import type { PositionsExperienceStateManager } from './positions-experience-state.svelte';
  import type { HandPosition, PositionType } from '../../domain/constants/position-quiz-data';
  import { POSITION_TYPE_INFO } from '../../domain/constants/position-quiz-data';
  import { GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
  import { container } from '$lib/shared/di';

  interface Props {
    experienceState: PositionsExperienceStateManager;
  }

  let { experienceState }: Props = $props();

  // =========================================================================
  // Position type detection
  // =========================================================================

  const OPPOSITE_PAIRS: Record<string, string> = {
    N: 'S', S: 'N', E: 'W', W: 'E',
    NE: 'SW', SW: 'NE', NW: 'SE', SE: 'NW',
  };

  function detectPositionType(left: string, right: string): PositionType {
    if (left === right) return 'beta';
    if (OPPOSITE_PAIRS[left] === right) return 'alpha';
    return 'gamma';
  }

  // =========================================================================
  // Local state
  // =========================================================================

  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let discoveryCount = $state(0);
  let placedLeft = $state<HandPosition | null>(null);
  let placedRight = $state<HandPosition | null>(null);
  let detectedType = $state<PositionType | null>(null);
  let showResult = $state(false);
  let celebratingSlot = $state<PositionType | null>(null);

  // Haptic feedback
  let hapticService: { trigger: (type: string) => void } | null = null;
  try {
    hapticService = container.items.hapticFeedback as {
      trigger: (type: string) => void;
    } | null;
  } catch {
    // Haptic not available on desktop
  }

  // =========================================================================
  // Derived
  // =========================================================================

  const hasPlacement = $derived(placedLeft !== null && placedRight !== null);
  const hasAnyDiscovery = $derived(experienceState.discoveredTypes.size > 0);

  const POSITION_TYPES: PositionType[] = ['alpha', 'beta', 'gamma'];

  // =========================================================================
  // Handlers
  // =========================================================================

  function handlePlacementComplete(left: HandPosition, right: HandPosition) {
    placedLeft = left;
    placedRight = right;
    const type = detectPositionType(left, right);
    detectedType = type;

    const isNew = !experienceState.discoveredTypes.has(type);
    if (isNew) {
      experienceState.discoverType(type);
      hapticService?.trigger('success');
      celebratingSlot = type;
      setTimeout(() => {
        celebratingSlot = null;
      }, 800);
    }

    discoveryCount++;

    // Switch to box mode after 3 discoveries on diamond for variety
    if (discoveryCount === 3 && gridMode === GridMode.DIAMOND) {
      gridMode = GridMode.BOX;
    }

    // Fade in the result display
    showResult = true;
  }

  function handleTryAgain() {
    showResult = false;
    placedLeft = null;
    placedRight = null;
    detectedType = null;

    // Force PlacementGrid reset by toggling gridMode
    // (PlacementGrid resets on gridMode change via $effect)
    const current = gridMode;
    gridMode = current === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
    // Restore immediately — the $effect already fired
    requestAnimationFrame(() => {
      gridMode = current;
    });
  }

  function handleResetGrid() {
    showResult = false;
    placedLeft = null;
    placedRight = null;
    detectedType = null;
    // Swap grid mode cleanly to get a fresh grid
    gridMode = gridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
  }

  function handleAdvanceToQuiz() {
    hapticService?.trigger('selection');
    experienceState.advanceToQuiz();
  }
</script>

<div class="discovery-phase">
  <!-- Minimal prompt -->
  <p class="prompt anim-item" style="--anim-order: 0;">Place two hands on the grid</p>

  <!-- Interactive grid -->
  <div class="grid-container">
    <PlacementGrid
      {gridMode}
      onPlacementComplete={handlePlacementComplete}
      disabled={showResult}
    />
  </div>

  <!-- Result display (shown after both hands placed) -->
  {#if showResult && detectedType && placedLeft && placedRight}
    {@const info = POSITION_TYPE_INFO[detectedType]}
    <div class="result-display" class:visible={showResult}>
      <div class="result-visualizer">
        <PositionVisualizer
          leftHand={placedLeft}
          rightHand={placedRight}
          {gridMode}
          showLetter={true}
        />
      </div>
      <p class="result-label" data-type={detectedType}>
        <span class="result-symbol">{info.symbol}</span>
        <span class="result-name">{info.label}</span>
      </p>
    </div>
  {/if}

  <!-- Discovery tracker -->
  <div class="discovery-tracker anim-item" style="--anim-order: 1;">
    {#each POSITION_TYPES as type (type)}
      {@const info = POSITION_TYPE_INFO[type]}
      {@const discovered = experienceState.discoveredTypes.has(type)}
      <div
        class="tracker-slot"
        class:discovered
        class:celebrating={celebratingSlot === type}
        data-type={type}
        aria-label={discovered ? `${info.label} discovered` : 'Undiscovered position type'}
      >
        {#if discovered}
          <span class="slot-symbol">{info.symbol}</span>
        {:else}
          <span class="slot-unknown">?</span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Exploration tools (after first discovery) -->
  {#if hasAnyDiscovery}
    <div class="exploration-tools">
      {#if showResult}
        <button class="tool-button" onclick={handleTryAgain}>
          Try again
        </button>
        <button class="tool-button" onclick={handleResetGrid}>
          Switch grid
        </button>
      {/if}
    </div>
  {/if}

  <!-- Advance button (when all discovered) -->
  {#if experienceState.allDiscovered}
    <button class="advance-button" onclick={handleAdvanceToQuiz}>
      Ready for the challenge?
    </button>
  {/if}
</div>

<style>
  .discovery-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
  }

  .prompt {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    text-align: center;
    font-weight: 500;
  }

  .grid-container {
    width: 100%;
  }

  /* =========================================================================
   * Result display
   * ========================================================================= */

  .result-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    opacity: 0;
    transform: translateY(8px);
    animation: resultFadeIn 0.4s ease forwards;
  }

  .result-display.visible {
    opacity: 1;
  }

  @keyframes resultFadeIn {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .result-visualizer {
    width: 160px;
    height: 160px;
  }

  .result-label {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
  }

  .result-symbol {
    font-size: 1.5rem;
  }

  .result-label[data-type='alpha'] .result-symbol {
    color: #22d3ee;
  }

  .result-label[data-type='beta'] .result-symbol {
    color: #f59e0b;
  }

  .result-label[data-type='gamma'] .result-symbol {
    color: #a78bfa;
  }

  /* =========================================================================
   * Discovery tracker
   * ========================================================================= */

  .discovery-tracker {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .tracker-slot {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    transition: transform 0.3s ease, border-color 0.3s ease, background 0.3s ease;
  }

  .slot-unknown {
    color: var(--theme-text, rgba(255, 255, 255, 0.3));
    font-weight: 400;
  }

  .slot-symbol {
    color: inherit;
  }

  .tracker-slot.discovered {
    border-color: transparent;
  }

  .tracker-slot.discovered[data-type='alpha'] {
    background: rgba(34, 211, 238, 0.2);
    color: #22d3ee;
    border-color: rgba(34, 211, 238, 0.4);
  }

  .tracker-slot.discovered[data-type='beta'] {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.4);
  }

  .tracker-slot.discovered[data-type='gamma'] {
    background: rgba(167, 139, 250, 0.2);
    color: #a78bfa;
    border-color: rgba(167, 139, 250, 0.4);
  }

  /* Celebration animation on new discovery */
  .tracker-slot.celebrating {
    animation: celebratePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes celebratePop {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.35);
    }
    100% {
      transform: scale(1);
    }
  }

  /* =========================================================================
   * Exploration tools
   * ========================================================================= */

  .exploration-tools {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .tool-button {
    padding: 0.5rem 1.25rem;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .tool-button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: rgba(255, 255, 255, 0.08);
  }

  /* =========================================================================
   * Advance button
   * ========================================================================= */

  .advance-button {
    padding: 0.75rem 2rem;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-on-accent, #000);
    background: var(--theme-accent, #22d3ee);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .advance-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(34, 211, 238, 0.3);
  }

  .advance-button:active {
    transform: translateY(0);
  }

  /* =========================================================================
   * Reduced motion
   * ========================================================================= */

  @media (prefers-reduced-motion: reduce) {
    .result-display {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .tracker-slot {
      transition: none;
    }

    .tracker-slot.celebrating {
      animation: none;
    }

    .tool-button {
      transition: none;
    }

    .advance-button {
      transition: none;
    }
  }
</style>
