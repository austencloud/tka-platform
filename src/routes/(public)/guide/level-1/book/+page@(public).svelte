<script lang="ts">
  /**
   * Guide compare — page-by-page proofing. The OLD v0.5 proof on the left, the
   * live rebuild on the right, ONE page per side. Step with Prev/Next (or ← →);
   * no scrolling. The editions no longer share a page count (the rebuild dropped
   * the old intro pages), so an offset nudge (±) aligns them — set once, then
   * Next advances both in lockstep.
   *
   * Left  = the frozen v0.5 PDF rendered to canvases via pdf.js (one shown).
   * Right = the live GuideDocument (same page sequence as /print), every page
   *         mounted once and shown one at a time — so it always reflects the
   *         latest page work with no rebuild step.
   *
   * The "Book" button shows the rebuild in actual flip-book form (single book).
   */
  import { onMount, tick } from "svelte";
  import "../_styles/guide.css";
  import "../_styles/guide-print.css";
  import { setGuidePrintMode } from "../_data/guide-data-context";
  import GuidePage from "../_components/GuidePage.svelte";
  import GuideDocument from "../_components/GuideDocument.svelte";
  import type { GuidePageMeta } from "../_data/guide-manifest";
  import { BUILT } from "../_data/built-pages";
  import { loadOverrides } from "../_data/guide-overrides.svelte";

  setGuidePrintMode();

  // The override IS the guide — the rebuild pane reflects saved edits too.
  onMount(() => {
    loadOverrides();
  });

  const OLD_PDF = "/guides/_proof/level-1-v05.pdf";
  const PAGE_W = 816; // 8.5in @96dpi (GuidePage native width)
  const PAGE_H = 1056; // 11in

  let mode = $state<"compare" | "flip">("compare");
  // Active NEW-page index (0-based). Front matter is cover/drink/support/readme/
  // toc (5), so 5 = the first body page (The Grid) — open there, already aligned.
  let idx = $state(5);
  let offset = $state(1); // old index = new index + offset (front-matter delta)
  let newCount = $state(0);
  let oldCount = $state(0);
  let scale = $state(0.5);

  let newWrap = $state<HTMLDivElement>();
  let leftWrap = $state<HTMLDivElement>();
  let paneEl = $state<HTMLDivElement>();
  let flipOpened = $state(false);

  function fit() {
    if (!paneEl) return;
    const w = paneEl.clientWidth - 24;
    const h = paneEl.clientHeight - 44; // minus caption + padding
    scale = Math.max(0.1, Math.min(w / PAGE_W, h / PAGE_H));
  }

  const go = (n: number) => (idx = Math.max(0, Math.min((newCount || 1) - 1, n)));

  // Show only the active new page.
  $effect(() => {
    const w = newWrap;
    if (!w) return;
    const i = idx;
    w.querySelectorAll<HTMLElement>(".cmp-page").forEach((p, k) => {
      p.style.display = k === i ? "block" : "none";
    });
  });

  // Show only the matching old page, and keep both panes scaled identically.
  $effect(() => {
    const w = leftWrap;
    if (!w) return;
    const oi = idx + offset;
    const s = scale;
    w.querySelectorAll<HTMLCanvasElement>("canvas").forEach((c, k) => {
      c.style.display = k === oi ? "block" : "none";
      c.style.width = `${PAGE_W * s}px`;
    });
  });

  function onKey(e: KeyboardEvent) {
    if (mode !== "compare") return;
    if (e.key === "ArrowRight") go(idx + 1);
    else if (e.key === "ArrowLeft") go(idx - 1);
  }

  onMount(() => {
    // GuideDocument renders synchronously, so its pages are already in the DOM.
    newCount = newWrap?.querySelectorAll(".cmp-page").length ?? 0;
    fit();
    const ro = new ResizeObserver(fit);
    if (paneEl) ro.observe(paneEl);
    window.addEventListener("keydown", onKey);

    // Old proof → one canvas per page (hidden; the effect reveals the active one).
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const dpr = window.devicePixelRatio || 1;
      const doc = await pdfjs.getDocument({ url: OLD_PDF }).promise;
      oldCount = doc.numPages;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (PAGE_W / base.width) * dpr });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.className = "old-page";
        canvas.style.display = "none";
        canvas.style.width = `${PAGE_W * scale}px`;
        leftWrap?.appendChild(canvas);
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
      }
      // Reveal the active old page now that canvases exist (appends aren't reactive).
      const oi = idx + offset;
      leftWrap?.querySelectorAll<HTMLCanvasElement>("canvas").forEach((c, k) => {
        if (k === oi) c.style.display = "block";
      });
    })();

    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  });

  // Flip-book (single book of the rebuild), built lazily the first time Book opens.
  // Returns its destroy synchronously (async actions don't satisfy the Action type).
  function flipbook(node: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pf: any;
    (async () => {
      const FLIP_W = 520;
      const FLIP_H = Math.round((FLIP_W * PAGE_H) / PAGE_W);
      const { PageFlip } = await import("page-flip/dist/js/page-flip.module.js");
      await tick();
      pf = new PageFlip(node, {
        width: FLIP_W,
        height: FLIP_H,
        size: "fixed",
        showCover: true,
        drawShadow: true,
        maxShadowOpacity: 0.5,
        flippingTime: 600,
        usePortrait: false,
        mobileScrollSupport: false,
      });
      pf.loadFromHTML(node.querySelectorAll(".page"));
    })();
    return {
      destroy() {
        try {
          pf?.destroy();
        } catch {
          /* already torn down */
        }
      },
    };
  }
