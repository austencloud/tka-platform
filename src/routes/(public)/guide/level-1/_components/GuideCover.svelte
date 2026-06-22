<script lang="ts">
  /**
   * Level 1 guide cover — the locked design, as a reusable component.
   *
   * Hero title = Fraunces (wonky italic). "Level 1" = canonical baby-blue badge.
   * A combined emblem (Iso circle + Anti lens-rose + Dash +, overlaid) above an
   * arc trio of the same three forms (iso·dash·anti). Colors = the two prop
   * hands (blue/red), NOT motion type. Arc path. Deterministic MCP geometry, so
   * it reprints identically.
   *
   * `theme="navy"` — matte navy + gold foil, glowing line-art (digital / pro
   * print / foil edition). `theme="light"` — ivory + ink rule, dark line-art
   * (cheap home-printer edition, minimal ink).
   *
   * Mandala sizes scale to the container width, so the same component fills the
   * 540px cover-lab preview and a full 8.5×11 print page identically.
   */
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";

  let { theme = "navy" }: { theme?: "navy" | "light" } = $props();

  let w = $state(0);
  const emblemSize = $derived(w ? Math.round(w * 0.44) : 0);
  const trioSize = $derived(w ? Math.round(w * 0.185) : 0);

  function mono(s: string, f: string): MandalaPalette {
    return { blueStroke: s, blueFill: f, redStroke: s, redFill: f, purpleStroke: s, purpleFill: f };
  }
  // Bright on navy, deep ink on ivory.
  const NAVY = { iso: mono("#6f8cff", "#6f8cff10"), dash: mono("#c0a3ff", "#c0a3ff10"), anti: mono("#ff7a7a", "#ff7a7a10") };
  const LIGHT = { iso: mono("#2342c9", "#2342c910"), dash: mono("#6d28d9", "#6d28d910"), anti: mono("#c01b1b", "#c01b1b10") };
  const pal = $derived(theme === "navy" ? NAVY : LIGHT);

  const m = (mt: string, rd: string, sl: string, el: string, so: string, eo: string) =>
    ({ motionType: mt, rotationDirection: rd, startLocation: sl, endLocation: el, startOrientation: so, endOrientation: eo });
  const step = (blue: any, red: any) => ({ motions: { blue, red } });
  const seq = (steps: any[]) => ({ bluePropType: "staff", redPropType: "staff", steps });

  const ISO = seq([
    step(m("pro", "cw", "n", "e", "in", "in"), m("pro", "cw", "s", "w", "in", "in")),
    step(m("pro", "cw", "e", "s", "in", "in"), m("pro", "cw", "w", "n", "in", "in")),
    step(m("pro", "cw", "s", "w", "in", "in"), m("pro", "cw", "n", "e", "in", "in")),
    step(m("pro", "cw", "w", "n", "in", "in"), m("pro", "cw", "e", "s", "in", "in")),
  ]);
  const ANTI = seq([
    step(m("anti", "ccw", "n", "e", "in", "out"), m("anti", "ccw", "s", "w", "in", "out")),
    step(m("anti", "ccw", "e", "s", "out", "in"), m("anti", "ccw", "w", "n", "out", "in")),
    step(m("anti", "ccw", "s", "w", "in", "out"), m("anti", "ccw", "n", "e", "in", "out")),
    step(m("anti", "ccw", "w", "n", "out", "in"), m("anti", "ccw", "e", "s", "out", "in")),
  ]);
  const DASH = seq([
    step(m("dash", "noRotation", "w", "e", "in", "out"), m("dash", "noRotation", "s", "n", "in", "out")),
    step(m("dash", "noRotation", "e", "w", "out", "in"), m("dash", "noRotation", "n", "s", "out", "in")),
  ]);

  const FORMS = $derived([
    { seq: ISO, palette: pal.iso },
    { seq: DASH, palette: pal.dash },
    { seq: ANTI, palette: pal.anti },
  ]);
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,500;1,600&family=Fraunces:ital,opsz,wght@1,9..144,400..900&display=swap" rel="stylesheet" />
</svelte:head>

