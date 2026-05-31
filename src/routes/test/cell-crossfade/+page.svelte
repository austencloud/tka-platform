<script lang="ts">
  // Isolated harness for the CellRenderer crossfade — lets us reproduce and
  // verify the step-number-vs-image transition behaviour without driving the
  // whole sequence viewer. Replays the EXACT orchestration from
  // ChoreoCard.crossfadeCellImages (set cells → 2×rAF paint gap → beginCrossfade
  // → scheduleCrossfadeEnd) against the real CellRenderer + crossfader state.
  //
  // The "images" are deliberately NON-pictograph test cards (OLD=red / NEW=blue,
  // one with an extra diamond so the crossfade is unmistakable). They only exist
  // to make the opacity transition visible; they are not TKA renders.
  import CellRenderer from "$lib/shared/sequence-viewer/components/CellRenderer.svelte";
  import { createCrossfaderState } from "$lib/shared/choreo-card/state/crossfader-state.svelte";
  import { compositeStepNumberOnBlob } from "$lib/shared/sequence-viewer/services/step-number-compositor";

  // Self-test the REAL compositor: composite "7" onto a number-free base blob,
  // then read back pixels in the top-left number region. Dark pixels there prove
  // the helper baked the number.
  let compositorTest = $state("running…");
  $effect(() => {
    (async () => {
      try {
        // Raster base (WebP), matching the real pipeline's worker-rendered blobs
        // (the compositor decodes via createImageBitmap, which doesn't do SVG).
        const bc = document.createElement("canvas");
        bc.width = 240; bc.height = 240;
        const bx = bc.getContext("2d")!;
        bx.fillStyle = "#ffffff";
        bx.fillRect(0, 0, 240, 240);
        const baseBlob = await new Promise<Blob>((res, rej) => bc.toBlob((b) => b ? res(b) : rej(new Error("base toBlob failed")), "image/webp"));
        const out = await compositeStepNumberOnBlob(baseBlob, 7, 240, false, 1);
        const bmp = await createImageBitmap(out);
        const c = document.createElement("canvas");
        c.width = 240; c.height = 240;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        // number sits near top-left (~13..40px). Count dark pixels there.
        const data = ctx.getImageData(10, 10, 40, 40).data;
        let dark = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i]! < 100 && data[i + 3]! > 100) dark++;
        compositorTest = dark > 20 ? `PASS — ${dark} dark px in number region` : `FAIL — only ${dark} dark px`;
      } catch (e) {
        compositorTest = `ERROR — ${e instanceof Error ? e.message : String(e)}`;
      }
    })();
  });

  function card(bg: string, label: string, withDiamond: boolean): string {
    const diamond = withDiamond
      ? `<polygon points='120,30 210,120 120,210 30,120' fill='none' stroke='#000' stroke-width='6'/>`
      : "";
    // The step number is now BAKED into the image (top-left), mimicking the
    // step-number-compositor, so the harness reflects the new behaviour: the
    // number is part of the image and must dissolve in lockstep with it.
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>` +
      `<rect width='240' height='240' fill='${bg}'/>` +
      diamond +
      `<circle cx='120' cy='120' r='34' fill='#fff' stroke='#000' stroke-width='4'/>` +
      `<text x='13' y='13' font-size='25' font-family='Georgia, serif' font-weight='bold' fill='#231f20' dominant-baseline='hanging'>1</text>` +
      `<text x='120' y='234' font-size='14' text-anchor='middle' fill='#000'>${label}</text>` +
      `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const imgA = card("#f7b2b2", "OLD (with diamond)", true);
  const imgB = card("#b2c8f7", "NEW (no diamond)", false);

  let darkMode = $state(false);
  let slowMo = $state(true);
  const crossfader = createCrossfaderState(() => darkMode);
  const crossfadeActive = $derived(crossfader.crossfadeActive);
  const activeDarkMode = $derived(crossfader.activeDarkMode);

  let useA = true;

  interface Cell {
    index: number;
    label: string;
    imageUrl: string;
    isLoaded: boolean;
    gridColumn: number;
    gridRow: number;
    duration: number;
    fadeOutUrl?: string;
  }

  let cell = $state<Cell>({
    index: 0,
    label: "1",
    imageUrl: imgA,
    isLoaded: true,
    gridColumn: 1,
    gridRow: 1,
    duration: 1,
    fadeOutUrl: undefined,
  });

  let lastEvent = $state("idle");

  async function trigger(mode: "crossfade" | "swap") {
    const next = useA ? imgB : imgA;
    useA = !useA;
    lastEvent = `${mode}: set cells`;

    // Step 1 — batch swap (old→fadeOutUrl, new→imageUrl), crossfadeActive still false
    cell = { ...cell, fadeOutUrl: cell.imageUrl, imageUrl: next };

    // Step 2 — 2×rAF so the browser paints old@1 / new@0 before the transition
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    // Step 3 — flip crossfadeActive → CSS opacity transitions run
    lastEvent = `${mode}: crossfadeActive=true`;
    crossfader.beginCrossfade(darkMode, mode);

    // Step 4 — clear fadeOutUrl after the transition window. Extended so the
    // slow-mo CSS override below has time to finish before cleanup.
    crossfader.scheduleCrossfadeEnd(() => {
      cell = { ...cell, fadeOutUrl: undefined };
      lastEvent = `${mode}: done`;
    }, slowMo ? 3000 : 400);
  }
</script>

<svelte:head><title>Cell Crossfade Harness</title></svelte:head>

<div class="harness">
  <h1>CellRenderer crossfade harness</h1>
  <p class="hint">
    Watch the step number ("1", top-left) vs the diamond as you trigger a
    transition. Crossfade = old & new fade simultaneously. Swap = old out, gap,
    new in.
  </p>

  <div class="stage" class:dark={darkMode}>
    <div class="cell-box" class:slow={slowMo}>
      <CellRenderer
        {cell}
        showDurBadge={false}
        showStepNumbers={true}
        {activeDarkMode}
        {crossfadeActive}
        transitionMode={crossfader.transitionMode}
        isBrowseSoloMode={false}
        isMotionSoloMode={false}
        soloColor={undefined}
        stepNumFontSize={28}
        hasMixedDurations={false}
        formatDuration={(d) => String(d)}
        getMotionSoloMotion={() => undefined}
        formatSoloTurns={() => ""}
        shortOrientation={() => null}
      />
    </div>
  </div>

  <div class="controls">
    <button onclick={() => trigger("crossfade")}>Crossfade</button>
    <button onclick={() => trigger("swap")}>Swap</button>
    <button onclick={() => (darkMode = !darkMode)}>Dark mode: {darkMode ? "on" : "off"}</button>
    <button onclick={() => (slowMo = !slowMo)}>Slow-mo: {slowMo ? "on (2.5s)" : "off"}</button>
  </div>

  <p class="status">state: <code>{lastEvent}</code> · crossfadeActive: <code>{crossfadeActive}</code> · mode: <code>{crossfader.transitionMode}</code></p>
  <p class="status">compositor self-test: <code data-testid="compositor-test">{compositorTest}</code></p>
</div>

<style>
  .harness {
    padding: 24px;
    font-family: system-ui, sans-serif;
    color: #e0e0e0;
    background: #14151a;
    min-height: 100vh;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .hint { font-size: 13px; color: #9aa0a6; max-width: 540px; }
  .stage {
    display: inline-block;
    padding: 24px;
    border-radius: 8px;
    background: #ffffff;
    margin: 16px 0;
  }
  .stage.dark { background: #0a0a0f; }
  /* Mirrors a sequence-viewer cell: fixed square, position:relative so the
     absolutely-positioned crossfade layers + overlay anchor to it. */
  .cell-box {
    position: relative;
    width: 240px;
    height: 240px;
    overflow: hidden;
  }
  /* Slow-mo: stretch every cell/step opacity transition to 2.5s so the number's
     behaviour during the fade is obvious to the eye. Scoped to the harness. */
  .cell-box.slow :global(.cell-fade-old),
  .cell-box.slow :global(.cell-image.cell-fade-new.reveal),
  .cell-box.slow :global(.cell-image.cell-swap-new.reveal),
  .cell-box.slow :global(.cell-fade-old.swap-out),
  .cell-box.slow :global(.step-fade-old),
  .cell-box.slow :global(.step-number-overlay.step-fade-new.reveal) {
    transition-duration: 2500ms !important;
    transition-delay: 0ms !important;
  }
  .controls { display: flex; gap: 8px; flex-wrap: wrap; }
  button {
    min-height: 44px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #3a3d44;
    background: #23262d;
    color: #fff;
    font: inherit;
    cursor: pointer;
  }
  button:hover { background: #2c2f37; }
  .status { font-size: 12px; color: #9aa0a6; margin-top: 12px; }
  code { color: #a78bfa; }
</style>
