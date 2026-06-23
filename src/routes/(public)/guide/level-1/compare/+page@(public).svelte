<script lang="ts">
  /**
   * Side-by-side proof: the OLD v0.5 book (left) vs the NEW live rebuild (right),
   * with SYNCED scrolling — scroll either pane and the other follows, so the two
   * editions stay lined up page-for-page.
   *
   * The left is the frozen original PDF rendered to canvases via pdf.js (so its
   * scroll is scriptable — a native PDF <iframe> is not). Both panes render their
   * pages at the SAME width (PAGE_W), so equal page heights = equal page ratio:
   * the panel is also the honest ratio check (both are 8.5×11 Letter, 1.2941).
   * The right stays the live print route in an iframe, so it always reflects the
   * latest page work.
   */
  import { onMount } from "svelte";

  // 8.5in at 96dpi — the exact CSS width of one guide page in the print route,
  // so the left canvases match the right pages 1:1 in width.
  const PAGE_W = 816;
  const OLD_PDF = "/guides/_proof/level-1-v05.pdf";

  let home = $state(false); // toggle the right pane between navy + home editions
  const newSrc = $derived("/guide/level-1/print" + (home ? "?theme=home" : ""));

  let leftEl: HTMLDivElement;
  let rightFrame: HTMLIFrameElement;
  let syncing = false; // re-entrancy guard so the two scroll handlers don't fight

  function rightScroller(): HTMLElement | null {
    const d = rightFrame?.contentDocument;
    return (d?.scrollingElement as HTMLElement) ?? d?.documentElement ?? null;
  }
  function frac(el: HTMLElement) {
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? el.scrollTop / max : 0;
  }
  function setFrac(el: HTMLElement, f: number) {
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = f * max;
  }
  function onLeftScroll() {
    if (syncing) return;
    const r = rightScroller();
    if (!r) return;
    syncing = true;
    setFrac(r, frac(leftEl));
    requestAnimationFrame(() => (syncing = false));
  }
  function onRightScroll() {
    if (syncing) return;
    const r = rightScroller();
    if (!r) return;
    syncing = true;
    setFrac(leftEl, frac(r));
    requestAnimationFrame(() => (syncing = false));
  }
  // The iframe's inner window scrolls, not the iframe element — (re)bind on each
  // load (toggling navy/home reloads it).
  function bindRightScroll() {
    rightFrame?.contentWindow?.addEventListener("scroll", onRightScroll, { passive: true });
  }

  onMount(async () => {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const dpr = window.devicePixelRatio || 1;
    const doc = await pdfjs.getDocument({ url: OLD_PDF }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const cssScale = PAGE_W / base.width;
      const vp = page.getViewport({ scale: cssScale * dpr });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.className = "pdf-page";
      canvas.style.width = `${PAGE_W}px`;
      const ctx = canvas.getContext("2d")!;
      leftEl.appendChild(canvas);
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    }
  });
</script>

<svelte:head><title>Guide Compare — Level 1</title></svelte:head>

<div class="wrap">
  <div class="bar">
    <span class="t">Old v0.5 <b>·</b> New rebuild <span class="hint">— scroll syncs both panes</span></span>
    <div class="ctrls">
      <button class:on={!home} onclick={() => (home = false)}>New: Navy</button>
      <button class:on={home} onclick={() => (home = true)}>New: Home (light)</button>
    </div>
  </div>
  <div class="cols">
    <div class="col">
      <div class="cap">Old — v0.5</div>
      <div class="pane left" bind:this={leftEl} onscroll={onLeftScroll}></div>
    </div>
    <div class="col">
      <div class="cap">New — rebuild ({home ? "home" : "navy"})</div>
      <iframe
        class="pane"
        bind:this={rightFrame}
        src={newSrc}
        title="New rebuild"
        onload={bindRightScroll}
      ></iframe>
    </div>
  </div>
</div>

<style>
  .wrap { height: 100vh; display: flex; flex-direction: column; background: #1b1b22; color: #eaeaf2; font-family: system-ui, sans-serif; }
  .bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #33333f; flex: 0 0 auto; }
  .t { font-size: 14px; color: #cfcfe0; } .t b { color: #6f6f8a; }
  .hint { color: #8a8aa0; font-size: 12px; }
  .ctrls { display: flex; gap: 8px; }
  .ctrls button { font: 500 12px system-ui; padding: 6px 12px; border-radius: 999px; border: 1px solid #3a3a48; background: #26262f; color: #c8c8db; cursor: pointer; }
  .ctrls button.on { background: #3730a3; border-color: #3730a3; color: #fff; }

  .cols { flex: 1 1 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #33333f; min-height: 0; }
  .col { display: flex; flex-direction: column; min-height: 0; background: #2b2b33; }
  .cap { flex: 0 0 auto; font-size: 12px; color: #9a9ab0; text-align: center; padding: 4px; }
  .pane { flex: 1 1 auto; width: 100%; border: 0; background: #2b2b33; }
  /* Left canvas stack — centred column of pages at PAGE_W, same width as right. */
  .pane.left { overflow: auto; display: flex; flex-direction: column; align-items: center; padding: 14px 0; gap: 14px; }
  .pane.left :global(canvas.pdf-page) { display: block; background: #fff; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4); }
</style>