</script>

<svelte:head>
  <title>Guide Compare: Level 1</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet cmpPage(meta: GuidePageMeta)}
  <div class="cmp-page">
    <div class="cmp-scale">
      <div class="pg">
        <GuidePage title={meta.title} pageNumber={meta.pageNumber} fullBleed={meta.fullBleed}>
          {@render meta.content()}
        </GuidePage>
      </div>
    </div>
  </div>
{/snippet}

{#snippet flipPage(meta: GuidePageMeta)}
  <div class="page">
    <div class="scale">
      <div class="pg">
        <GuidePage title={meta.title} pageNumber={meta.pageNumber} fullBleed={meta.fullBleed}>
          {@render meta.content()}
        </GuidePage>
      </div>
    </div>
  </div>
{/snippet}

<div class="wrap">
  <div class="bar">
    <span class="t">Level 1 · {mode === "compare" ? "compare" : "book"}</span>

    {#if mode === "compare"}
      <div class="nav">
        <button onclick={() => go(idx - 1)} disabled={idx <= 0}>‹ Prev</button>
        <span class="lbl">new {idx + 1}/{newCount} · old {Math.max(0, idx + offset) + 1}/{oldCount || "…"}</span>
        <button onclick={() => go(idx + 1)} disabled={idx >= newCount - 1}>Next ›</button>
        <span class="dim">offset</span>
        <button class="sm" onclick={() => offset--} title="old page −1">−</button>
        <button class="sm" onclick={() => offset++} title="old page +1">+</button>
      </div>
    {/if}

    <div class="modes">
      <button class:on={mode === "compare"} onclick={() => (mode = "compare")}>Compare</button>
      <button class:on={mode === "flip"} onclick={() => { flipOpened = true; mode = "flip"; }}>Book</button>
    </div>
  </div>

  <!-- COMPARE — kept mounted (just hidden in book mode) so pdf canvases persist. -->
  <div class="cmp" style="display:{mode === 'compare' ? 'grid' : 'none'}">
    <div class="pane" bind:this={paneEl}>
      <div class="cap">Old: v0.5</div>
      <div class="oldwrap" bind:this={leftWrap}></div>
    </div>
    <div class="pane">
      <div class="cap">New: rebuild</div>
      <div class="newwrap" bind:this={newWrap} style="--s:{scale}">
        <GuideDocument coverTheme="navy" built={BUILT} page={cmpPage} />
      </div>
    </div>
  </div>

  {#if flipOpened}
    <div class="flipmode" style="display:{mode === 'flip' ? 'flex' : 'none'}">
      <div class="flip" use:flipbook style="--s:{520 / PAGE_W}">
        <GuideDocument coverTheme="navy" built={BUILT} page={flipPage} />
      </div>
    </div>
  {/if}
</div>

<style>
  .wrap { height: 100vh; display: flex; flex-direction: column; background: #15151c; color: #eaeaf2; font-family: system-ui, sans-serif; overflow: hidden; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 16px; border-bottom: 1px solid #2c2c38; flex: 0 0 auto; }
  .t { font-size: 13px; color: #cfcfe0; flex: 0 0 auto; }

  .nav { display: flex; align-items: center; gap: 8px; }
  .nav .lbl { font-size: 12px; color: #9a9ab0; min-width: 160px; text-align: center; font-variant-numeric: tabular-nums; }
  .nav .dim { font-size: 11px; color: #6f6f86; margin-left: 8px; }
  .bar button { font: 500 12px system-ui; padding: 6px 12px; border-radius: 999px; border: 1px solid #3a3a48; background: #26262f; color: #c8c8db; cursor: pointer; }
  .bar button:disabled { opacity: 0.4; cursor: default; }
  .bar button.sm { padding: 6px 10px; }
  .modes { display: flex; gap: 8px; flex: 0 0 auto; }
  .modes button.on { background: #3730a3; border-color: #3730a3; color: #fff; }

  /* Compare grid — two equal panes, one page each, no scroll. */
  .cmp { flex: 1 1 auto; min-height: 0; grid-template-columns: 1fr 1fr; gap: 1px; background: #2c2c38; }
  .pane { display: flex; flex-direction: column; min-height: 0; background: #1f1f27; padding: 8px 0; }
  .cap { flex: 0 0 auto; font-size: 12px; color: #9a9ab0; text-align: center; padding-bottom: 6px; }
  .oldwrap, .newwrap { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .oldwrap :global(canvas.old-page) { display: none; background: #fff; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.45); }

  /* New page: scale the native 816×1056 into a box of the scaled footprint so it
     centres cleanly (transform alone doesn't shrink layout size). */
  .cmp-page { display: none; width: calc(816px * var(--s)); height: calc(1056px * var(--s)); overflow: hidden; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.45); }
  .cmp-scale { width: 816px; height: 1056px; transform: scale(var(--s)); transform-origin: top left; background: #fff; }
  .pg :global(.guide-page) { margin: 0; box-shadow: none; }

  /* Book (flip) mode — single book of the rebuild. */
  .flipmode { flex: 1 1 auto; min-height: 0; align-items: center; justify-content: center; padding: 20px; }
  .flip { background: transparent; }
  .flip :global(.page) { background: #fff; overflow: hidden; box-sizing: border-box; }
  .flip .scale { width: 816px; height: 1056px; transform: scale(var(--s)); transform-origin: top left; }
</style>
