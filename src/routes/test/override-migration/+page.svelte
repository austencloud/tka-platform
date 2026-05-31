<script lang="ts">
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import {
    runOverrideMigration,
    type MigrationReport,
    type MigrationRow,
  } from "$lib/features/admin/override-migration/services/override-migration";
  import { setGlobalReadDisabled } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";

  // ── Admin gate ────────────────────────────────────────────────────────────
  const ADMIN_EMAIL = "austencloud@gmail.com";
  const isAdmin = $derived(authState.user?.email === ADMIN_EMAIL);

  // ── State ─────────────────────────────────────────────────────────────────
  let running = $state(false);
  let report = $state<MigrationReport | null>(null);
  let error = $state<string | null>(null);
  let lastRunWasDryRun = $state(false);
  let successMessage = $state<string | null>(null);

  // Second-press "arm" pattern for Migrate button
  let migrateArmed = $state(false);
  let migrateArmTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  // Verify Render toggle (Global OFF)
  let globalOff = $state(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const canMigrate = $derived(
    !!report && report.fail === 0 && report.staged > 0 && lastRunWasDryRun
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleDryRun() {
    running = true;
    error = null;
    successMessage = null;
    migrateArmed = false;
    report = null;
    lastRunWasDryRun = false;
    try {
      report = await runOverrideMigration({ dryRun: true });
      lastRunWasDryRun = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      running = false;
    }
  }

  async function handleMigrate() {
    if (!canMigrate) return;

    if (!migrateArmed) {
      // First press: arm it
      migrateArmed = true;
      if (migrateArmTimer) clearTimeout(migrateArmTimer);
      // Auto-disarm after 8 seconds so a stale arm doesn't linger
      migrateArmTimer = setTimeout(() => {
        migrateArmed = false;
        migrateArmTimer = null;
      }, 8000);
      return;
    }

    // Second press: execute the write
    if (migrateArmTimer) {
      clearTimeout(migrateArmTimer);
      migrateArmTimer = null;
    }
    migrateArmed = false;

    running = true;
    error = null;
    successMessage = null;
    try {
      const writeReport = await runOverrideMigration({ dryRun: false });
      successMessage = `Migration complete — ${writeReport.staged} records written to Firestore.`;
      report = writeReport;
      lastRunWasDryRun = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      running = false;
    }
  }

  function handleVerifyRender() {
    globalOff = !globalOff;
    setGlobalReadDisabled(globalOff);
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
  }

  function fmtXY(pt: { x: number; y: number }): string {
    return `${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}`;
  }
</script>

<svelte:head><title>Override Migration — Admin</title></svelte:head>

{#if !isAdmin}
  <div class="gate">
    <p>Admin only — sign in as {ADMIN_EMAIL} to access this page.</p>
  </div>
{:else}
  <div class="page">
    <header class="page-header">
      <h1>Override Migration</h1>
      <p class="intro">
        Moves admin-tuned arrow overrides from the legacy <strong>Global</strong> tier into the
        prop-scoped <strong>Special</strong> tier via a parity gate. Nothing is written to Firestore
        until you run a clean dry-run and then press Migrate.
        Route: <a href="/test/override-migration">http://localhost:5173/test/override-migration</a>
      </p>
    </header>

    <!-- Action bar -->
    <div class="action-bar">
      <button
        class="btn btn-primary"
        onclick={handleDryRun}
        disabled={running}
        aria-busy={running}
      >
        {running && lastRunWasDryRun === false ? "Running…" : "Dry Run"}
      </button>

      <button
        class="btn"
        class:btn-danger={migrateArmed}
        class:btn-secondary={!migrateArmed}
        onclick={handleMigrate}
        disabled={!canMigrate || running}
        aria-disabled={!canMigrate || running}
      >
        {#if migrateArmed}
          Click again to write {report?.staged ?? 0} records
        {:else}
          Migrate (write)
        {/if}
      </button>

      <button
        class="btn"
        class:btn-warning={globalOff}
        class:btn-secondary={!globalOff}
        onclick={handleVerifyRender}
      >
        {globalOff ? "Restore (Global ON)" : "Verify Render (Global OFF)"}
      </button>
    </div>

    <!-- Global-OFF warning chip -->
    {#if globalOff}
      <div class="chip-warning" role="status">
        Global read is DISABLED — pictographs are rendering from Special tier only.
        Press "Restore" to re-enable.
      </div>
    {/if}

    <!-- Error banner -->
    {#if error}
      <div class="banner banner-error" role="alert">
        {error}
      </div>
    {/if}

    <!-- Success banner -->
    {#if successMessage}
      <div class="banner banner-success" role="status">
        {successMessage}
      </div>
    {/if}

    <!-- Running indicator -->
    {#if running}
      <div class="banner banner-info" role="status">
        Running migration scan…
      </div>
    {/if}

    <!-- Report -->
    {#if report}
      <!-- Counts header -->
      <div class="counts-row">
        <div class="count-card">
          <span class="count-value">{report.totalArrowsScanned}</span>
          <span class="count-label">Arrows scanned</span>
        </div>
        <div class="count-card">
          <span class="count-value">{report.staged}</span>
          <span class="count-label">Staged</span>
        </div>
        <div class="count-card count-pass">
          <span class="count-value">{report.pass}</span>
          <span class="count-label">Pass</span>
        </div>
        <div class="count-card" class:count-fail={report.fail > 0}>
          <span class="count-value">{report.fail}</span>
          <span class="count-label">Fail</span>
        </div>
      </div>

      <!-- Parity verdict banner -->
      {#if report.fail > 0}
        <div class="banner banner-error" role="alert">
          {report.fail} parity {report.fail === 1 ? "failure" : "failures"} — migration blocked. Do NOT write.
        </div>
      {:else if report.staged > 0}
        <div class="banner banner-success" role="status">
          Parity clean — {report.staged} records ready to migrate.
        </div>
      {:else}
        <div class="banner banner-info" role="status">
          No Global-tier overrides found — nothing to migrate.
        </div>
      {/if}

      <!-- Report table -->
      {#if report.rows.length > 0}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Letter</th>
                <th>Color</th>
                <th>PropType</th>
                <th class="num-col">Value (x, y)</th>
                <th class="num-col">Original (x, y)</th>
                <th>Parity</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {#each report.rows as row (row.key)}
                <tr class:row-fail={row.parity === "fail"}>
                  <td>{row.letter}</td>
                  <td>
                    <span class="color-dot" style:background={row.arrowColor === "blue" ? "#60a5fa" : "#f87171"}></span>
                    {row.arrowColor}
                  </td>
                  <td>{row.propType}</td>
                  <td class="num-col tabular">{fmtXY(row.value)}</td>
                  <td class="num-col tabular">{fmtXY(row.original)}</td>
                  <td>
                    {#if row.parity === "pass"}
                      <span class="badge badge-pass">✓ pass</span>
                    {:else}
                      <span class="badge badge-fail">✗ fail</span>
                    {/if}
                  </td>
                  <td class="note-col">{row.note ?? ""}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  /* ── Layout ── */
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    color: var(--theme-text, #f0f0f0);
    font-family: inherit;
  }

  .gate {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    color: var(--theme-text-dim, #888);
    font-size: 1rem;
  }

  /* ── Header ── */
  .page-header {
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: var(--theme-text, #f0f0f0);
  }

  .intro {
    color: var(--theme-text-dim, #888);
    font-size: 0.9rem;
    line-height: 1.6;
    margin: 0;
  }

  .intro a {
    color: var(--theme-accent, #8b5cf6);
    text-decoration: none;
  }

  .intro a:hover {
    text-decoration: underline;
  }

  /* ── Action bar ── */
  .action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target, 44px);
    padding: 0 1.25rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s, background 0.15s;
    white-space: nowrap;
  }

  .btn:disabled,
  .btn[aria-disabled="true"] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--theme-accent, #8b5cf6);
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 85%, white);
  }

  .btn-secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.07));
    color: var(--theme-text, #f0f0f0);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
  }

  .btn-danger {
    background: var(--semantic-error, #ef4444);
    color: #fff;
  }

  .btn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 85%, white);
  }

  .btn-warning {
    background: var(--semantic-warning, #f59e0b);
    color: #000;
  }

  .btn-warning:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 85%, white);
  }

  /* ── Chips ── */
  .chip-warning {
    display: inline-block;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 20%, transparent);
    border: 1px solid var(--semantic-warning, #f59e0b);
    color: var(--semantic-warning, #f59e0b);
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 1.25rem;
  }

  /* ── Banners ── */
  .banner {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 1rem;
    border: 1px solid transparent;
  }

  .banner-error {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border-color: var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
    font-weight: 700;
  }

  .banner-success {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
    border-color: var(--semantic-success, #22c55e);
    color: var(--semantic-success, #22c55e);
  }

  .banner-info {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text-dim, #888);
  }

  /* ── Counts row ── */
  .counts-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .count-card {
    flex: 1;
    min-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    gap: 0.25rem;
  }

  .count-value {
    font-size: 2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #f0f0f0);
  }

  .count-label {
    font-size: 0.75rem;
    color: var(--theme-text-dim, #888);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .count-pass .count-value {
    color: var(--semantic-success, #22c55e);
  }

  .count-fail .count-value {
    color: var(--semantic-error, #ef4444);
  }

  /* ── Table ── */
  .table-wrap {
    overflow-x: auto;
    max-height: 65vh;
    overflow-y: auto;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-top: 0.5rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    color: var(--theme-text, #f0f0f0);
  }

  thead {
    position: sticky;
    top: 0;
    background: var(--theme-panel-bg, #1a1a2e);
    z-index: 1;
  }

  th {
    padding: 0.6rem 0.9rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, #888);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    white-space: nowrap;
  }

  td {
    padding: 0.5rem 0.9rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: rgba(255, 255, 255, 0.03);
  }

  .row-fail td {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 6%, transparent);
  }

  .num-col {
    text-align: right;
  }

  .tabular {
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
  }

  .note-col {
    color: var(--theme-text-dim, #888);
    font-size: 0.8rem;
    max-width: 240px;
    word-break: break-word;
  }

  /* ── Badges ── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .badge-pass {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 18%, transparent);
    color: var(--semantic-success, #22c55e);
  }

  .badge-fail {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 18%, transparent);
    color: var(--semantic-error, #ef4444);
  }

  /* ── Color dot ── */
  .color-dot {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
</style>
