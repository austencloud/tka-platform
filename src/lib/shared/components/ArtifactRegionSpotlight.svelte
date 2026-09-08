<script lang="ts">
  let {
    x,
    y,
    width,
    height,
    radius = "0.65rem",
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: string;
  } = $props();
</script>

<div
  class="artifact-region-spotlight"
  style:left={`${x}%`}
  style:top={`${y}%`}
  style:width={`${width}%`}
  style:height={`${height}%`}
  style:--spotlight-radius={radius}
></div>

<style>
  .artifact-region-spotlight {
    position: absolute;
    border-radius: var(--spotlight-radius);
    outline: 2px solid var(--theme-text, white);
    outline-offset: -2px;
    box-shadow:
      0 0 0 200vmax color-mix(in srgb, black 56%, transparent),
      0 0 1.5rem color-mix(in srgb, var(--theme-text, white) 18%, transparent);
    pointer-events: none;
    transition:
      left var(--transition-emphasis),
      top var(--transition-emphasis),
      width var(--transition-emphasis),
      height var(--transition-emphasis),
      border-radius var(--transition-emphasis);
    will-change: left, top, width, height;
  }

  @media (prefers-reduced-motion: reduce) {
    .artifact-region-spotlight {
      transition: none;
    }
  }
</style>
