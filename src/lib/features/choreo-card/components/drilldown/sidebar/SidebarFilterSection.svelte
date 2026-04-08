<script lang="ts">
  import type { Snippet } from 'svelte';

  type SectionState = 'active' | 'selected' | 'disabled';

  interface Props {
    label: string;
    state: SectionState;
    accentColor?: string;
    disabledMessage?: string;
    children: Snippet;
  }

  let {
    label,
    state,
    accentColor = '#63b7cd',
    disabledMessage = '',
    children,
  }: Props = $props();
</script>

<div
  class="filter-section"
  class:active={state === 'active' || state === 'selected'}
  class:disabled={state === 'disabled'}
  style="--sf-accent: {accentColor}"
>
  <div class="section-label">{label}</div>
  {#if state === 'disabled'}
    <div class="disabled-msg">{disabledMessage}</div>
  {:else}
    {@render children()}
  {/if}
</div>

<style>
  .filter-section {
    padding: 14px 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 0.15s ease, opacity 0.15s ease;
  }

  .filter-section.active {
    border-color: rgba(var(--sf-accent-rgb, 99,183,205), 0.25);
    background: rgba(var(--sf-accent-rgb, 99,183,205), 0.03);
  }

  .filter-section.disabled {
    opacity: 0.3;
    border-style: dashed;
  }

  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.45;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .disabled-msg {
    font-size: 12px;
    opacity: 0.5;
    padding: 4px 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-section { transition: none; }
  }
</style>
