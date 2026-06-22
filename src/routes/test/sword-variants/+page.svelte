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
      note: "Today's asset — flat gray hardware, flat gold blade. Reference.",
      file: "/images/props/sword.svg",
    },
    {
      id: "knight",
      label: "Knight (new geometry)",
      note: "Tapered double-edge blade to a point, tall flared cross-guard, ringed grip, disc pommel.",
      file: "/images/props/variants/sword-knight.svg",
    },
    {
      id: "saber",
      label: "Saber (new geometry)",
      note: "Curved single-edge kevlar wick, tall oval tsuba, diamond-wrapped grip, angled kashira cap.",
      file: "/images/props/variants/sword-saber.svg",
    },
    {
      id: "flamberge",
      label: "Flamberge (new geometry)",
      note: "Undulating flame-wave blade (reads as fire even small), swept lens guard, teardrop pommel.",
      file: "/images/props/variants/sword-flamberge.svg",
    },
    {
      id: "claymore",
      label: "Claymore (new geometry)",
      note: "Massive straight blade, forward-sloping quillons with ring terminals, wheel pommel.",
      file: "/images/props/variants/sword-claymore.svg",
    },
    {
      id: "khopesh",
      label: "Khopesh (new geometry)",
      note: "Straight base hooking into a forward sickle. Unmistakable silhouette.",
      file: "/images/props/variants/sword-khopesh.svg",
    },
  ];

  // Sword is in the selective-color list — match the real prop pipeline.
  const selective = (SELECTIVE_COLOR_PROP_TYPES as readonly string[]).includes(
    "sword"
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
    <h1>Sword variants</h1>
    <p>
      Each row rendered through the real <code>applyMotionColorToSvg</code>
      pipeline (selective mode = {String(selective)}). Blue / Red show the
      recolored hand-color region; the gold wick + metallic sheen are preserved.
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
    max-height: 90px;
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
