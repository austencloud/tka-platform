<!--
  Admin Shortcodes Dashboard

  Three-panel view of the shortcodes collection:
  1. Top 50 codes by scan count (with 30-day daily sparklines)
  2. Deletion candidates — scanCount == 0 AND created > 30 days ago
  3. Live feed — last 100 scanEvents across every code (collectionGroup)

  Auth is handled by src/routes/admin/+layout.ts (client-side redirect for
  non-admins). This page trusts the gate — no redundant checks.

  Data source: direct Firebase SDK queries. No service wrapper — this is
  read-only internal tooling. See the shortcode durability roadmap at
  docs/superpowers/specs/2026-04-18-shortcode-durability-roadmap.md.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
    Timestamp,
  } from "firebase/firestore";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import Panel from "$lib/shared/panels/Panel.svelte";

  // ---- Types -----------------------------------------------------------------

  interface ShortCodeRow {
    code: string;
    word: string;
    scanCount: number;
    lastScannedAt: string | null;
    createdAt: string;
    ownerId: string | null;
    /** 30 daily buckets, newest last. Filled lazily. */
    sparkline: number[] | null;
  }

  interface ScanEventRow {
    code: string;
    timestamp: string;
    userAgent: string;
    referrer: string | null;
    country: string | null;
    city: string | null;
  }

  // ---- State -----------------------------------------------------------------

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let totalCodes = $state(0);
  let topCodes = $state<ShortCodeRow[]>([]);
  let zeroScanCandidates = $state<ShortCodeRow[]>([]);
  let liveFeed = $state<ScanEventRow[]>([]);
  let liveFeedError = $state<string | null>(null);

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // ---- Fetch -----------------------------------------------------------------

  onMount(() => {
    void loadAll();
  });

  async function loadAll() {
    loading = true;
    loadError = null;
    try {
      const firestore = await getFirestoreInstance();

      // Single sweep of the collection. At ~2.8k docs and ~200B each, this is
      // well under 1MB — cheaper than two separate indexed queries and
      // avoids the composite-index requirement for the zero-scan-old filter.
      const allSnap = await getDocs(collection(firestore, "shortcodes"));
      totalCodes = allSnap.size;

      const all: ShortCodeRow[] = allSnap.docs.map((d) => {
        const data = d.data();
        return {
          code: d.id,
          word: typeof data.sequence === "string" ? data.sequence : "",
          scanCount: typeof data.scanCount === "number" ? data.scanCount : 0,
          lastScannedAt: typeof data.lastScannedAt === "string" ? data.lastScannedAt : null,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
          ownerId: typeof data.ownerId === "string" ? data.ownerId : null,
          sparkline: null,
        };
      });

      // Top 50 by scan count.
      topCodes = all
        .filter((r) => r.scanCount > 0)
        .sort((a, b) => b.scanCount - a.scanCount)
        .slice(0, 50);

      // Deletion candidates: zero scans, older than 30 days. Show oldest first.
      const staleCutoff = Date.now() - THIRTY_DAYS_MS;
      zeroScanCandidates = all
        .filter((r) => {
          if (r.scanCount !== 0) return false;
          const created = Date.parse(r.createdAt);
          return Number.isFinite(created) && created < staleCutoff;
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      // Fetch sparklines in parallel for the top codes. Failures are per-row,
      // not fatal for the page.
      void hydrateSparklines(topCodes);

      // Live feed via collectionGroup. If the index is missing the query
      // throws; we surface that as a soft error and tell the admin how to
      // fix it. Don't let it take out the whole page.
      void loadLiveFeed();
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  async function hydrateSparklines(rows: ShortCodeRow[]) {
    const firestore = await getFirestoreInstance();
    const cutoff = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);
    await Promise.all(
      rows.map(async (row) => {
        try {
          const eventsRef = collection(firestore, "shortcodes", row.code, "scanEvents");
          const eventsSnap = await getDocs(
            query(eventsRef, where("timestamp", ">=", cutoff.toDate().toISOString()))
          );
          const buckets = new Array<number>(30).fill(0);
          for (const d of eventsSnap.docs) {
            const raw = d.data().timestamp;
            const ts = typeof raw === "string" ? Date.parse(raw) : NaN;
            if (!Number.isFinite(ts)) continue;
            const daysAgo = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
            if (daysAgo < 0 || daysAgo >= 30) continue;
            buckets[29 - daysAgo]! += 1;
          }
          row.sparkline = buckets;
          topCodes = [...topCodes]; // retrigger derived rendering
        } catch {
          // Silent per-row failure — sparkline stays null, cell shows "—".
        }
      })
    );
  }

  async function loadLiveFeed() {
    try {
      const firestore = await getFirestoreInstance();
      const q = query(
        collectionGroup(firestore, "scanEvents"),
        orderBy("timestamp", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      liveFeed = snap.docs.map((d) => {
        const data = d.data();
        const parentCode = d.ref.parent.parent?.id ?? "?";
        return {
          code: parentCode,
          timestamp: typeof data.timestamp === "string" ? data.timestamp : "",
          userAgent: typeof data.userAgent === "string" ? data.userAgent : "",
          referrer: typeof data.referrer === "string" ? data.referrer : null,
          country: typeof data.country === "string" ? data.country : null,
          city: typeof data.city === "string" ? data.city : null,
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Firestore surfaces the console link in the error message when an
      // index is missing — surface it verbatim so the admin can one-click
      // create it.
      liveFeedError = msg;
    }
  }

  // ---- Formatters ------------------------------------------------------------

  function formatRelative(iso: string | null): string {
    if (!iso) return "never";
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return "—";
    const diff = Date.now() - ms;
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  }

  function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  }

  function truncateUA(ua: string): string {
    if (ua.length <= 40) return ua;
    return ua.slice(0, 37) + "…";
  }

  // ---- Sparkline -------------------------------------------------------------

  function sparklinePath(values: number[]): string {
    if (values.length === 0) return "";
    const max = Math.max(1, ...values);
    const W = 80;
    const H = 20;
    const step = W / (values.length - 1 || 1);
    return values
      .map((v, i) => {
        const x = i * step;
        const y = H - (v / max) * H;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }
</script>

<svelte:head>
  <title>Admin — Shortcodes</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <h1>Shortcodes</h1>
    <p class="subtitle">
      {totalCodes.toLocaleString()} total durable codes · Wave 1 durability invariant active
    </p>
  </header>

  {#if loading}
    <div class="loading">Loading…</div>
  {:else if loadError}
    <div class="error">Failed to load shortcodes: {loadError}</div>
  {:else}
    <Panel title={`Top ${topCodes.length} by scan count`}>
      {#if topCodes.length === 0}
        <p class="empty">No codes have been scanned yet. Telemetry was just wired — check back tomorrow.</p>
      {:else}
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Word</th>
                <th class="num">Scans</th>
                <th>Last scan</th>
                <th>Created</th>
                <th>Owner</th>
                <th>Last 30d</th>
              </tr>
            </thead>
            <tbody>
              {#each topCodes as row (row.code)}
                <tr>
                  <td><code>{row.code}</code></td>
                  <td class="word">{row.word || "—"}</td>
                  <td class="num">{row.scanCount.toLocaleString()}</td>
                  <td>{formatRelative(row.lastScannedAt)}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td class="muted">{row.ownerId ? row.ownerId.slice(0, 8) + "…" : "—"}</td>
                  <td>
                    {#if row.sparkline}
                      <svg
                        class="spark"
                        viewBox="0 0 80 20"
                        preserveAspectRatio="none"
                        aria-label={`Daily scans for ${row.code} over the last 30 days`}
                      >
                        <path d={sparklinePath(row.sparkline)} fill="none" stroke="currentColor" stroke-width="1.2" />
                      </svg>
                    {:else}
                      <span class="muted">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Panel>

    <Panel title={`Deletion candidates — zero scans, created > 30 days ago (${zeroScanCandidates.length})`}>
      {#if zeroScanCandidates.length === 0}
        <p class="empty">No stale zero-scan codes.</p>
      {:else}
        <p class="note">
          These codes are durable (they have an <code>encoded</code> payload) but nobody has scanned them in 30+ days.
          Candidates for future cleanup — <strong>do not delete</strong> without confirming they weren't printed on a card.
        </p>
        <div class="table-scroll small">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Word</th>
                <th>Created</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {#each zeroScanCandidates.slice(0, 200) as row (row.code)}
                <tr>
                  <td><code>{row.code}</code></td>
                  <td class="word">{row.word || "—"}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td class="muted">{row.ownerId ? row.ownerId.slice(0, 8) + "…" : "—"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if zeroScanCandidates.length > 200}
            <p class="note">Showing first 200 of {zeroScanCandidates.length}.</p>
          {/if}
        </div>
      {/if}
    </Panel>

    <Panel title="Live feed — last 100 scans">
      {#if liveFeedError}
        <div class="error">
          <strong>Live feed unavailable.</strong> A Firestore collection-group index on <code>scanEvents.timestamp</code> is required. Firestore's error includes a one-click creation URL:
          <pre>{liveFeedError}</pre>
          Alternatively, deploy <code>firestore.indexes.json</code>.
        </div>
      {:else if liveFeed.length === 0}
        <p class="empty">No scan events yet. Telemetry just started — scans will appear here as they happen.</p>
      {:else}
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Code</th>
                <th>Location</th>
                <th>Referrer</th>
                <th>User agent</th>
              </tr>
            </thead>
            <tbody>
              {#each liveFeed as evt, i (i)}
                <tr>
                  <td>{formatRelative(evt.timestamp)}</td>
                  <td><code>{evt.code}</code></td>
                  <td>
                    {#if evt.city || evt.country}
                      {[evt.city, evt.country].filter(Boolean).join(", ")}
                    {:else}
                      <span class="muted">—</span>
                    {/if}
                  </td>
                  <td class="muted">{evt.referrer ?? "—"}</td>
                  <td class="muted ua">{truncateUA(evt.userAgent)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Panel>
  {/if}
</div>

<style>
  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--text-primary, #e8e8e8);
  }

  .page-header h1 {
    margin: 0 0 4px 0;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .subtitle {
    margin: 0;
    color: var(--text-secondary, #888);
    font-size: 14px;
  }

  .loading,
  .empty,
  .note {
    color: var(--text-secondary, #888);
    padding: 16px;
    font-size: 14px;
  }

  .note strong {
    color: var(--text-primary, #e8e8e8);
  }

  .error {
    background: rgba(220, 60, 60, 0.1);
    border: 1px solid rgba(220, 60, 60, 0.35);
    color: #ff9090;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
  }

  .error pre {
    margin: 8px 0 0 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    color: #ffc8c8;
  }

  .table-scroll {
    overflow-x: auto;
    margin: 0 -12px;
    padding: 0 12px;
  }

  .table-scroll.small {
    max-height: 400px;
    overflow-y: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th,
  td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--panel-border, rgba(255, 255, 255, 0.08));
  }

  th {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary, #888);
    background: var(--panel-header-bg, rgba(255, 255, 255, 0.02));
    position: sticky;
    top: 0;
  }

  td.num,
  th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  td.word {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 12px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  td code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 12px;
    background: var(--panel-header-bg, rgba(255, 255, 255, 0.06));
    padding: 2px 6px;
    border-radius: 3px;
  }

  .muted {
    color: var(--text-secondary, #888);
  }

  .ua {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  svg.spark {
    width: 80px;
    height: 20px;
    color: var(--theme-accent, #6366f1);
    display: block;
  }
</style>
