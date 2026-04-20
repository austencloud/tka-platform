<!--
  ScanActivityCard.svelte

  Feed card for the Scan Activity view. Composes ChoreoCardThumbnail
  (which owns pictograph rendering via PropAwareThumbnail — CLAUDE.md
  compliance) and wraps it with overlay chrome:
  scan count badge, sparkline, city, time-ago, hot glow, error state.
-->
<script lang="ts">
  import ChoreoCardThumbnail from "$lib/features/browse/sequences/display/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import type { CodeEntry } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  let {
    entry,
    sequence,
    hot = false,
    onOpen,
  }: {
    entry: CodeEntry;
    sequence: SequenceData | null;
    hot?: boolean;
    onOpen: (code: string) => void;
  } = $props();

  const timeAgo = $derived.by(() => {
    if (!entry.lastScannedAt) return "—";
    const ms = Date.now() - new Date(entry.lastScannedAt).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  });

  const ariaLabel = $derived(
    `${entry.word}, code ${entry.code}, ${entry.scanCount} scans, last in ${entry.lastCity ?? "unknown"} ${timeAgo} ago`
  );
</script>

{#if !entry.integrityOk || !sequence}
  <button
    class="scard placeholder"
    onclick={() => onOpen(entry.code)}
    aria-label={`${entry.word} — restoration failed. Click for details.`}
  >
    <span class="badge badge-error">!</span>
    <span class="word">restoration failed</span>
    <span class="code-pill">{entry.code}</span>
    <div class="pictos" aria-hidden="true">
      <div class="cell"></div>
      <div class="cell"></div>
      <div class="cell"></div>
      <div class="cell"></div>
    </div>
    <div class="footer">
      <span class="loc">—</span>
      <span class="ago err">check</span>
    </div>
  </button>
{:else}
  <button
    class="scard"
    class:hot
    onclick={() => onOpen(entry.code)}
    aria-label={ariaLabel}
    style:view-transition-name={`scan-card-${entry.code}`}
  >
    <span class="badge">{entry.scanCount}</span>
    <div class="thumb-wrap">
      <ChoreoCardThumbnail {sequence} />
    </div>
    <div class="footer">
      <span class="loc">{entry.lastCity ?? "—"}</span>
      <span class="ago">{timeAgo}</span>
    </div>
  </button>
{/if}

<style>
  .scard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: linear-gradient(180deg, #151a28 0%, #0d1019 100%);
    border: 1px solid #222838;
    border-radius: 8px;
    aspect-ratio: 5 / 7;
    cursor: pointer;
    color: inherit;
    text-align: left;
    font: inherit;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .scard:hover { border-color: rgba(16, 185, 129, 0.4); transform: translateY(-2px); }
  .scard:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }
  .scard.hot { border-color: #10b981; box-shadow: 0 0 20px rgba(16, 185, 129, 0.25); }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 8px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 12px;
    font-size: var(--font-size-sm, 14px);
    color: #34d399;
    font-weight: 700;
  }
  .badge-error { background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.35); color: #fca5a5; }

  .thumb-wrap { flex: 1; min-height: 0; }
  .word { font-family: monospace; color: #34d399; font-size: var(--font-size-sm, 14px); }
  .code-pill {
    font-family: monospace;
    font-size: var(--font-size-sm, 14px);
    color: #8b93a7;
    background: #0b0d17;
    padding: 2px 6px;
    border-radius: 3px;
    align-self: flex-start;
  }
  .pictos {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3px;
    flex: 1;
  }
  .cell {
    background: repeating-linear-gradient(45deg, #1a1f2e, #1a1f2e 5px, #0b0d17 5px, #0b0d17 10px);
    border-radius: 3px;
  }
  .footer { display: flex; justify-content: space-between; font-size: var(--font-size-sm, 14px); }
  .loc { color: #d0d5e0; }
  .ago { color: #10b981; font-weight: 600; }
  .ago.err { color: #fca5a5; }

  .placeholder { opacity: 0.55; border-style: dashed; }
  .placeholder .word { color: #94a3b8; }

  @media (prefers-reduced-motion: reduce) {
    .scard { transition: none; }
  }
</style>
