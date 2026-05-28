<script lang="ts">
  import type { TnDElement } from "../domain/tnd-element";

  interface Props {
    theme: TnDElement;
    ratioCount: number;
    sequenceCount: number;
    onSelect: () => void;
    seeding?: boolean;
    seedProgress?: { written: number; total: number };
    disabled?: boolean;
    needsSeed?: boolean;
  }

  const {
    theme,
    ratioCount,
    sequenceCount,
    onSelect,
    seeding = false,
    seedProgress,
    disabled = false,
    needsSeed = false,
  }: Props = $props();

  const familyName = $derived(
    theme.familyId
      .split("-")
      .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
      .join(" "),
  );
</script>

<button
  type="button"
  class="tnd-family-card"
  style="--accent: {theme.accentColor};"
  aria-label="Open {familyName} family"
  aria-busy={seeding}
  {disabled}
  onclick={onSelect}
>
  <div class="icon-area">
    <img
      src={theme.iconPath}
      alt="{theme.element} element"
      class="element-icon"
      width="96"
      height="96"
    />
  </div>

  <span class="family-name">{familyName}</span>
  <span class="element-label">{theme.element}</span>

  <div class="footer">
    {#if seeding}
      <span class="stat seeding">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Seeding {seedProgress?.written ?? 0}/{seedProgress?.total ?? 0}
      </span>
    {:else if needsSeed}
      <span class="stat hint">Tap to seed</span>
    {:else}
      <span class="stat">{sequenceCount} sequences</span>
    {/if}
  </div>
</button>

<style>
  .tnd-family-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 44px 28px 32px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04))),
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border: 1.5px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: 14px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    text-align: center;
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      border-color 150ms ease;
  }

  .tnd-family-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .tnd-family-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tnd-family-card {
      transition: none;
    }

    .tnd-family-card:hover {
      transform: none;
    }
  }

  .icon-area {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2px;
  }

  .element-icon {
    width: 96px;
    height: 96px;
    object-fit: contain;
    filter: var(--shadow-drop, drop-shadow(0 2px 8px rgba(0, 0, 0, 0.35)));
  }

  .family-name {
    font-size: 24px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1.2;
  }

  .element-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }

  .stat {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }

  .tnd-family-card:disabled {
    cursor: progress;
    opacity: 0.6;
  }

  .stat.hint {
    color: var(--accent);
    font-weight: 600;
  }

  .stat.seeding {
    color: var(--accent);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
