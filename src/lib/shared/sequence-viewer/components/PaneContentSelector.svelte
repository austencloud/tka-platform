<script lang="ts">
  import type { ContentType } from '../services/viewer-state-persistence';

  interface Props {
    current: ContentType;
    onSelect: (content: ContentType) => void;
  }

  let { current, onSelect }: Props = $props();

  let open = $state(false);

  const options: { id: ContentType; icon: string; label: string }[] = [
    { id: 'animation', icon: 'fa-play', label: '2D Animation' },
    { id: 'animation-3d', icon: 'fa-cube', label: '3D Animation' },
    { id: 'card', icon: 'fa-grip', label: 'Card' },
    { id: 'mandala', icon: 'fa-dharmachakra', label: 'Mandala' },
  ];

  const currentOption = $derived(options.find(o => o.id === current)!);

  function handleSelect(id: ContentType) {
    open = false;
    if (id !== current) onSelect(id);
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.pane-selector')) {
      open = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class="pane-selector">
  <button
    type="button"
    class="selector-chip"
    aria-expanded={open}
    aria-haspopup="listbox"
    onclick={() => { open = !open; }}
  >
    <i class="fas {currentOption.icon}" aria-hidden="true"></i>
    <span class="selector-label">{currentOption.label}</span>
    <i class="fas fa-chevron-down selector-chevron" class:open aria-hidden="true"></i>
  </button>

  {#if open}
    <div class="selector-dropdown" role="listbox" aria-label="Content type">
      {#each options as option (option.id)}
        <button
          type="button"
          class="selector-option"
          class:active={option.id === current}
          role="option"
          aria-selected={option.id === current}
          onclick={() => handleSelect(option.id)}
        >
          <i class="fas {option.icon}" aria-hidden="true"></i>
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pane-selector {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
  }

  .selector-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.85);
    font-size: var(--font-size-xs, 11px);
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .selector-chip:hover {
    background: rgba(0, 0, 0, 0.75);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .selector-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .selector-chip i:first-child {
    font-size: 10px;
  }

  .selector-chevron {
    font-size: 8px;
    transition: transform 150ms ease;
  }

  .selector-chevron.open {
    transform: rotate(180deg);
  }

  .selector-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 140px;
    background: rgba(18, 18, 28, 0.98);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }

  .selector-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--font-size-sm, 13px);
    cursor: pointer;
    transition: background 100ms ease;
  }

  .selector-option:hover {
    background: rgba(255, 255, 255, 0.06);
    color: white;
  }

  .selector-option.active {
    color: var(--theme-accent, #6366f1);
    font-weight: 600;
  }

  .selector-option:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .selector-option i {
    font-size: 12px;
    width: 16px;
    text-align: center;
  }
</style>
