<!--
DiscoveryVariantA - Grid-Only Discovery
The grid is the entire experience. Tap two points, see the position type label.
No separate pictograph view. Minimal and fast.
-->
<script lang="ts">
  import PlacementGrid from './PlacementGrid.svelte';
  import type { PositionsExperienceStateManager } from './positions-experience-state.svelte';
  import type { HandPosition, PositionType } from '../../../domain/constants/position-quiz-data';
  import { POSITION_TYPE_INFO } from '../../../domain/constants/position-quiz-data';
  import { GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
  import { container } from '$lib/shared/di';

  interface Props {
    experienceState: PositionsExperienceStateManager;
  }

  let { experienceState }: Props = $props();

  // Position type detection
  const OPPOSITE_PAIRS: Record<string, string> = {
    N: 'S', S: 'N', E: 'W', W: 'E',
    NE: 'SW', SW: 'NE', NW: 'SE', SE: 'NW',
  };

  function detectPositionType(left: string, right: string): PositionType {
    if (left === right) return 'beta';
    if (OPPOSITE_PAIRS[left] === right) return 'alpha';
    return 'gamma';
  }

  // Local state
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let discoveryCount = $state(0);
  let detectedType = $state<PositionType | null>(null);
  let showResult = $state(false);
  let celebratingSlot = $state<PositionType | null>(null);
  let gridKey = $state(0);

  let hapticService: { trigger: (type: string) => void } | null = null;
  try {
    hapticService = container.items.hapticFeedback as { trigger: (type: string) => void } | null;
  } catch { /* desktop */ }

  const POSITION_TYPES: PositionType[] = ['alpha', 'beta', 'gamma'];

  // Type colors for the result label
  const TYPE_COLORS: Record<PositionType, string> = {
    alpha: '#22d3ee',
    beta: '#f59e0b',
    gamma: '#a78bfa',
  };

  function handlePlacementComplete(left: HandPosition, right: HandPosition) {
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
    detectedType = null;
    gridKey++;
  }

  function handleSwitchGrid() {
    showResult = false;
    detectedType = null;
    gridMode = gridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
    gridKey++;
  }

  function handleAdvanceToQuiz() {
    hapticService?.trigger('selection');
    experienceState.advanceToQuiz();
  }
</script>

<div class="variant-a">
  <p class="main-prompt">Place two hands on the grid</p>

  <div class="grid-area">
    {#key gridKey}
      <PlacementGrid
        {gridMode}
        onPlacementComplete={handlePlacementComplete}
        disabled={showResult}
      />
    {/key}
  </div>

  <!-- Result label (fades in after placement) -->
  {#if showResult && detectedType}
    {@const info = POSITION_TYPE_INFO[detectedType]}
    <div class="result-label" style="--type-color: {TYPE_COLORS[detectedType]}">
      <span class="result-symbol">{info.symbol}</span>
      <span class="result-name">{info.label}</span>
    </div>
  {/if}

  <!-- Discovery tracker: 3 slots -->
  <div class="discovery-tracker">
    {#each POSITION_TYPES as type (type)}
      {@const info = POSITION_TYPE_INFO[type]}
      {@const discovered = experienceState.discoveredTypes.has(type)}
      <div
        class="tracker-slot"
        class:discovered
        class:celebrating={celebratingSlot === type}
        style="--slot-color: {TYPE_COLORS[type]}"
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

  <!-- Action buttons -->
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
  .variant-a {
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

  .grid-area {
    width: 100%;
    max-width: min(90vw, 500px);
  }

  /* Result label */
  .result-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: fade-slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .result-symbol {
    font-size: 2rem;
    font-weight: 700;
    color: var(--type-color);
  }

  .result-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--type-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @keyframes fade-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Discovery tracker */
  .discovery-tracker {
    display: flex;
    gap: 1rem;
  }

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

  .slot-unknown {
    color: var(--theme-text, rgba(255, 255, 255, 0.3));
    font-weight: 400;
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

  /* Action buttons */
  .action-buttons {
    display: flex;
    gap: 0.75rem;
  }

  .action-btn {
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

  .action-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: rgba(255, 255, 255, 0.08);
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
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .advance-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(34, 211, 238, 0.3);
  }

  @media (prefers-reduced-motion: reduce) {
    .result-label { animation: none; opacity: 1; transform: none; }
    .tracker-slot { transition: none; }
    .tracker-slot.celebrating { animation: none; }
    .action-btn, .advance-btn { transition: none; }
  }
</style>
