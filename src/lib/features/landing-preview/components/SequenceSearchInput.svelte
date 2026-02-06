<script lang="ts">
  import type { MatchedSequence } from "../types";

  interface Props {
    matchedSequences: MatchedSequence[];
    searching: boolean;
    searchQuery: string;
    onSearch: (query: string) => void;
    onSelect: (sequence: MatchedSequence) => void;
    disabled?: boolean;
    autofocus?: boolean;
  }

  let {
    matchedSequences,
    searching,
    searchQuery,
    onSearch,
    onSelect,
    disabled = false,
    autofocus = false,
  }: Props = $props();

  let inputElement: HTMLInputElement | undefined = $state();
  let showResults = $state(false);
  let highlightIndex = $state(-1);

  // Greek letter substitution map: 3-letter prefix → Greek character
  const greekMap: Record<string, string> = {
    sig: "Σ",
    del: "Δ",
    the: "Θ",
    ome: "Ω",
    phi: "Φ",
    psi: "Ψ",
    lam: "Λ",
    alp: "α",
    bet: "β",
    gam: "γ",
  };

  // Regex to find Greek letter prefixes (with optional dash suffix)
  const greekPattern = /(sig|del|the|ome|phi|psi|lam|alp|bet|gam)(-?)/gi;

  function substituteGreekLetters(text: string): string {
    return text.replace(greekPattern, (_, prefix, dash) => {
      const greek = greekMap[prefix.toLowerCase()];
      return greek ? greek + dash : prefix + dash;
    });
  }

  $effect(() => {
    if (autofocus && inputElement && !disabled) {
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
  });

  $effect(() => {
    if (matchedSequences.length > 0) {
      showResults = true;
      highlightIndex = 0;
    } else {
      highlightIndex = -1;
    }
  });

  function handleInput(e: Event) {
    const rawValue = (e.target as HTMLInputElement).value;
    const substituted = substituteGreekLetters(rawValue);

    // If substitution occurred, update the input field visually
    if (substituted !== rawValue && inputElement) {
      inputElement.value = substituted;
    }

    onSearch(substituted);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!showResults || matchedSequences.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = (highlightIndex + 1) % matchedSequences.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = highlightIndex <= 0 ? matchedSequences.length - 1 : highlightIndex - 1;
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      const selected = matchedSequences[highlightIndex];
      if (selected) {
        onSelect(selected);
      }
      showResults = false;
    } else if (e.key === "Escape") {
      showResults = false;
    }
  }

  function handleFocus() {
    if (matchedSequences.length > 0) {
      showResults = true;
    }
  }

  function handleBlur() {
    setTimeout(() => {
      showResults = false;
    }, 200);
  }

  function selectSequence(seq: MatchedSequence) {
    onSelect(seq);
    showResults = false;
  }
</script>

<div class="sequence-search">
  <div class="search-input-wrapper">
    <i class="fas fa-search search-icon" aria-hidden="true"></i>
    <input
      type="search"
      class="search-input"
      bind:this={inputElement}
      value={searchQuery}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
      placeholder="Search by word..."
      {disabled}
      autocomplete="off"
      aria-label="Search sequences"
    />
    {#if searching}
      <i class="fas fa-spinner fa-spin loading-icon" aria-hidden="true"></i>
    {/if}
  </div>

  {#if showResults && matchedSequences.length > 0}
    <div class="search-results" role="listbox">
      {#each matchedSequences as seq, i (seq.id)}
        <button
          type="button"
          class="result-item"
          class:highlighted={i === highlightIndex}
          role="option"
          aria-selected={i === highlightIndex}
          onclick={() => selectSequence(seq)}
        >
          {#if seq.thumbnail}
            <img src={seq.thumbnail} alt="" class="result-thumb" />
          {:else}
            <div class="result-thumb-placeholder">
              <i class="fas fa-layer-group" aria-hidden="true"></i>
            </div>
          {/if}
          <div class="result-info">
            <span class="result-word">{seq.word}</span>
            <span class="result-owner">by {seq.ownerName}</span>
          </div>
          <kbd class="result-key">{i + 1}</kbd>
        </button>
      {/each}
    </div>
  {/if}

  {#if showResults && matchedSequences.length === 0 && searchQuery.length >= 2 && !searching}
    <div class="search-results">
      <div class="no-results">
        <i class="fas fa-search" aria-hidden="true"></i>
        No sequences found
      </div>
    </div>
  {/if}
</div>

<style>
  .sequence-search {
    position: relative;
    width: 100%;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    pointer-events: none;
  }

  .loading-icon {
    position: absolute;
    right: 14px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }

  .search-input {
    width: 100%;
    height: 42px;
    padding: 0 40px;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: white;
    font-size: 14px;
    transition: all 0.15s;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .search-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-results {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    right: 0;
    background: rgba(18, 18, 28, 0.98);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    overflow: hidden;
    z-index: 100;
    max-height: 280px;
    overflow-y: auto;
  }

  .result-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: all 0.1s;
    text-align: left;
  }

  .result-item:last-child {
    border-bottom: none;
  }

  .result-item:hover,
  .result-item.highlighted {
    background: rgba(99, 102, 241, 0.15);
  }

  .result-thumb,
  .result-thumb-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .result-thumb {
    object-fit: cover;
  }

  .result-thumb-placeholder {
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
  }

  .result-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .result-word {
    font-weight: 600;
    font-size: 14px;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-owner {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .result-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    font-size: 11px;
    font-family: inherit;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
  }

  .no-results {
    padding: 24px 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .no-results i {
    font-size: 20px;
    opacity: 0.5;
  }
</style>
