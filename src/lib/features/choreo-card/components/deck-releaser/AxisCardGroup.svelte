<script lang="ts">
  /**
   * AxisCardGroup — a labelled group of multi-select gradient cards, matching the
   * TnD-family card aesthetic. Used for the Start-Orientation and Grid-mode axes
   * (and any future toggle axis) so they read as "fancy" as the families/turns.
   */
  interface AxisOption {
    id: string;
    label: string;
    /** Font Awesome class, e.g. "fa-diamond". */
    icon: string;
    /** Optional accent color; defaults to the theme accent. */
    accent?: string;
    /** Optional sub-line, e.g. a card count or short descriptor. */
    sub?: string;
  }

  interface Props {
    label: string;
    hint?: string;
    options: AxisOption[];
    selected: Set<string>;
    onToggle: (id: string) => void;
  }

  const { label, hint, options, selected, onToggle }: Props = $props();
</script>

<div class="axis-group">
  <span class="axis-label">{label}</span>
  {#if hint}<span class="axis-hint">{hint}</span>{/if}
  <div class="axis-cards" style="--cols: {options.length}">
    {#each options as opt (opt.id)}
      <button
        type="button"
        class="axis-card"
        class:selected={selected.has(opt.id)}
        aria-pressed={selected.has(opt.id)}
        style="--accent: {opt.accent ?? 'var(--theme-accent, #8b5cf6)'};"
        onclick={() => onToggle(opt.id)}
      >
        <i class="fas {opt.icon} axis-icon" aria-hidden="true"></i>
        <span class="axis-card-label">{opt.label}</span>
        {#if opt.sub}<span class="axis-card-sub">{opt.sub}</span>{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .axis-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .axis-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .axis-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    line-height: 1.3;
  }

  .axis-cards {
    display: grid;
    grid-template-columns: repeat(var(--cols, 3), 1fr);
    gap: 10px;
  }

  .axis-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 84px;
    padding: 14px 10px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04))),
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border: 1.5px solid color-mix(in srgb, var(--accent) 28%, transparent);
    border-radius: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    cursor: pointer;
    transition:
      transform var(--transition-spring),
      box-shadow var(--transition-fast),
      border-color var(--transition-fast),
      background var(--transition-fast),
      color var(--transition-fast);
  }

  .axis-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .axis-card.selected {
    transform: translateY(-1px) scale(1.01);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 24%, var(--theme-card-bg, rgba(255, 255, 255, 0.04))),
      color-mix(in srgb, var(--accent) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)))
    );
    border-color: color-mix(in srgb, var(--accent) 70%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--theme-text, #fff);
  }

  .axis-card:active {
    transform: scale(0.98);
  }

  .axis-icon {
    font-size: 22px;
    color: var(--accent);
    opacity: 0.6;
    transition: opacity var(--transition-fast);
  }

  .axis-card:hover .axis-icon,
  .axis-card.selected .axis-icon {
    opacity: 1;
  }

  .axis-card-label {
    font-size: 14px;
    font-weight: 700;
  }

  .axis-card-sub {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .axis-card {
      transition: none;
    }
    .axis-card:hover {
      transform: none;
    }
  }
</style>
