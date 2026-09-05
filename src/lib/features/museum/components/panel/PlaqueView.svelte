<script lang="ts">
  import type { PlaqueAnnotation, PlaqueStyle } from "../../domain/museum-grid-types";
  import StickyNote from "./StickyNote.svelte";

  interface Props {
    title: string;
    subtitle?: string;
    body: string;
    footer?: string;
    /** Which surface this is: the museum's brass plaque unless told otherwise. */
    style?: PlaqueStyle;
    /** K's notes, stuck to the surface. */
    annotations?: PlaqueAnnotation[];
    /** In-fiction draft copy awaiting Austen's pass. */
    draft?: boolean;
  }

  import "../museum-theme.css";
  let {
    title,
    subtitle,
    body,
    footer,
    style = "plaque",
    annotations = [],
    draft = false,
  }: Props = $props();

  const STYLE_TAG: Record<PlaqueStyle, string | null> = {
    plaque: null,
    order: "Bureau of Kinetic Containment",
    "k-sign": "Handmade sign",
    document: "Archive copy",
    console: "Terminal",
    shelf: "Shelf tag",
  };

  let tag = $derived(STYLE_TAG[style]);
</script>

<article class="plaque museum-gold-scope style-{style}">
  {#if tag || draft}
    <div class="plaque-tags">
      {#if tag}<span class="style-tag">{tag}</span>{/if}
      {#if draft}<span class="draft-tag" title="In-fiction draft, pending Austen's pass">DRAFT</span>{/if}
    </div>
  {/if}

  <header class="plaque-header">
    <h2 class="plaque-title">{title}</h2>
    {#if subtitle}
      <p class="plaque-subtitle">{subtitle}</p>
    {/if}
  </header>

  <div class="plaque-divider"></div>

  <div class="plaque-body">
    <p>{body}</p>
  </div>

  {#if footer}
    <footer class="plaque-footer">
      <p>{footer}</p>
    </footer>
  {/if}

  {#if annotations.length}
    <div class="plaque-notes">
      {#each annotations as note, i (i)}
        <StickyNote text={note.text} era={note.era} lean={i % 2 === 0 ? -1.5 : 1.2} />
      {/each}
    </div>
  {/if}
</article>

<style>
  .plaque {
    padding: 24px;
    background: linear-gradient(
      180deg,
      var(--museum-gold-06) 0%,
      color-mix(in srgb, var(--museum-gold) 2%, transparent) 100%
    );
    border: 1px solid var(--museum-gold-15);
    border-radius: 8px;
    max-width: 100%;
  }

  .plaque-tags {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .style-tag,
  .draft-tag {
    font-family: monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 3px;
  }

  .style-tag {
    color: var(--museum-gold-60);
    border: 1px solid var(--museum-gold-20);
  }

  .draft-tag {
    margin-left: auto;
    color: #f0b040;
    border: 1px dashed rgba(240, 176, 64, 0.5);
  }

  .plaque-header {
    text-align: center;
    margin-bottom: 16px;
  }

  .plaque-title {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.4rem;
    font-weight: 600;
    color: #c8b890;
    letter-spacing: 0.02em;
  }

  .plaque-subtitle {
    margin: 6px 0 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-min, 14px);
    color: var(--museum-gold-60);
    font-style: italic;
  }

  .plaque-divider {
    width: 60px;
    height: 1px;
    background: var(--museum-gold-25);
    margin: 0 auto 16px;
  }

  .plaque-body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-min, 14px);
    line-height: 1.7;
    color: var(--museum-gold-75);
  }

  .plaque-body p {
    margin: 0;
    white-space: pre-line;
  }

  .plaque-footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--museum-gold-10);
  }

  .plaque-footer p {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--font-size-compact, 12px);
    color: var(--museum-gold-40);
    text-align: center;
    font-style: italic;
  }

  .plaque-notes {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 22px;
    padding: 6px 4px 4px;
  }

  /* ── Surface families ── */

  .style-order {
    background: #e9e5da;
    border-color: #3a3a3a;
    border-radius: 2px;
  }
  .style-order .plaque-header {
    text-align: left;
  }
  .style-order .plaque-title,
  .style-order .plaque-body,
  .style-order .plaque-subtitle {
    font-family: Arial, Helvetica, sans-serif;
    color: #1c1c1c;
  }
  .style-order .plaque-title {
    text-transform: uppercase;
    font-size: 1.1rem;
    letter-spacing: 0.06em;
  }
  .style-order .plaque-subtitle {
    color: #4a4a4a;
    font-style: normal;
  }
  .style-order .plaque-divider {
    margin-left: 0;
    background: #3a3a3a;
  }
  .style-order .plaque-footer p {
    color: #555;
  }
  .style-order .style-tag {
    color: #e9e5da;
    background: #1c1c1c;
    border-color: #1c1c1c;
  }

  .style-k-sign {
    background: #d8c08f;
    border: none;
    border-radius: 2px;
    box-shadow: inset 0 0 40px rgba(90, 70, 40, 0.18);
  }
  .style-k-sign .plaque-header {
    text-align: left;
  }
  .style-k-sign .plaque-title,
  .style-k-sign .plaque-body,
  .style-k-sign .plaque-subtitle,
  .style-k-sign .plaque-footer p {
    font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
    color: #1c1812;
  }
  .style-k-sign .plaque-title {
    text-transform: uppercase;
    font-size: 1.5rem;
  }
  .style-k-sign .plaque-subtitle {
    font-style: normal;
    color: #3a3126;
  }
  .style-k-sign .plaque-divider {
    display: none;
  }
  .style-k-sign .plaque-footer {
    border-top-color: rgba(28, 24, 18, 0.2);
  }
  .style-k-sign .plaque-footer p {
    text-align: right;
    font-style: normal;
  }
  .style-k-sign .style-tag {
    color: #3a3126;
    border-color: rgba(28, 24, 18, 0.3);
  }

  .style-document {
    background: #f4efe3;
    border-color: #8a8578;
    border-radius: 2px;
  }
  .style-document .plaque-header {
    text-align: left;
  }
  .style-document .plaque-title,
  .style-document .plaque-body,
  .style-document .plaque-subtitle,
  .style-document .plaque-footer p {
    font-family: "Courier New", Courier, monospace;
    color: #2a2722;
  }
  .style-document .plaque-title {
    text-transform: uppercase;
    font-size: 1rem;
  }
  .style-document .plaque-divider {
    margin-left: 0;
    background: #8a8578;
  }
  .style-document .style-tag {
    color: #f4efe3;
    background: #8a8578;
    border-color: #8a8578;
  }

  .style-console {
    background: #07100c;
    border-color: #1f3a2a;
    border-radius: 4px;
    box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.6);
  }
  .style-console .plaque-header {
    text-align: left;
  }
  .style-console .plaque-title,
  .style-console .plaque-body,
  .style-console .plaque-subtitle,
  .style-console .plaque-footer p {
    font-family: Consolas, "Courier New", monospace;
  }
  .style-console .plaque-title {
    color: #7dff9a;
    text-transform: uppercase;
    font-size: 1rem;
    letter-spacing: 0.08em;
  }
  .style-console .plaque-subtitle {
    color: #4fd37a;
    font-style: normal;
  }
  .style-console .plaque-body {
    color: #9cf5b0;
  }
  .style-console .plaque-divider {
    margin-left: 0;
    background: #1f3a2a;
  }
  .style-console .plaque-footer p {
    color: #4fd37a;
  }
  .style-console .style-tag {
    color: #7dff9a;
    border-color: #1f3a2a;
  }

  .style-shelf {
    background: #f7f5ee;
    border-color: #c9c3b0;
  }
  .style-shelf .plaque-header {
    text-align: left;
  }
  .style-shelf .plaque-title,
  .style-shelf .plaque-body,
  .style-shelf .plaque-footer p {
    font-family: Arial, Helvetica, sans-serif;
    color: #222;
  }
  .style-shelf .plaque-body {
    color: #444;
  }
  .style-shelf .plaque-subtitle {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 10px;
    background: #e0782a;
    color: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-style: normal;
    border-radius: 2px;
  }
  .style-shelf .plaque-divider {
    margin-left: 0;
    background: #c9c3b0;
  }
  .style-shelf .plaque-footer p {
    color: #8a8578;
  }
  .style-shelf .style-tag {
    color: #444;
    border-color: #c9c3b0;
  }
</style>
