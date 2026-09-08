<script lang="ts">
  /**
   * One of K's sticky notes, as it reads in the panel. Yellow paper, marker
   * text, a slight lean. The era tag is a hint for Austen's pass, not fiction.
   */
  interface Props {
    text: string;
    era?: "early" | "settled" | "established" | "final";
    /** Rotation in degrees; alternate the sign between stacked notes. */
    lean?: number;
  }

  let { text, era, lean = -1.5 }: Props = $props();
</script>

<aside class="sticky" style:--lean="{lean}deg" aria-label="Annotation">
  <p class="sticky-text">{text}</p>
  {#if era}
    <span class="sticky-era">{era}</span>
  {/if}
</aside>

<style>
  .sticky {
    position: relative;
    padding: 14px 16px 12px;
    background: #f3dd6d;
    color: #1a1408;
    transform: rotate(var(--lean, -1.5deg));
    box-shadow: 2px 4px 10px rgba(0, 0, 0, 0.35);
    border-top: 10px solid rgba(210, 180, 70, 0.6);
    max-width: 100%;
  }

  .sticky-text {
    margin: 0;
    font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
    font-size: var(--font-size-min, 14px);
    line-height: 1.45;
    white-space: pre-line;
  }

  .sticky-era {
    position: absolute;
    right: 8px;
    bottom: 4px;
    font-family: monospace;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(26, 20, 8, 0.4);
  }
</style>
