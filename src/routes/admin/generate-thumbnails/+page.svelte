<!--
  Gallery Thumbnail Warm — full-control admin page.

  Renders + uploads the selected scope of gallery thumbnails through the REAL
  ThumbnailRenderOrchestrator (zero parity risk), warming the shared cloud cache
  so cold-cache 404s stop. The AdminToolbar "Warm Gallery (lean)" button runs a
  fixed staff/dark/QR subset; this page exposes the full prop × mode × QR matrix
  for a deliberate leave-it-running pass.

  After a run, index + bundle the results (credentialed, outside the browser):
    npm run thumbnails:manifest
    npm run thumbnails:sync

  Spec: docs/superpowers/specs/active/2026-07-02-gallery-thumbnail-warm-pass-design.md
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { featureFlagService } from "$lib/shared/auth/services/post-hog-feature-flag-service.svelte";
  import {
    startGalleryWarm,
    type WarmHandle,
    type WarmProgress,
    type WarmScope,
  } from "$lib/shared/browse/services/gallery-thumbnail-warmer";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { loadCanonicalTnDSequences } from "$lib/features/browse/gallery-home/canonical-tnd-pool";
  import {
    startScanCellWarm,
    type CellWarmHandle,
    type CellWarmProgress,
  } from "$lib/features/library/services/warm-all-scan-cells";

  const ALL_PROPS: PropType[] = [
    PropType.STAFF,
    PropType.FAN,
    PropType.CLUB,
    PropType.BUUGENG,
    PropType.TRIAD,
    PropType.MINIHOOP,
    PropType.BIGHOOP,
    PropType.DOUBLESTAR,
    PropType.HAND,
    PropType.SWORD,
    PropType.CHICKEN,
    PropType.QUIAD,
  ];

  const isAdmin = $derived(featureFlagService.isAdmin);

  // Scope selection — lean defaults (matches the observed cold set).
  let selectedProps = $state<Set<PropType>>(new Set([PropType.STAFF]));
  let darkMode = $state(true);
  let lightMode = $state(false);
  let noQr = $state(true);
  let qr = $state(true);
  // The canonical T&D pool (~930 turn combos) enters the gallery via the
  // engine's extraCommunitySequences, not the public index — without this the
  // warm pass never sees those cards and they stay on the slow render tier.
  let includeTnDPool = $state(true);

  function toggleProp(prop: PropType) {
    const next = new Set(selectedProps);
    if (next.has(prop)) next.delete(prop);
    else next.add(prop);
    selectedProps = next;
  }

  function selectAllProps() {
    selectedProps = new Set(ALL_PROPS);
  }
  function selectStaffOnly() {
    selectedProps = new Set([PropType.STAFF]);
  }

  const scope = $derived<WarmScope>({
    props: ALL_PROPS.filter((p) => selectedProps.has(p)),
    modes: [...(darkMode ? (["dark"] as const) : []), ...(lightMode ? (["light"] as const) : [])],
    qr: [...(noQr ? [false] : []), ...(qr ? [true] : [])],
  });

  const scopeValid = $derived(
    scope.props.length > 0 && scope.modes.length > 0 && scope.qr.length > 0
  );

  // Run state
  let handle = $state<WarmHandle | null>(null);
  let progress = $state<WarmProgress | null>(null);
  let startTime = $state(0);

  const isRunning = $derived(handle !== null);

  const percent = $derived(
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0
  );

  const eta = $derived.by(() => {
    const p = progress;
    if (!p || p.done === 0 || p.finished) return "";
    const elapsed = Date.now() - startTime;
    const remaining = ((p.total - p.done) * elapsed) / p.done;
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${m}m ${s}s`;
  });

  function start() {
    if (isRunning || !scopeValid) return;
    startTime = Date.now();
    progress = null;
    handle = startGalleryWarm(
      scope,
      (p) => {
        progress = p;
        if (p.finished) handle = null;
      },
      includeTnDPool ? { extraSequences: loadCanonicalTnDSequences } : undefined
    );
  }

  function cancel() {
    handle?.cancel();
  }

  // ── Scan-card cell warm (pictograph-cells cloud store) ──
  let cellHandle = $state<CellWarmHandle | null>(null);
  let cellProgress = $state<CellWarmProgress | null>(null);
  let cellStartTime = $state(0);

  const cellRunning = $derived(cellHandle !== null);

  const cellPercent = $derived(
    cellProgress && cellProgress.total > 0
      ? Math.round((cellProgress.done / cellProgress.total) * 100)
      : 0
  );

  const cellEta = $derived.by(() => {
    const p = cellProgress;
    if (!p || p.done === 0 || p.finished) return "";
    const elapsed = Date.now() - cellStartTime;
    const remaining = ((p.total - p.done) * elapsed) / p.done;
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${m}m ${s}s`;
  });

  function startCells() {
    if (cellRunning) return;
    cellStartTime = Date.now();
    cellProgress = null;
    cellHandle = startScanCellWarm((p) => {
      cellProgress = p;
      if (p.finished) cellHandle = null;
    });
  }

  function cancelCells() {
    cellHandle?.cancel();
  }
