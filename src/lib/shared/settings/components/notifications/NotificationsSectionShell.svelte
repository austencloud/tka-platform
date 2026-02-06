<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    eyebrow: string;
    children?: Snippet;
  }

  let { title, eyebrow, children }: Props = $props();
</script>

<div class="panel">
  <div class="section-header">
    <div>
      <p class="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
    </div>
  </div>
  {@render children?.()}
</div>

<style>
  .panel {
    background: linear-gradient(
      145deg,
      var(--theme-panel-bg),
      var(--theme-panel-elevated-bg)
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    padding: 16px;
    box-shadow: var(--theme-panel-shadow, 0 12px 28px rgba(0, 0, 0, 0.35));
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .eyebrow {
    margin: 0;
    font-size: var(--font-size-compact);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  h3 {
    margin: 4px 0 0;
    font-size: var(--font-size-lg);
    color: var(--theme-text);
  }

  @media (max-width: 640px) {
    .panel {
      padding: 14px;
    }
  }
</style>
