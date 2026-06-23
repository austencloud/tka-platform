<script lang="ts">
  /**
   * Book preview — the guide as an actual flip-book. Two editions side by side,
   * Old v0.5 (left) and the live rebuild (right), each a StPageFlip book with
   * realistic page-turn + corner fold and InDesign-style facing-page spreads.
   * Flipping one turns the other to the same page (synced).
   *
   * The new edition renders the shared GuideDocument (same page sequence as the
   * print route, so the two editions stay in lockstep) as live GuidePage DOM —
   * StPageFlip drives it directly, no rasterizing. The old edition is the v0.5
   * proof rendered to canvases via pdf.js.
   */
  import { onMount, tick } from "svelte";
  import "../_styles/guide.css";
  import "../_styles/guide-print.css";
  import { setGuidePrintMode } from "../_data/guide-data-context";
  import GuidePage from "../_components/GuidePage.svelte";
  import GuideDocument from "../_components/GuideDocument.svelte";
  import type { GuidePageMeta } from "../_data/guide-manifest";

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
  // The flip-books render client-only: SSR keeps the route's URL valid (so the
  // app-shell module-state guard doesn't rewrite /book → /create), but the
  // scaled GuidePage/GuideCover subtree is never hydrated (it threw "Illegal
  // invocation" on hydrate), so we mount it fresh on the client instead.
  let mounted = $state(false);
  // Books stay hidden until both StPageFlip instances are built, so the user
  // never sees the raw page stack (esp. the old book's 47 pdf canvases) scroll
  // past before it collapses into a book.
  let ready = $state(false);

  const FLIP_MS = 600;
  function sync(from: any, to: any, idx: number) {
    if (syncing || !to) return;
    syncing = true;
    const max = to.getPageCount() - 1;
    // flip() ANIMATES the other book to the same page (turnToPage would jump);
    // hold the guard past the animation so the echoed flip event doesn't bounce.
    to.flip(Math.max(0, Math.min(idx, max)));
    setTimeout(() => (syncing = false), FLIP_MS + 60);
  }

  onMount(async () => {
    // Render the book DOM client-side first, then wire StPageFlip to it.
    mounted = true;
    await tick();
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
    // Build all pages OFF-DOM so the growing stack never paints; attach + init
    // in one synchronous step so StPageFlip collapses it before the next frame.
    const frag = document.createDocumentFragment();
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
      frag.appendChild(cell);
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    }
    oldContainer.appendChild(frag);
    const pfOld = new PageFlip(oldContainer, cfg);
    pfOld.loadFromHTML(oldContainer.querySelectorAll(".page"));

    pfNew.on("flip", (e: any) => sync(pfNew, pfOld, e.data));
    pfOld.on("flip", (e: any) => sync(pfOld, pfNew, e.data));
    status = `old ${pfOld.getPageCount()}p · new ${pfNew.getPageCount()}p`;
    ready = true; // both books built — reveal them

    // Dev handle so the two books can be driven page-by-page from DevTools while
    // aligning their contents. goto(n) turns BOTH to the same index.
    if (import.meta.env.DEV) {
      (window as any).__books = {
        old: pfOld,
        new: pfNew,
        goto(n: number) {
          syncing = true;
          pfOld.turnToPage(Math.min(n, pfOld.getPageCount() - 1));
          pfNew.turnToPage(Math.min(n, pfNew.getPageCount() - 1));
          requestAnimationFrame(() => (syncing = false));
        },
      };
    }
  });
</script>

<svelte:head><title>Guide Book — Level 1</title></svelte:head>

<!-- Wrap each shared-document page as a scaled flip page (native 8.5×11 GuidePage
     inside a .scale transform, clipped to the flip .page box). -->
{#snippet bookPage({ title, pageNumber, fullBleed, content }: GuidePageMeta)}
  <div class="page">
    <div class="scale">
      <div class="pg">
        <GuidePage {title} {pageNumber} {fullBleed}>{@render content()}</GuidePage>
      </div>
    </div>
  </div>
{/snippet}

<div class="wrap">
  <div class="bar">
    <span class="t">Book preview — drag a corner to flip · both editions turn together</span>
    <span class="status">{status}</span>
  </div>

  <div class="books" class:ready>
    {#if mounted}
      <div class="book-col">
        <div class="cap">Old — v0.5</div>
        <div class="flip" bind:this={oldContainer}></div>
      </div>
      <div class="book-col">
        <div class="cap">New — rebuild</div>
        <!-- Live rebuild pages: shared GuideDocument, each page a real GuidePage
             scaled into a flip .page. Same sequence as /print. -->
        <div class="flip" bind:this={newContainer} style="--s:{SCALE}">
          <GuideDocument coverTheme="navy" page={bookPage} />
        </div>
      </div>
    {/if}
    {#if !ready}<div class="building">Building book…</div>{/if}
  </div>
</div>

<style>
  .wrap { height: 100vh; display: flex; flex-direction: column; background: #15151c; color: #eaeaf2; font-family: system-ui, sans-serif; overflow: hidden; }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #2c2c38; flex: 0 0 auto; }
  .t { font-size: 13px; color: #cfcfe0; }
  .status { font-size: 12px; color: #8a8aa0; }
  .books { position: relative; flex: 1 1 auto; min-height: 0; display: flex; gap: 28px; align-items: center; justify-content: center; padding: 24px; }
  /* Hidden until both StPageFlip books are built, so the raw page stack never
     flashes; fade in together once ready. */
  .book-col { display: flex; flex-direction: column; align-items: center; gap: 10px; opacity: 0; transition: opacity 0.35s ease; }
  .books.ready .book-col { opacity: 1; }
  .building { position: absolute; inset: 0; display: grid; place-items: center; font-size: 13px; color: #8a8aa0; pointer-events: none; }
  .cap { font-size: 12px; color: #9a9ab0; }
  /* StPageFlip mounts here; the .page children become flip pages. */
  .flip { background: transparent; }
  .flip :global(.page) { background: #fff; overflow: hidden; box-sizing: border-box; }
  /* Scale a native 8.5×11 GuidePage (816px) down into the flip page box. */
  .scale { width: 816px; height: 1056px; transform: scale(var(--s)); transform-origin: top left; }
  .pg :global(.guide-page) { margin: 0; box-shadow: none; }
</style>
