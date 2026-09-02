<!--
  Gallery Thumbnail Warm — full-control page.

  Renders + uploads the selected scope of gallery thumbnails through the REAL
  ThumbnailRenderOrchestrator (zero parity risk), warming the shared cloud cache
  so cold-cache 404s stop. The AdminToolbar "Warm Gallery (lean)" button runs a
  fixed staff + fan/dark/QR subset; this page exposes the full prop × mode × QR matrix
  for a deliberate leave-it-running pass.

  Not an admin route. The Storage rules for thumbnails/ and pictograph-cells/
  accept any authenticated writer, anonymous guests included, so the page mints
  a guest identity on mount and only needs that. It used to live under /admin,
  whose layout guard bounced every non-admin session (including the in-app
  browser pane) to the home page before the tool could render.

  After a run, index + bundle the results (credentialed, outside the browser):
    npm run thumbnails:manifest
    npm run thumbnails:sync

  Spec: docs/superpowers/specs/active/2026-07-02-gallery-thumbnail-warm-pass-design.md
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    PROP_PICKER_SECTIONS,
    getPropTypeDisplayInfo,
    isPropActive,
  } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
  import { getAuthInstance } from "$lib/shared/auth/firebase";
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
  import { growFade } from "$lib/shared/transitions/motion";

  // Every prop a visitor can actually pick, kept in picker sections so the page
  // reads like the picker instead of one undifferentiated wall of chips.
  // Deactivated props are hidden from pickers, so nobody can browse the gallery
  // with them; skip them. Bare hands has no picker section of its own.
  const PROP_SECTIONS: { label: string; props: PropType[] }[] = [
    ...PROP_PICKER_SECTIONS.map((section) => ({
      label: section.label,
      props: section.props.filter(isPropActive),
    })),
    { label: "Hands", props: [PropType.HAND] },
  ].filter((section) => section.props.length > 0);

  const ALL_PROPS: PropType[] = PROP_SECTIONS.flatMap(
    (section) => section.props
  ).filter((prop, index, list) => list.indexOf(prop) === index);

  const propLabel = (prop: PropType) => getPropTypeDisplayInfo(prop).label;

  // Uploads need request.auth != null. Anonymous is enough, so mint it here
  // and report the resolved state; the write site re-checks on its own.
  let identityState = $state<"pending" | "ready" | "unavailable">("pending");
  onMount(() => {
    // Standalone surface: no module ever reports boot completion here, so the
    // app.html splash would sit over the page until its safety timeout.
    (
      window as unknown as {
        __tkaLoadProgress?: (percent: number, message: string) => void;
      }
    ).__tkaLoadProgress?.(100, "Ready");
    void (async () => {
      await ensureGuestIdentity("thumbnail_upload");
      const auth = await getAuthInstance();
      await auth.authStateReady();
      identityState = auth.currentUser ? "ready" : "unavailable";
    })();
  });

  // Scope selection — lean defaults (matches the observed cold set).
  let selectedProps = $state<Set<PropType>>(
    new Set([PropType.STAFF, PropType.FAN])
  );
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
  function selectStaffAndFan() {
    selectedProps = new Set([PropType.STAFF, PropType.FAN]);
    darkMode = true;
    lightMode = false;
    noQr = true;
    qr = true;
  }
  function clearProps() {
    selectedProps = new Set();
  }

  const scope = $derived<WarmScope>({
    props: ALL_PROPS.filter((p) => selectedProps.has(p)),
    modes: [
      ...(darkMode ? (["dark"] as const) : []),
      ...(lightMode ? (["light"] as const) : []),
    ],
    qr: [...(noQr ? [false] : []), ...(qr ? [true] : [])],
  });

  const scopeValid = $derived(
    scope.props.length > 0 && scope.modes.length > 0 && scope.qr.length > 0
  );
  const rendersPerSequence = $derived(
    scope.props.length * scope.modes.length * scope.qr.length
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
  <div class="shell">
    <header class="page-head">
      <p class="eyebrow">Cache tools</p>
      <h1>Thumbnail warm</h1>
      <p class="lede">
        Render and upload through the real renderer to warm the shared cloud
        cache, so cold visitors get images instead of a slow client-side
        rasterize.
      </p>
      <p class="identity" data-state={identityState}>
        <span class="dot"></span>
        {identityState === "pending"
          ? "Signing in as a guest writer…"
          : identityState === "ready"
            ? "Guest writer ready — uploads will be accepted"
            : "Sign-in unavailable — uploads would be rejected"}
      </p>
    </header>

    {#if identityState === "unavailable"}
      <div class="gate">
        <h2>Uploads are blocked</h2>
        <p>
          Anonymous auth looks disabled for this Firebase project. Enable it,
          then reload this page.
        </p>
      </div>
    {:else}
      <div class="jobs">
        <section class="card gallery">
          <div class="card-head">
            <h2>Gallery thumbnails</h2>
            <p>
              Every selected prop × mode × QR combination for each gallery
              sequence, written to <code>thumbnails/</code>.
            </p>
          </div>

          <div class="card-body">
            <div class="group">
              <div class="group-head">
                <span class="group-label">Props</span>
                <div class="group-actions">
                  <span class="group-count"
                    >{scope.props.length} of {ALL_PROPS.length}</span
                  >
                  <button type="button" class="mini" onclick={selectStaffAndFan}
                    >Lean preset</button
                  >
                  <button type="button" class="mini" onclick={selectAllProps}
                    >All</button
                  >
                  <button
                    type="button"
                    class="mini"
                    onclick={clearProps}
                    disabled={scope.props.length === 0}>None</button
                  >
                </div>
              </div>
              <div class="prop-sections">
                {#each PROP_SECTIONS as section (section.label)}
                  <div class="prop-section">
                    <span class="sub-label">{section.label}</span>
                    <div class="chips">
                      {#each section.props as prop (prop)}
                        <FilterChipBase
                          label={propLabel(prop)}
                          mode="toggle"
                          size="sm"
                          active={selectedProps.has(prop)}
                          onclick={() => toggleProp(prop)}
                        />
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <div class="group-row">
              <div class="group">
                <div class="group-head">
                  <span class="group-label">Mode</span>
                </div>
                <div class="chips">
                  <FilterChipBase
                    label="Dark"
                    mode="toggle"
                    size="sm"
                    active={darkMode}
                    onclick={() => (darkMode = !darkMode)}
                  />
                  <FilterChipBase
                    label="Light"
                    mode="toggle"
                    size="sm"
                    active={lightMode}
                    onclick={() => (lightMode = !lightMode)}
                  />
                </div>
              </div>

              <div class="group">
                <div class="group-head">
                  <span class="group-label">QR</span>
                </div>
                <div class="chips">
                  <FilterChipBase
                    label="No QR"
                    mode="toggle"
                    size="sm"
                    active={noQr}
                    onclick={() => (noQr = !noQr)}
                  />
                  <FilterChipBase
                    label="QR"
                    mode="toggle"
                    size="sm"
                    active={qr}
                    onclick={() => (qr = !qr)}
                  />
                </div>
              </div>

              <div class="group">
                <div class="group-head">
                  <span class="group-label">Pool</span>
                </div>
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
            </div>
          </div>

          <footer class="card-foot">
            <p class="summary" class:invalid={!scopeValid}>
              {#if scopeValid}
                <strong>{rendersPerSequence}</strong> renders per sequence —
                {scope.props.length}
                {scope.props.length === 1 ? "prop" : "props"} ×
                {scope.modes.length}
                {scope.modes.length === 1 ? "mode" : "modes"} ×
                {scope.qr.length}
                QR {scope.qr.length === 1 ? "variant" : "variants"}
              {:else}
                Pick at least one prop, one mode and one QR variant.
              {/if}
            </p>
            {#if !isRunning}
              <button
                type="button"
                class="btn primary"
                onclick={start}
                disabled={!scopeValid}
              >
                Start warm
              </button>
            {:else}
              <button type="button" class="btn danger" onclick={cancel}
                >Stop</button
              >
            {/if}
          </footer>

          {#if progress}
            <section class="progress" transition:growFade>
              <div class="bar">
                <div class="fill" style:width="{percent}%"></div>
              </div>
              <div class="stats">
                <span
                  >{progress.done.toLocaleString()} / {progress.total.toLocaleString()}
                  ({percent}%)</span
                >
                <span class="eta">{progress.finished ? "" : `ETA ${eta}`}</span>
              </div>
              <div class="tally">
                <span class="new">{progress.rendered} new</span>
                <span class="cached">{progress.skipped} cached</span>
                <span class="failed">{progress.failed} failed</span>
              </div>
              {#if progress.current && !progress.finished}
                <div class="current">{progress.current}</div>
              {/if}
              {#if progress.failedCombinations.length > 0}
                <details class="failure-details">
                  <summary>
                    {progress.failedCombinations.length} failed {progress
                      .failedCombinations.length === 1
                      ? "combination"
                      : "combinations"}
                  </summary>
                  <ul>
                    {#each progress.failedCombinations as combination}
                      <li>{combination}</li>
                    {/each}
                  </ul>
                </details>
              {/if}
              {#if progress.finished}
                <div class="done">
                  {progress.cancelled ? "Cancelled" : "Done"} — now run the index
                  and bundle steps listed beside this card.
                </div>
              {/if}
            </section>
          {/if}
        </section>

        <div class="side">
          <section class="card">
            <div class="card-head">
              <h2>Scan-card cells</h2>
              <p>
                Per-pictograph cells (<code>pictograph-cells/</code>) for every
                durable QR shortcode, so /q scanners download images instead of
                rasterizing. Resolves each card's exact left/right props and
                verifies both light and dark assets.
              </p>
            </div>

            <footer class="card-foot">
              <p class="summary">All QR codes, light and dark</p>
              {#if !cellRunning}
                <button type="button" class="btn primary" onclick={startCells}>
                  Start cell warm
                </button>
              {:else}
                <button type="button" class="btn danger" onclick={cancelCells}
                  >Stop</button
                >
              {/if}
            </footer>

            {#if cellProgress}
              <section class="progress" transition:growFade>
                <div class="bar">
                  <div class="fill" style:width="{cellPercent}%"></div>
                </div>
                <div class="stats">
                  <span
                    >{cellProgress.done.toLocaleString()} / {cellProgress.total.toLocaleString()}
                    ({cellPercent}%)</span
                  >
                  <span class="eta"
                    >{cellProgress.finished ? "" : `ETA ${cellEta}`}</span
                  >
                </div>
                <div class="tally">
                  <span class="failed">{cellProgress.failed} failed</span>
                </div>
                {#if cellProgress.current && !cellProgress.finished}
                  <div class="current">{cellProgress.current}</div>
                {/if}
                {#if cellProgress.finished}
                  <div class="done">
                    {cellProgress.cancelled ? "Cancelled" : "Done"} — cells live in
                    the cloud store; /q probes find them immediately (no manifest
                    step).
                  </div>
                {/if}
              </section>
            {/if}
          </section>

          <section class="card after">
            <div class="card-head">
              <h2>After a gallery run</h2>
              <p>
                Run these outside the browser — they need credentials the page
                does not have.
              </p>
            </div>
            <ol class="steps">
              <li><code>npm run thumbnails:manifest</code></li>
              <li><code>npm run thumbnails:sync</code></li>
            </ol>
            <p class="note">
              The cell warm needs neither step; those assets are found by probe.
            </p>
          </section>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .warm-page {
    min-height: 100vh;
    padding: clamp(1.25rem, 3vw, 3rem) clamp(1rem, 3vw, 2.5rem)
      clamp(3rem, 6vw, 5rem);
    color: var(--theme-text);
    background: var(--theme-app-bg, #16213e);
  }
  .shell {
    /* The authored composition band; grows with the canvas at 4K instead of
       stranding the tool in an island. */
    width: min(100%, var(--shell-w, 1440px));
    margin-inline: auto;
  }

  /* ── Header ── */
  .page-head {
    margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
  }
  .eyebrow {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--theme-text-dim);
  }
  .page-head h1 {
    margin: 0.35rem 0 0;
    font-size: clamp(1.75rem, 3vw, 2.5rem);
    line-height: 1.1;
  }
  .lede {
    margin: 0.6rem 0 0;
    max-width: 62ch;
    color: var(--theme-text-dim);
    font-size: 1rem;
  }
  .identity {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 0 0;
    padding: 0.35rem 0.75rem 0.35rem 0.6rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 999px;
    font-size: 0.85rem;
    color: var(--theme-text-dim);
  }
  .identity .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--theme-text-dim);
  }
  .identity[data-state="ready"] .dot {
    background: var(--semantic-success, #22c55e);
  }
  .identity[data-state="unavailable"] .dot {
    background: var(--semantic-error, #ef4444);
  }

  /* ── Layout ── */
  .jobs {
    display: grid;
    gap: clamp(1rem, 2vw, 1.5rem);
    align-items: start;
  }
  @media (min-width: 1100px) {
    .jobs {
      grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.9fr);
    }
  }
  .side {
    display: grid;
    gap: clamp(1rem, 2vw, 1.5rem);
    align-content: start;
  }

  /* ── Card ── */
  .card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    overflow: hidden;
  }
  .card-head {
    padding: clamp(1rem, 2vw, 1.5rem);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }
  .card-head h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .card-head p {
    margin: 0.4rem 0 0;
    max-width: 62ch;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--theme-text-dim);
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: clamp(1.25rem, 2vw, 1.75rem);
    padding: clamp(1rem, 2vw, 1.5rem);
  }
  .card-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: clamp(0.85rem, 2vw, 1.25rem) clamp(1rem, 2vw, 1.5rem);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: rgba(0, 0, 0, 0.12);
  }
  .summary {
    margin: 0;
    font-size: 0.9rem;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }
  .summary strong {
    color: var(--theme-text);
    font-size: 1.05rem;
  }
  .summary.invalid {
    color: var(--semantic-error, #ef4444);
  }

  /* ── Groups ── */
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .group-row {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(1.25rem, 2vw, 2rem);
  }
  .group-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: 1.75rem;
  }
  .group-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--theme-text-dim);
  }
  .group-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .group-count {
    font-size: 0.8rem;
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
    margin-right: 0.25rem;
  }
  .prop-sections {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .prop-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .sub-label {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    opacity: 0.8;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  /* ── Buttons ── */
  .mini {
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    color: var(--theme-text);
    border-radius: 999px;
    padding: 0 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    min-height: 32px;
    transition: background var(--transition-fast, 120ms) ease;
  }
  .mini:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }
  .mini:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn {
    padding: 0.7rem 1.4rem;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    min-height: 44px;
    transition: filter var(--transition-fast, 120ms) ease;
  }
  .btn:hover:not(:disabled) {
    filter: brightness(1.08);
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

  /* ── Progress ── */
  .progress {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: clamp(1rem, 2vw, 1.5rem);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }
  .bar {
    height: 10px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
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
    gap: 1rem;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim);
  }
  /* Reserve the ETA slot so the finished state does not reflow the row. */
  .eta {
    min-width: 8ch;
    text-align: right;
  }
  .tally {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
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
    font-size: 0.8rem;
    color: var(--theme-text-dim);
    overflow-wrap: anywhere;
  }
  .failure-details {
    color: var(--semantic-error, #ef4444);
    font-size: 0.85rem;
  }
  .failure-details summary {
    cursor: pointer;
    min-height: 32px;
    display: flex;
    align-items: center;
  }
  .failure-details ul {
    max-height: 16rem;
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
    overflow: auto;
    font-family: var(--font-mono, monospace);
  }
  .done {
    padding: 0.7rem 0.9rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    font-size: 0.9rem;
  }

  /* ── After-run steps ── */
  .steps {
    margin: 0;
    padding: clamp(1rem, 2vw, 1.5rem) clamp(1rem, 2vw, 1.5rem) 0 2.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: var(--theme-text-dim);
  }
  .steps code {
    color: var(--theme-text);
  }
  .after .note {
    margin: 0.9rem 0 0;
    padding: 0 clamp(1rem, 2vw, 1.5rem) clamp(1rem, 2vw, 1.5rem);
    font-size: 0.85rem;
    color: var(--theme-text-dim);
  }
  code {
    font-family: var(--font-mono, monospace);
    font-size: 0.85em;
    background: rgba(0, 0, 0, 0.28);
    padding: 0.15em 0.45em;
    border-radius: 5px;
  }

  /* ── Gate ── */
  .gate {
    padding: clamp(2rem, 5vw, 3rem);
    text-align: center;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }
  .gate h2 {
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
  }
  .gate p {
    margin: 0 auto;
    max-width: 48ch;
    color: var(--theme-text-dim);
  }
</style>
