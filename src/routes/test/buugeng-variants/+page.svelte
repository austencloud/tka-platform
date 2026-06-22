<script lang="ts">
  import { onMount } from "svelte";
  import {
    applyMotionColorToSvg,
    SELECTIVE_COLOR_PROP_TYPES,
  } from "$lib/shared/utils/svg-color-utils";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  type Variant = { id: string; label: string; note: string; file: string };

  const variants: Variant[] = [
    {
      id: "current",
      label: "Current (flat)",
      note: "Today's asset — flat single-color double-S. Reference.",
      file: "/images/props/buugeng.svg",
    },
    {
      id: "gloss",
      label: "Gloss (organic)",
      note: "Current organic silhouette upgraded with a glossy top-lit sheen and a dark rim. Clean evolution of what ships now.",
      file: "/images/props/variants/buugeng-gloss.svg",
    },
    {
      id: "geo",
      label: "Geo (parametric)",
      note: "Rebuilt from true circular arcs — two half-annular crescents. Sharper, more modern ribbon, with the same gloss sheen.",
      file: "/images/props/variants/buugeng-geo.svg",
    },
    {
      id: "chrome",
      label: "Chrome spine",
      note: "Parametric ribbon with a specular centerline highlight — reads as polished rounded metal catching a light.",
      file: "/images/props/variants/buugeng-chrome.svg",
    },
    {
      id: "glow",
      label: "Glow tube (tunnel hero)",
      note: "Bright white core down the centerline over a soft halo — reads as a glowing LED ribbon. Built for the dark tunnel.",
      file: "/images/props/variants/buugeng-glow.svg",
    },
  ];

  // Buugeng is a single-color prop (not in the selective list) — whole body recolors.
  const selective = (SELECTIVE_COLOR_PROP_TYPES as readonly string[]).includes(
    "buugeng"
  );

  type Rendered = { raw: string; blue: string; red: string };
  let rendered = $state<Record<string, Rendered>>({});
  let darkBg = $state(true);

  function colorize(raw: string, color: MotionColor): string {
    return applyMotionColorToSvg(raw, color, {
      makeClassNamesUnique: true,
      themeMode: "dark",
      selectiveColorMode: selective,
    });
  }

  onMount(async () => {
    for (const v of variants) {
      const raw = await (await fetch(v.file)).text();
      rendered[v.id] = {
        raw,
        blue: colorize(raw, MotionColor.BLUE),
        red: colorize(raw, MotionColor.RED),
      };
    }
  });
</script>

<div class="page" class:light={!darkBg}>
  <header>
    <h1>Buugeng variants</h1>
    <p>
      Each row rendered through the real <code>applyMotionColorToSvg</code>
      pipeline (selective mode = {String(selective)}). Blue / Red show the
      recolored body; the sheen / spine / glow overlays are preserved across
      recolor (url() gradients + white strokes survive).
    </p>
    <button onclick={() => (darkBg = !darkBg)}>
      Toggle background: {darkBg ? "dark" : "light"}
    </button>
  </header>

  {#each variants as v (v.id)}
    {@const r = rendered[v.id]}
    <section>
      <div class="meta">
        <h2>{v.label}</h2>
        <p>{v.note}</p>
        <code>{v.file}</code>
      </div>
      {#if r}
        <div class="swatches">
          <figure>
            <div class="stage">
              {@html r.raw}
            </div>
            <figcaption>raw</figcaption>
          </figure>
          <figure>
            <div class="stage">
              {@html r.blue}
            </div>
            <figcaption>blue prop</figcaption>
          </figure>
          <figure>
            <div class="stage">
              {@html r.red}
            </div>
            <figcaption>red prop</figcaption>
          </figure>
        </div>
      {:else}
        <p class="loading">loading…</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 2rem;
    background: #15171c;
    color: #e8e8ea;
    font-family: system-ui, sans-serif;
  }
  .page.light {
    background: #e9eaee;
    color: #1a1a1c;
  }
  header {
    max-width: 70ch;
    margin-bottom: 2rem;
  }
  h1 {
    margin: 0 0 0.5rem;
  }
  header p {
    opacity: 0.8;
    line-height: 1.5;
  }
  button {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  section {
    border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    padding: 1.5rem 0;
  }
  .meta h2 {
    margin: 0 0 0.25rem;
  }
  .meta p {
    margin: 0 0 0.25rem;
    opacity: 0.75;
  }
  .meta code {
    font-size: 0.78rem;
    opacity: 0.6;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  figure {
    margin: 0;
  }
  .stage {
    border-radius: 12px;
    padding: 1.25rem;
    background: color-mix(in srgb, currentColor 6%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Render the prop SVGs at a readable size. */
  .stage :global(svg) {
    width: 100%;
    height: auto;
    max-height: 120px;
  }
  figcaption {
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.7;
    margin-top: 0.4rem;
  }
  .loading {
    opacity: 0.6;
  }
</style>