</script>

<div class="warm-page">
  <header class="header">
    <h1>Gallery Thumbnail Warm</h1>
    <p class="subtitle">
      Render + upload gallery thumbnails through the real renderer to warm the
      shared cloud cache. After a run: <code>npm run thumbnails:manifest</code> then
      <code>npm run thumbnails:sync</code>.
    </p>
  </header>

  {#if !isAdmin}
    <div class="gate">Admin only.</div>
  {:else}
    <section class="scope">
      <div class="scope-row">
        <div class="scope-head">
          <span class="scope-label">Props</span>
          <div class="scope-actions">
            <button type="button" class="mini" onclick={selectStaffOnly}>Staff only</button>
            <button type="button" class="mini" onclick={selectAllProps}>All props</button>
          </div>
        </div>
        <div class="chips">
          {#each ALL_PROPS as prop (prop)}
            <FilterChipBase
              label={prop}
              mode="toggle"
              size="sm"
              active={selectedProps.has(prop)}
              onclick={() => toggleProp(prop)}
            />
          {/each}
        </div>
      </div>

      <div class="scope-row">
        <span class="scope-label">Mode</span>
        <div class="chips">
          <FilterChipBase label="Dark" mode="toggle" size="sm" active={darkMode} onclick={() => (darkMode = !darkMode)} />
          <FilterChipBase label="Light" mode="toggle" size="sm" active={lightMode} onclick={() => (lightMode = !lightMode)} />
        </div>
      </div>

      <div class="scope-row">
        <span class="scope-label">QR</span>
        <div class="chips">
          <FilterChipBase label="No-QR" mode="toggle" size="sm" active={noQr} onclick={() => (noQr = !noQr)} />
          <FilterChipBase label="QR" mode="toggle" size="sm" active={qr} onclick={() => (qr = !qr)} />
        </div>
      </div>

      <div class="scope-row">
        <span class="scope-label">Pool</span>
        <div class="chips">
          <FilterChipBase
            label="Canonical T&D (~930 combos)"
            mode="toggle"
            size="sm"
            active={includeTnDPool}
            onclick={() => (includeTnDPool = !includeTnDPool)}
          />
        </div>
      </div>
    </section>

    <div class="controls">
      {#if !isRunning}
        <button type="button" class="btn primary" onclick={start} disabled={!scopeValid}>
          Start warm ({scope.props.length} × {scope.modes.length} × {scope.qr.length} per sequence)
        </button>
      {:else}
        <button type="button" class="btn danger" onclick={cancel}>Stop</button>
      {/if}
    </div>

    {#if progress}
      <section class="progress">
        <div class="bar">
          <div class="fill" style:width="{percent}%"></div>
        </div>
        <div class="stats">
          <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()} ({percent}%)</span>
          {#if !progress.finished}<span>ETA {eta}</span>{/if}
        </div>
        <div class="tally">
          <span class="new">{progress.rendered} new</span>
          <span class="cached">{progress.skipped} cached</span>
          <span class="failed">{progress.failed} failed</span>
        </div>
        {#if progress.current && !progress.finished}
          <div class="current">{progress.current}</div>
        {/if}
        {#if progress.finished}
          <div class="done">
            {progress.cancelled ? "Cancelled" : "Done"} — now run
            <code>npm run thumbnails:manifest</code> + <code>npm run thumbnails:sync</code>.
          </div>
        {/if}
      </section>
    {/if}

    <header class="header section-gap">
      <h1>Scan-Card Cell Warm</h1>
      <p class="subtitle">
        Render + upload the canonical per-pictograph cells
        (<code>pictograph-cells/</code>) for every durable QR shortcode, so /q
        scanners download images instead of rasterizing. Resolves each card's
        exact blue/red props and verifies both light and dark assets.
      </p>
    </header>

    <div class="controls">
      {#if !cellRunning}
        <button type="button" class="btn primary" onclick={startCells}>
          Start cell warm (all QR codes)
        </button>
      {:else}
        <button type="button" class="btn danger" onclick={cancelCells}>Stop</button>
      {/if}
    </div>

    {#if cellProgress}
      <section class="progress">
        <div class="bar">
          <div class="fill" style:width="{cellPercent}%"></div>
        </div>
        <div class="stats">
          <span>{cellProgress.done.toLocaleString()} / {cellProgress.total.toLocaleString()} ({cellPercent}%)</span>
          {#if !cellProgress.finished}<span>ETA {cellEta}</span>{/if}
        </div>
        <div class="tally">
          <span class="failed">{cellProgress.failed} failed</span>
        </div>
        {#if cellProgress.current && !cellProgress.finished}
          <div class="current">{cellProgress.current}</div>
        {/if}
        {#if cellProgress.finished}
          <div class="done">
            {cellProgress.cancelled ? "Cancelled" : "Done"} — cells live in the
            cloud store; /q probes find them immediately (no manifest step).
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  .warm-page {
    min-height: 100vh;
    padding: 2rem;
    color: var(--theme-text);
    background: var(--theme-app-bg, #16213e);
  }
  .header {
    margin-bottom: 1.5rem;
  }
  .section-gap {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }
  .header h1 {
    margin: 0;
    font-size: 1.75rem;
  }
  .subtitle {
    color: var(--theme-text-dim);
    margin-top: 0.5rem;
    max-width: 60ch;
  }
  code {
    font-family: var(--font-mono, monospace);
    background: var(--theme-card-bg);
    padding: 0.1em 0.4em;
    border-radius: 4px;
  }
  .gate {
    padding: 2rem;
    text-align: center;
    color: var(--theme-text-dim);
  }
  .scope {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 900px;
    margin-bottom: 1.5rem;
  }
  .scope-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .scope-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .scope-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim);
  }
  .scope-actions {
    display: flex;
    gap: 0.5rem;
  }
  .mini {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    color: var(--theme-text);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
    min-height: 44px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .controls {
    margin-bottom: 1.5rem;
  }
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.primary {
    background: var(--theme-accent, #6366f1);
    color: white;
  }
  .btn.danger {
    background: var(--semantic-error, #ef4444);
    color: white;
  }
  .progress {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .bar {
    height: 12px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    transition: width var(--duration-emphasis, 220ms) ease-out;
  }
  .stats {
    display: flex;
    justify-content: space-between;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim);
  }
  .tally {
    display: flex;
    gap: 1rem;
    font-variant-numeric: tabular-nums;
  }
  .tally .new {
    color: var(--semantic-success, #22c55e);
  }
  .tally .cached {
    color: var(--theme-text-dim);
  }
  .tally .failed {
    color: var(--semantic-error, #ef4444);
  }
  .current {
    font-family: var(--font-mono, monospace);
    font-size: 0.85rem;
    color: var(--theme-text-dim);
  }
  .done {
    padding: 0.75rem 1rem;
    background: var(--theme-card-bg);
    border-radius: 8px;
  }
</style>
