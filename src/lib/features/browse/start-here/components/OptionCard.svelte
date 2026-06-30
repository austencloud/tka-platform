<!--
  OptionCard — one large, clearly-clickable decision card (icon + title +
  description + accent). Used for the Base-vs-LOOP first decision and the LOOP
  type list. New primitive: the reuse sweep found no big illustrated 2-option
  card (SegmentedControl/FilterChipBase/PanelButton/PanelGrid all checked).
  It's a real <button> (clickables-look-like-buttons), 44px+ target, hover state.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description: string;
    accentColor?: string;
    iconPath?: string;
    recommended?: boolean;
    onclick: () => void;
    /** Optional custom visual (overrides iconPath image). */
    icon?: Snippet;
  }

  let {
    title,
    description,
    accentColor = "var(--theme-accent, #6aa0ff)",
    iconPath,
    recommended = false,
    onclick,
    icon,
  }: Props = $props();
</script>

<button class="option-card" style="--accent: {accentColor}" {onclick} type="button">
  {#if recommended}
    <span class="badge">Start here</span>
  {/if}
  <span class="art">
    {#if icon}
      {@render icon()}
    {:else if iconPath}
      <img src={iconPath} alt="" width="72" height="72" loading="eager" />
    {/if}
  </span>
  <span class="title">{title}</span>
  <span class="desc">{description}</span>
</button>

<style>
  .option-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 220px;
    padding: 1.75rem 1.25rem;
    border-radius: var(--radius-lg, 18px);
    border: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, var(--theme-surface, #11151f));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    text-align: center;
    transition: border-color 160ms ease, transform 160ms ease,
      background-color 160ms ease;
  }
  .option-card:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, var(--theme-surface, #11151f));
    transform: translateY(-2px);
  }
  .option-card:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .art {
    display: grid;
    place-items: center;
    height: 80px;
  }
  .art img { object-fit: contain; }
  .title { font-size: 1.35rem; font-weight: 700; }
  .desc {
    font-size: 0.95rem;
    line-height: 1.4;
    color: var(--theme-text-muted, #9aa6b8);
    max-width: 28ch;
  }
  .badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: var(--accent);
    color: #0b0e16;
  }
  @media (prefers-reduced-motion: reduce) {
    .option-card { transition: none; }
    .option-card:hover { transform: none; }
  }
</style>
