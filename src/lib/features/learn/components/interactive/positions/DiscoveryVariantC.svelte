<!--
DiscoveryVariantC - Sequential Reveal
Grid fills screen for tapping. After placement, grid shrinks and
real pictograph fades in below as a reveal moment.
-->
<script lang="ts">
  import PlacementGrid from './PlacementGrid.svelte';
  import PositionVisualizer from './PositionVisualizer.svelte';
  import type { PositionsExperienceStateManager } from './positions-experience-state.svelte';
  import type { HandPosition, PositionType } from '../../../domain/constants/position-quiz-data';
  import { POSITION_TYPE_INFO } from '../../../domain/constants/position-quiz-data';
  import { GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
  import { container } from '$lib/shared/di';

  interface Props {
    experienceState: PositionsExperienceStateManager;
  }

  let { experienceState }: Props = $props();

  const OPPOSITE_PAIRS: Record<string, string> = {
    N: 'S', S: 'N', E: 'W', W: 'E',
    NE: 'SW', SW: 'NE', NW: 'SE', SE: 'NW',
  };

  function detectPositionType(left: string, right: string): PositionType {
    if (left === right) return 'beta';
    if (OPPOSITE_PAIRS[left] === right) return 'alpha';
    return 'gamma';
  }

  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let discoveryCount = $state(0);
  let placedLeft = $state<HandPosition | null>(null);
  let placedRight = $state<HandPosition | null>(null);
  let detectedType = $state<PositionType | null>(null);
  let showResult = $state(false);
  let celebratingSlot = $state<PositionType | null>(null);
  let gridKey = $state(0);

  let hapticService: { trigger: (type: string) => void } | null = null;
  try {
    hapticService = container.items.hapticFeedback as { trigger: (type: string) => void } | null;
  } catch { /* desktop */ }

  const POSITION_TYPES: PositionType[] = ['alpha', 'beta', 'gamma'];
  const TYPE_COLORS: Record<PositionType, string> = {
    alpha: '#22d3ee', beta: '#f59e0b', gamma: '#a78bfa',
  };

  function handlePlacementComplete(left: HandPosition, right: HandPosition) {
    placedLeft = left;
    placedRight = right;
    const type = detectPositionType(left, right);
    detectedType = type;
    showResult = true;

    const isNew = !experienceState.discoveredTypes.has(type);
    if (isNew) {
      experienceState.discoverType(type);
      hapticService?.trigger('success');
      celebratingSlot = type;
      setTimeout(() => { celebratingSlot = null; }, 800);
    }

    discoveryCount++;
    if (discoveryCount === 3 && gridMode === GridMode.DIAMOND) {
      gridMode = GridMode.BOX;
    }
  }

  function handleTryAgain() {
    showResult = false;
    placedLeft = null;
    placedRight = null;
    detectedType = null;
    gridKey++;
  }

  function handleSwitchGrid() {
    showResult = false;
    placedLeft = null;
    placedRight = null;
    detectedType = null;
    gridMode = gridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
    gridKey++;
  }

  function handleAdvanceToQuiz() {
    hapticService?.trigger('selection');
    experienceState.advanceToQuiz();
  }
</script>

<div class="variant-c">
  <p class="main-prompt">Place two hands on the grid</p>

  <!-- Grid: shrinks when result is showing -->
  <div class="grid-area" class:shrunk={showResult}>
    {#key gridKey}
      <PlacementGrid
        {gridMode}
        onPlacementComplete={handlePlacementComplete}
        disabled={showResult}
      />
    {/key}
  </div>

  <!-- Pictograph reveal (after both hands placed) -->
  {#if showResult && placedLeft && placedRight && detectedType}
    {@const info = POSITION_TYPE_INFO[detectedType]}
    <div class="reveal-section">
      <div class="reveal-pictograph">
        <PositionVisualizer
          leftHand={placedLeft}
          rightHand={placedRight}
          {gridMode}
          showLetter={true}
        />
      </div>
      <p class="reveal-label" style="--type-color: {TYPE_COLORS[detectedType]}">
        <span class="reveal-symbol">{info.symbol}</span>
        <span class="reveal-name">{info.label}</span>
      </p>
    </div>
  {/if}

  <!-- Discovery tracker -->
  <div class="discovery-tracker">
    {#each POSITION_TYPES as type (type)}
      {@const info = POSITION_TYPE_INFO[type]}
      {@const discovered = experienceState.discoveredTypes.has(type)}
      <div
        class="tracker-slot"
        class:discovered
        class:celebrating={celebratingSlot === type}
        style="--slot-color: {TYPE_COLORS[type]}"
        aria-label={discovered ? `${info.label} discovered` : 'Undiscovered'}
      >
        {discovered ? info.symbol : '?'}
      </div>
    {/each}
  </div>

  {#if showResult}
    <div class="action-buttons">
      <button class="action-btn" onclick={handleTryAgain}>Try again</button>
      <button class="action-btn" onclick={handleSwitchGrid}>
        {gridMode === GridMode.DIAMOND ? 'Try box grid' : 'Try diamond grid'}
      </button>
    </div>
  {/if}

  {#if experienceState.allDiscovered}
    <button class="advance-btn" onclick={handleAdvanceToQuiz}>
      Ready for the challenge?
    </button>
  {/if}
</div>

<style>
  .variant-c {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    width: 100%;
    flex: 1;
    padding: 1rem;
  }

  .main-prompt {
    margin: 0;
    font-size: 1.25rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    text-align: center;
    font-weight: 600;
  }

  /* Grid area — shrinks when result is revealed */
  .grid-area {
    width: 100%;
    max-width: min(90vw, 500px);
    transition: max-width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .grid-area.shrunk {
    max-width: min(70vw, 300px);
  }

  /* Reveal section */
  .reveal-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    animation: reveal-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes reveal-in {
    from { opacity: 0; transform: translateY(20px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .reveal-pictograph {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 4px 16px var(--theme-shadow, rgba(0, 0, 0, 0.3)),
      0 0 30px rgba(34, 211, 238, 0.15);
  }

  .reveal-label {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reveal-symbol {
    font-size: 2rem;
    font-weight: 700;
    color: var(--type-color);
  }

  .reveal-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--type-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Tracker/button styles */
  .discovery-tracker { display: flex; gap: 1rem; }

  .tracker-slot {
    width: 48px;
    height: 48px;
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

  .tracker-slot.discovered {
    background: color-mix(in srgb, var(--slot-color) 20%, transparent);
    color: var(--slot-color);
    border-color: color-mix(in srgb, var(--slot-color) 40%, transparent);
  }

  .tracker-slot.celebrating {
    animation: celebrate-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes celebrate-pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.35); }
    100% { transform: scale(1); }
  }

  .action-buttons { display: flex; gap: 0.75rem; }

  .action-btn {
    padding: 0.5rem 1.25rem;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
  }

  .advance-btn {
    padding: 0.75rem 2rem;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-on-accent, #000);
    background: var(--theme-accent, #22d3ee);
    border: none;
    border-radius: 10px;
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-area { transition: none; }
    .reveal-section { animation: none; opacity: 1; transform: none; }
    .tracker-slot { transition: none; }
    .tracker-slot.celebrating { animation: none; }
  }
</style>
