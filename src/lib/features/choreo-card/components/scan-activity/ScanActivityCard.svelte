<!--
  ScanActivityCard.svelte

  Feed card for the Scan Activity view. Renders the real playing-card face
  via ChoreoCard (cardMode) with a scan-count badge overlay and a thin
  lower strip showing last-scan city + time-ago. Click navigates to the
  canonical short-code viewer at /q/{code}.
-->
<script lang="ts">
  import ChoreoCard from "$lib/features/choreo-card/components/ChoreoCard.svelte";
  import type { CodeEntry } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    entry,
    sequence,
    hot = false,
    sparkline,
    onOpen,
  }: {
    entry: CodeEntry;
    sequence: SequenceData | null;
    hot?: boolean;
    sparkline?: number[];
    onOpen: (code: string) => void;
  } = $props();

  const sparklinePath = $derived.by(() => {
    if (!sparkline || sparkline.every((v) => v === 0)) return "";
    const max = Math.max(...sparkline, 1);
    const w = 60;
    const h = 16;
    const step = w / (sparkline.length - 1);
    return sparkline
      .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
      .join(" ");
  });

  const timeAgo = $derived.by(() => {
    if (!entry.lastScannedAt) return "-";
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
    aria-label={`${entry.word} - restoration failed. Click for details.`}
    type="button"
  >
    <span class="badge badge-error" aria-hidden="true">!</span>
    <span class="word">restoration failed</span>
    <span class="code-pill">{entry.code}</span>
    <div class="pictos" aria-hidden="true">
      <div class="cell"></div>
      <div class="cell"></div>
      <div class="cell"></div>
      <div class="cell"></div>
    </div>
    <div class="footer-strip">
      <span class="loc">-</span>
      <span class="ago err">check</span>
    </div>
  </button>
{:else}
  <div
    class="scard"
    class:hot
    aria-label={ariaLabel}
    style:view-transition-name={`scan-card-${entry.code}`}
  >
    <span class="badge" aria-hidden="true">{entry.scanCount}</span>
    {#if hot}
      <span class="hot-pulse" aria-hidden="true"></span>
    {/if}
    <div class="card-face">
      <ChoreoCard
        {sequence}
        cardMode
        showQRCodes={false}
        showBirthday={false}
        onSelect={() => onOpen(entry.code)}
      />
    </div>
    <div class="footer-strip">
      <span class="loc">{entry.lastCity ?? "-"}</span>
      {#if sparklinePath}
        <svg class="sparkline" viewBox="0 0 60 16" aria-hidden="true">
          <path d={sparklinePath} fill="none" stroke="var(--theme-accent, #34d399)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      {/if}
      <span class="ago">{timeAgo}</span>
    </div>
  </div>
{/if}

<style>
  .scard {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, linear-gradient(180deg, #151a28 0%, #0d1019 100%));
    border: 1px solid var(--theme-stroke, #222838);
    border-radius: 8px;
    aspect-ratio: 5 / 7;
    overflow: hidden;
    color: inherit;
    text-align: left;
    font: inherit;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .scard:hover { border-color: var(--theme-accent, rgba(16, 185, 129, 0.4)); transform: translateY(-2px); }
  .scard.hot { border-color: var(--theme-accent, #10b981); box-shadow: 0 0 20px rgba(16, 185, 129, 0.35); }

  .card-face {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .card-face :global(.choreo-card) {
    border: none;
    border-radius: 0;
  }
  .card-face :global(.choreo-card:hover) {
    transform: none;
    box-shadow: none;
  }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 9px;
    background: var(--theme-accent, rgba(16, 185, 129, 0.92));
    border-radius: 12px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-card-bg, #04120b);
    font-weight: 800;
    z-index: 2;
    pointer-events: none;
    box-shadow: var(--shadow-accent, 0 2px 8px rgba(16, 185, 129, 0.4));
  }
  .badge-error {
    background: var(--semantic-error, rgba(239, 68, 68, 0.95));
    color: var(--theme-card-bg, #2b0707);
    box-shadow: var(--shadow-error, 0 2px 8px rgba(239, 68, 68, 0.4));
  }

  .hot-pulse {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--theme-accent, #34d399);
    box-shadow: 0 0 10px var(--theme-accent, #10b981);
    animation: hotPulse 1.4s infinite;
    z-index: 2;
  }
  @keyframes hotPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(1.6); }
  }

  .footer-strip {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    font-size: var(--font-size-sm, 14px);
    background: var(--theme-panel-bg, #0b0d17);
    border-top: 1px solid var(--theme-stroke, #1a1f2e);
  }
  .loc { color: var(--theme-text-muted, #d0d5e0); }
  .sparkline { width: 60px; height: 16px; flex-shrink: 0; opacity: 0.7; }
  .ago { color: var(--theme-accent, #34d399); font-weight: 600; }
  .ago.err { color: var(--semantic-error-text, #fca5a5); }

  /* Placeholder (integrity-failed) state keeps the old styling */
  .placeholder {
    opacity: 0.55;
    border-style: dashed;
    padding: 10px;
    gap: 6px;
    cursor: pointer;
  }
  .placeholder:focus-visible { outline: 2px solid var(--theme-accent, #34d399); outline-offset: 2px; }
  .placeholder .word {
    font-family: monospace;
    color: var(--theme-text-dim, #94a3b8);
    font-size: var(--font-size-sm, 14px);
  }
  .code-pill {
    font-family: monospace;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, #8b93a7);
    background: var(--theme-panel-bg, #0b0d17);
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
    background: repeating-linear-gradient(45deg, var(--theme-stroke, #1a1f2e), var(--theme-stroke, #1a1f2e) 5px, var(--theme-panel-bg, #0b0d17) 5px, var(--theme-panel-bg, #0b0d17) 10px);
    border-radius: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .scard { transition: none; }
    .hot-pulse { animation: none; }
  }
</style>
