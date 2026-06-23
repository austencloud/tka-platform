<script lang="ts">
  /**
   * Book preview — the guide as an actual flip-book. Two editions side by side,
   * Old v0.5 (left) and the live rebuild (right), each a StPageFlip book with
   * realistic page-turn + corner fold and InDesign-style facing-page spreads.
   * Flipping one turns the other to the same page (synced).
   *
   * SPIKE scope: proves StPageFlip drives LIVE GuidePage DOM (right) — no
   * rasterizing — alongside pdf.js canvases (left). Full front-matter parity
   * with the print route comes after this is greenlit.
   */
  import { onMount } from "svelte";
  import "../_styles/guide.css";
  import "../_styles/guide-print.css";
  import { setGuidePrintMode } from "../_data/guide-data-context";
  import GuideCover from "../_components/GuideCover.svelte";
  import GuidePage from "../_components/GuidePage.svelte";
  import GuideTOC from "../_components/GuideTOC.svelte";
  import PagePlaceholder from "../_components/PagePlaceholder.svelte";
  import { GUIDE_BODY_PAGES } from "../_data/guide-manifest";

  setGuidePrintMode();

  // One flip page = the guide page (8.5×11) scaled down to fit two books across.
  const FLIP_W = 400;
  const FLIP_H = Math.round((FLIP_W * 11) / 8.5); // 518, Letter ratio
  const SCALE = FLIP_W / 816; // 816px = 8.5in (GuidePage native width)
  const OLD_PDF = "/guides/_proof/level-1-v05.pdf";

  let newContainer: HTMLDivElement;
  let oldContainer: HTMLDivElement;
  let syncing = false;
  let status = $state("loading…");

  function sync(from: any, to: any, idx: number) {
    if (syncing || !to) return;
    syncing = true;
    const max = to.getPageCount() - 1;
    to.turnToPage(Math.max(0, Math.min(idx, max)));
    requestAnimationFrame(() => (syncing = false));
  }

  onMount(async () => {
    const { PageFlip } = await import("page-flip/dist/js/page-flip.module.js");
    const cfg = {
      width: FLIP_W,
      height: FLIP_H,
      size: "fixed" as const,
      showCover: true,
      drawShadow: true,
      maxShadowOpacity: 0.5,
      flippingTime: 600,
      usePortrait: false,
      mobileScrollSupport: false,
    };

    // RIGHT — live rebuild: GuidePage DOM is already in the page; just bind it.
    const pfNew = new PageFlip(newContainer, cfg);
    pfNew.loadFromHTML(newContainer.querySelectorAll(".page"));

    // LEFT — old proof: render each PDF page to a canvas inside a .page div.
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const dpr = window.devicePixelRatio || 1;
    const doc = await pdfjs.getDocument({ url: OLD_PDF }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (FLIP_W / base.width) * dpr });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = `${FLIP_W}px`;
      canvas.style.height = `${FLIP_H}px`;
      const cell = document.createElement("div");
      cell.className = "page";
      cell.appendChild(canvas);
      oldContainer.appendChild(cell);
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    }
    const pfOld = new PageFlip(oldContainer, cfg);
    pfOld.loadFromHTML(oldContainer.querySelectorAll(".page"));

    pfNew.on("flip", (e: any) => sync(pfNew, pfOld, e.data));
    pfOld.on("flip", (e: any) => sync(pfOld, pfNew, e.data));
    status = `old ${pfOld.getPageCount()}p · new ${pfNew.getPageCount()}p`;
  });
</script>

<svelte:head><title>Guide Book — Level 1</title></svelte:head>

<div class="wrap">
  <div class="bar">
    <span class="t">Book preview — drag a corner to flip · both editions turn together</span>
    <span class="status">{status}</span>
  </div>

  <div class="books">
    <div class="book-col">
      <div class="cap">Old — v0.5</div>
      <div class="flip" bind:this={oldContainer}></div>
    </div>
    <div class="book-col">
      <div class="cap">New — rebuild</div>
      <!-- Live rebuild pages: each .page holds a real GuidePage scaled to FLIP_W. -->
      <div class="flip" bind:this={newContainer} style="--s:{SCALE}">
        <div class="page">
          <div class="scale"><div class="pg"><GuideCover theme="navy" /></div></div>
        </div>
        <div class="page">
          <div class="scale"><div class="pg"><GuidePage title="Table of Contents"><GuideTOC /></GuidePage></div></div>
        </div>
        {#each GUIDE_BODY_PAGES as entry, i}
          <div class="page">
            <div class="scale">
              <div class="pg"><GuidePage title={entry.title} pageNumber={i + 1}><PagePlaceholder /></GuidePage></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .wrap { height: 100vh; display: flex; flex-direction: column; background: #15151c; color: #eaeaf2; font-family: system-ui, sans-serif; overflow: hidden; }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #2c2c38; flex: 0 0 auto; }
  .t { font-size: 13px; color: #cfcfe0; }
  .status { font-size: 12px; color: #8a8aa0; }
  .books { flex: 1 1 auto; min-height: 0; display: flex; gap: 28px; align-items: center; justify-content: center; padding: 24px; }
  .book-col { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .cap { font-size: 12px; color: #9a9ab0; }
  /* StPageFlip mounts here; the .page children become flip pages. */
  .flip { background: transparent; }
  .flip :global(.page) { background: #fff; overflow: hidden; box-sizing: border-box; }
  /* Scale a native 8.5×11 GuidePage (816px) down into the flip page box. */
  .scale { width: 816px; height: 1056px; transform: scale(var(--s)); transform-origin: top left; }
  .pg :global(.guide-page) { margin: 0; box-shadow: none; }
</style>
