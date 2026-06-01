<script lang="ts">
  import { downloadCodexSheetPDF, buildCodexSheetPDF } from "../services/codex-sheet-pdf";

  let busy = $state(false);
  let error = $state<string | null>(null);

  // Two printed sheets, mirroring what the PDF lays out: 4-up, portrait.
  const sheets = [
    { side: "FRONT SIDE", title: "Front · Types 1–2", img: "/codex/front.png", mirror: false },
    { side: "BACK SIDE — columns mirrored for long-edge flip", title: "Back · Types 3–6", img: "/codex/back.png", mirror: true },
  ];
  const CELLS = [0, 1, 2, 3]; // 2×2

  async function download() {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await downloadCodexSheetPDF();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function openInTab() {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const blob = await buildCodexSheetPDF();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="codex-print">
  <header class="head">
    <h1>Codex Print</h1>
    <p class="lede">
      The full Double-Staff codex as cut-out reference cards. Four per sheet, double-sided —
      Types&nbsp;1–2 on the front, Types&nbsp;3–6 on the back — framed in the Choreo Cards rainbow.
    </p>
  </header>

  <div class="actions">
    <button type="button" class="btn primary" onclick={download} disabled={busy}>
      {#if busy}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Building…
      {:else}
        <i class="fas fa-file-arrow-down" aria-hidden="true"></i> Download Print Sheet (PDF)
      {/if}
    </button>
    <button type="button" class="btn ghost" onclick={openInTab} disabled={busy}>
      <i class="fas fa-up-right-from-square" aria-hidden="true"></i> Open in Tab
    </button>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <!-- Laid-out print preview, like the deck releaser -->
  <div class="pages-scroll">
    {#each sheets as sheet, i (i)}
      <span class="page-label">{sheet.title} · Sheet {i + 1} of {sheets.length}</span>
      <div class="page">
        <div class="page-grid" class:mirror={sheet.mirror}>
          {#each CELLS as cell (cell)}
            <div class="cell">
              <img src={sheet.img} alt="{sheet.title} card" loading="lazy" />
            </div>
          {/each}
        </div>
        <div class="page-guide page-guide-bottom">
          <span class="guide-text">{sheet.side}</span>
          <span class="guide-text">Sheet {i + 1} of {sheets.length}</span>
        </div>
      </div>
    {/each}
  </div>

  <section class="howto">
    <h2>How to print</h2>
    <ol>
      <li>Print <strong>double-sided</strong>, flip on the <strong>long edge</strong>.</li>
      <li>Set scale to <strong>Actual Size / 100%</strong> — not "Fit to page".</li>
      <li>Use <strong>portrait</strong> US&nbsp;Letter.</li>
      <li>Cut along the shared rainbow seams. Each card = Type&nbsp;1–2 front, Type&nbsp;3–6 back.</li>
    </ol>
    <p class="size-note">Finished card size: 4.25 × 5.5 in.</p>
  </section>
</div>

<style>
  .codex-print {
    max-width: 760px;
    margin: 0 auto;
    padding: clamp(16px, 3vw, 32px);
    color: var(--theme-text, #fff);
  }

  .head h1 {
    margin: 0 0 6px;
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 700;
  }

  .lede {
    margin: 0 0 20px;
    max-width: 64ch;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.55;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 20px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease, background 0.15s ease;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn.primary {
    color: #fff;
    background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%);
  }
  .btn.primary:not(:disabled):hover { filter: brightness(1.08); }

  .btn.ghost {
    color: var(--theme-text, #fff);
    background: var(--theme-surface, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }
  .btn.ghost:not(:disabled):hover { background: var(--theme-surface-hover, rgba(255, 255, 255, 0.12)); }

  .error { color: var(--semantic-error-text, #ff6b6b); font-size: 0.85rem; margin: 0 0 16px; }

  /* ── Print preview (page sheets, mirroring the deck releaser) ── */
  .pages-scroll {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    margin-bottom: 28px;
  }

  .page-label {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
    margin-top: 4px;
  }

  .page {
    position: relative;
    width: 100%;
    max-width: 560px;
    aspect-ratio: 8.5 / 11; /* US Letter portrait */
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
    padding: calc(18 / 612 * 100%); /* MARGIN/PAGE_W */
  }

  .page-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    width: 100%;
    height: 100%;
    gap: 0; /* cards touch → shared cut seams */
  }

  /* Choreo Cards rainbow frame; white content inset; image centered. */
  .cell {
    padding: 4.5%;
    background: linear-gradient(
      to top,
      #cc0000 0%, #cc6600 14%, #cccc00 28%, #00cc00 42%,
      #00cc66 56%, #0066cc 70%, #0033cc 82%, #6600cc 100%
    );
    box-sizing: border-box;
  }

  .cell img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #fff;
  }

  .page-guide-bottom {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 3px;
    display: flex;
    justify-content: space-between;
    pointer-events: none;
  }

  .guide-text {
    font-size: 7px;
    color: #9a9a9a;
    font-family: Helvetica, Arial, sans-serif;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .howto {
    padding: 16px 20px;
    border-radius: 12px;
    background: var(--theme-panel-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .howto h2 { margin: 0 0 10px; font-size: 1rem; font-weight: 700; }

  .howto ol {
    margin: 0;
    padding-left: 20px;
    line-height: 1.7;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.8));
  }

  .size-note {
    margin: 10px 0 0;
    font-size: 0.82rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
</style>
