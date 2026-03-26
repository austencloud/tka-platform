<script lang="ts">
  import type { ElementalTheme } from "../domain/elemental-theme";

  interface Props {
    theme: ElementalTheme;
    ratioCount: number;
    sequenceCount: number;
    onSelect: () => void;
  }

  const { theme, ratioCount, sequenceCount, onSelect }: Props = $props();

  const familyName = $derived(
    theme.familyId
      .split("-")
      .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
      .join(" "),
  );
</script>

<button
  type="button"
  class="vtg-family-card"
  style="--accent: {theme.accentColor};"
  aria-label="Open {familyName} family"
  onclick={onSelect}
>
  <div class="icon-area">
    <img
      src={theme.svgPath}
      alt="{theme.element} element"
      class="element-icon"
      width="48"
      height="48"
    />
  </div>

  <span class="family-name">{familyName}</span>
  <span class="element-label">{theme.element}</span>

  <div class="footer">
    <span class="stat">{sequenceCount} sequences</span>
  </div>
</button>

<style>
  .vtg-family-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 18px 16px 14px;
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

  .vtg-family-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 30%, transparent);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .vtg-family-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .vtg-family-card {
      transition: none;
    }

    .vtg-family-card:hover {
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
    width: 48px;
    height: 48px;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
  }

  .family-name {
    font-size: 17px;
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
</style>
