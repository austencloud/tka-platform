<script lang="ts">
  import type { Deck } from '../../../domain/models/Deck';
  import { getReversalPattern } from '../../../domain/reversal-patterns';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    filteredDecks: Deck[];
    selectedPattern: string | null;
    accentColor: string;
    onSelectPattern: (pattern: string) => void;
  }

  let { filteredDecks, selectedPattern, accentColor, onSelectPattern }: Props = $props();

  const uniquePatterns = $derived.by(() => {
    const seen = new Set<string>();
    const result: { id: string; label: string; symbols: string[] }[] = [];
    for (const deck of filteredDecks) {
      const key = deck.reversalPattern.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const pattern = getReversalPattern(deck.reversalPattern);
      const label = pattern?.label ?? deck.reversalPattern;
      const period = pattern?.period ?? 4;
      const seq = pattern?.sequence ?? deck.reversalPattern;
      const symbols = seq.slice(0, Math.min(4, period)).split('');
      result.push({ id: deck.reversalPattern, label, symbols });
    }
    return result;
  });

  const sectionState = $derived(uniquePatterns.length > 0 ? 'active' as const : 'disabled' as const);

  function getDotPair(symbol: string): [boolean, boolean] {
    switch (symbol) {
      case 'P': return [true, true];
      case 'R': return [true, false];
      case 'B': return [false, true];
      default: return [false, false];
    }
  }
</script>

<SidebarFilterSection
  label="Reversal"
  state={sectionState}
  {accentColor}
  disabledMessage="Select turn pattern first..."
>
  <div class="reversal-pills">
    {#each uniquePatterns as pat}
      <button
        class="reversal-pill"
        class:selected={selectedPattern === pat.id}
        onclick={() => onSelectPattern(pat.id)}
        aria-pressed={selectedPattern === pat.id}
      >
        <div class="dots">
          {#each pat.symbols as symbol}
            {@const [red, blue] = getDotPair(symbol)}
            <div class="dot-pair">
              <div class="dot" class:red class:empty={!red}></div>
              <div class="dot" class:blue class:empty={!blue}></div>
            </div>
          {/each}
        </div>
        <span class="rev-label">{pat.label}</span>
      </button>
    {/each}
  </div>
</SidebarFilterSection>

<style>
  .reversal-pills {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reversal-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.015);
    cursor: pointer;
    font-family: inherit;
    color: rgba(255, 255, 255, 0.5);
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .reversal-pill:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .reversal-pill.selected {
    border-color: rgba(var(--sf-accent-rgb, 99,183,205), 0.4);
    background: rgba(var(--sf-accent-rgb, 99,183,205), 0.08);
    color: rgba(255, 255, 255, 0.85);
  }

  .dots {
    display: flex;
    gap: 3px;
  }

  .dot-pair {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .dot.red { background: #e74c3c; }
  .dot.blue { background: #3498db; }
  .dot.empty { background: rgba(255, 255, 255, 0.06); }

  .rev-label {
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .reversal-pill { transition: none; }
  }
</style>
