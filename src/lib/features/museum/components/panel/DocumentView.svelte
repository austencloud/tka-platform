<script lang="ts">
  /**
   * A paper document read up close: report, memo, transcript, pamphlet, or
   * filing. Pages turn; the kind badge tells you what you're holding.
   */
  import "../museum-theme.css";
  import type { MuseumDocument } from "../../domain/museum-grid-types";

  interface Props {
    document: MuseumDocument;
  }

  let { document }: Props = $props();

  let page = $state(0);
  let pageCount = $derived(document.pages.length);
  let current = $derived(document.pages[page] ?? "");
  let paragraphs = $derived(current.split(/\n\n+/));

  const KIND_LABEL: Record<MuseumDocument["kind"], string> = {
    report: "Report",
    memo: "Internal memo",
    transcript: "Transcript",
    pamphlet: "Pamphlet",
    filing: "Filing",
  };

  $effect(() => {
    // A new document opens on its first page.
    document;
    page = 0;
  });
</script>

<article class="document museum-gold-scope kind-{document.kind}">
  <div class="doc-tags">
    <span class="kind-tag">{KIND_LABEL[document.kind]}</span>
    {#if document.draft}
      <span class="draft-tag" title="In-fiction draft, pending Austen's pass">DRAFT</span>
    {/if}
  </div>

  <header class="doc-header">
    <h2 class="doc-heading">{document.heading}</h2>
    {#if document.meta.length}
      <ul class="doc-meta">
        {#each document.meta as line, i (i)}
          <li>{line}</li>
        {/each}
      </ul>
    {/if}
  </header>

  <div class="doc-page">
    {#each paragraphs as para, i (i)}
      <p>{para}</p>
    {/each}
  </div>

  {#if document.kind === "pamphlet"}
    <div class="doc-qr" aria-label="QR code placeholder">
      <div class="qr-grid">
        {#each Array.from({ length: 49 }) as _, i (i)}
          <span class:on={(i * 7 + 3) % 5 < 2 || i % 8 === 0}></span>
        {/each}
      </div>
      <span class="qr-caption">donation link · reverse</span>
    </div>
  {/if}

  {#if pageCount > 1}
    <nav class="doc-pager" aria-label="Pages">
      <button type="button" disabled={page === 0} onclick={() => (page = Math.max(0, page - 1))}>
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <span class="page-count">page {page + 1} of {pageCount}</span>
      <button
        type="button"
        disabled={page >= pageCount - 1}
        onclick={() => (page = Math.min(pageCount - 1, page + 1))}
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </nav>
  {/if}
</article>

<style>
  .document {
    padding: 22px 24px;
    background: #f4efe3;
    color: #2a2722;
    border: 1px solid #8a8578;
    border-radius: 2px;
    box-shadow: inset 0 0 50px rgba(90, 80, 60, 0.08);
    font-family: "Courier New", Courier, monospace;
  }

  .doc-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .kind-tag,
  .draft-tag {
    font-family: monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 3px;
  }

  .kind-tag {
    color: #f4efe3;
    background: #8a8578;
  }

  .draft-tag {
    margin-left: auto;
    color: #a0521c;
    border: 1px dashed rgba(160, 82, 28, 0.6);
  }

  .doc-heading {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.4;
  }

  .doc-meta {
    list-style: none;
    margin: 10px 0 0;
    padding: 8px 0 0;
    border-top: 1px solid #8a8578;
    font-size: 11px;
    line-height: 1.6;
    color: #4a463e;
  }

  .doc-page {
    margin-top: 16px;
    font-size: var(--font-size-min, 13px);
    line-height: 1.65;
  }

  .doc-page p {
    margin: 0 0 12px;
    white-space: pre-line;
  }

  .doc-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 10px;
    border: 1px dashed #8a8578;
  }

  .qr-grid {
    display: grid;
    grid-template-columns: repeat(7, 8px);
    gap: 2px;
  }

  .qr-grid span {
    width: 8px;
    height: 8px;
    background: rgba(42, 39, 34, 0.12);
  }

  .qr-grid span.on {
    background: #2a2722;
  }

  .qr-caption {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6a655a;
  }

  .doc-pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid #8a8578;
  }

  .doc-pager button {
    width: 32px;
    height: 32px;
    border: 1px solid #8a8578;
    background: transparent;
    color: #2a2722;
    border-radius: 3px;
    cursor: pointer;
  }

  .doc-pager button:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .page-count {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4a463e;
  }

  .kind-pamphlet {
    background: #fbf7ec;
    border-color: #c9b98a;
  }

  .kind-memo {
    background: #fdfbf5;
  }
</style>