<div class="cover {theme}" bind:clientWidth={w}>
  <div class="frame"></div>

  <header class="hero">
    <h1 class="title"><span>The Kinetic</span><span>Alphabet</span></h1>
    <div class="lvl"><span class="lvl-word">Level</span><span class="lvl-badge">1</span></div>
  </header>

  <div class="emblem" style="--em:{emblemSize}px">
    {#each FORMS as f}
      <div class="layer">
        {#if emblemSize}<SequenceMandala sequence={f.seq} size={emblemSize} darkMode={false} palette={f.palette} bluePropType="staff" redPropType="staff" pathShape="arc" strokeWidth={3} />{/if}
      </div>
    {/each}
  </div>

  <div class="forms">
    {#each FORMS as f}
      <div class="form">
        {#if trioSize}<SequenceMandala sequence={f.seq} size={trioSize} darkMode={false} palette={f.palette} bluePropType="staff" redPropType="staff" pathShape="arc" strokeWidth={2.5} />{/if}
      </div>
    {/each}
  </div>

  <footer class="byline">Created by Austen Cloud</footer>
</div>

<style>
  .cover {
    position: relative; height: 100%; width: 100%; box-sizing: border-box;
    container-type: inline-size;
    display: flex; flex-direction: column; align-items: center;
    padding: 8% 8% 13%;
  }
  .cover.navy { background: radial-gradient(120% 120% at 50% 30%, #1d1d3a 0%, #14142b 70%, #0f0f22 100%); color: #f4f0e4; }
  .cover.light { background: #faf7ef; color: #1a1a1a; }

  /* Frame */
  .frame { position: absolute; inset: 3.3cqw; pointer-events: none; }
  .cover.navy .frame { border: 2.4px solid transparent; border-image: linear-gradient(135deg, #8a6a14 0%, #f6e3a1 25%, #c9a227 50%, #f9efc0 72%, #9a7b1f 100%) 1; }
  .cover.navy .frame::before { content: ""; position: absolute; inset: 5px; border: 1px solid #c9a22799; }
  .cover.light .frame { border: 1.4px solid #1f2937; }
  .cover.light .frame::before { content: ""; position: absolute; inset: 5px; border: 0.8px solid #1f2937; }

  /* Title — Fraunces wonky italic */
  .hero { text-align: center; }
  .title {
    font-family: "Fraunces", Georgia, serif; font-style: italic; font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 640, "SOFT" 0, "WONK" 1;
    line-height: 1.0; margin: 0; display: flex; flex-direction: column;
    font-size: clamp(32px, 12.5cqw, 88px);
  }
  /* Pure white on navy, pure black on ivory — max legibility (AAA). */
  .cover.navy .title { color: #ffffff; }
  .cover.light .title { color: #000000; }

  .lvl { margin-top: 3.5cqw; display: flex; align-items: center; justify-content: center; gap: 0.5em; }
  .lvl-word { font-family: "Cormorant Garamond", Georgia, serif; font-style: italic; font-size: clamp(15px, 4cqw, 30px); opacity: 0.85; }
  .lvl-badge {
    width: 7.2cqw; height: 7.2cqw; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at top left, rgb(224,242,254) 0%, rgb(198,232,253) 30%, rgb(164,218,250) 70%, rgb(130,202,245) 100%);
    border: 1px solid #000; color: #000;
    font-family: Cambria, Georgia, serif; font-weight: 700; line-height: 1;
    font-size: calc(7.2cqw * 0.58);
  }

  .emblem { flex: 1 1 auto; min-height: 0; position: relative; width: var(--em); aspect-ratio: 1; display: grid; place-items: center; margin: 4% 0; }
  .layer { position: absolute; inset: 0; display: grid; place-items: center; }

  .forms { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; place-items: center; gap: 3cqw; align-items: center; margin-top: 2%; }
  .forms .form:nth-child(1) { transform: translateY(3cqw) rotate(-8deg); }
  .forms .form:nth-child(2) { transform: translateY(-2cqw); }
  .forms .form:nth-child(3) { transform: translateY(3cqw) rotate(8deg); }
  .form { display: grid; place-items: center; }

  /* Byline at full strength, theme-aware, ≥7:1 contrast on its ground (AAA). */
  .byline { position: absolute; bottom: 7.5cqw; left: 0; right: 0; text-align: center; margin: 0; font-style: italic; font-family: "Cormorant Garamond", Georgia, serif; font-size: clamp(13px, 2.8cqw, 18px); opacity: 1; }
  .cover.navy .byline { color: #ece9f6; }   /* ~14:1 on #14142b */
  .cover.light .byline { color: #2a2a2a; }   /* ~12:1 on #faf7ef */
</style>
