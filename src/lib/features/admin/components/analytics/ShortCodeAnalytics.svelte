<!--
  Shortcode Analytics Section

  Lives inside the admin Analytics tab (PostHogDashboard.svelte).
  Shows the history of every choreo card scan: top codes, stale
  candidates, and a live feed of recent scans.

  Data flows:
  - shortcodes collection — single getDocs() sweep (~2.8k docs, <1MB)
  - scanEvents subcollections — per-top-code fetch for sparklines
  - scanEvents collectionGroup — global live feed

  Durability invariant enforced by firestore.rules + ShortCodeManager.
  See docs/superpowers/specs/2026-04-18-shortcode-durability-roadmap.md.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    collection,
    collectionGroup,
    getDocs,
    limit,
    orderBy,
    query,
    where,
  } from "firebase/firestore";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";

  interface ShortCodeRow {
    code: string;
    word: string;
    scanCount: number;
    lastScannedAt: string | null;
    createdAt: string;
    ownerId: string | null;
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

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let totalCodes = $state(0);
  let codesWithScans = $state(0);
  let totalScans = $state(0);
  let topCodes = $state<ShortCodeRow[]>([]);
  let zeroScanCandidates = $state<ShortCodeRow[]>([]);
  let liveFeed = $state<ScanEventRow[]>([]);
  let liveFeedError = $state<string | null>(null);

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  onMount(() => {
    void loadAll();
  });

  async function loadAll() {
    loading = true;
    loadError = null;
    try {
      const firestore = await getFirestoreInstance();
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

      totalScans = all.reduce((sum, r) => sum + r.scanCount, 0);
      codesWithScans = all.filter((r) => r.scanCount > 0).length;

      topCodes = all
        .filter((r) => r.scanCount > 0)
        .sort((a, b) => b.scanCount - a.scanCount)
        .slice(0, 50);

      const staleCutoff = Date.now() - THIRTY_DAYS_MS;
      zeroScanCandidates = all
        .filter((r) => {
          if (r.scanCount !== 0) return false;
          const created = Date.parse(r.createdAt);
          return Number.isFinite(created) && created < staleCutoff;
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      void hydrateSparklines(topCodes);
      void loadLiveFeed();
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  async function hydrateSparklines(rows: ShortCodeRow[]) {
    const firestore = await getFirestoreInstance();
    const cutoffIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    await Promise.all(
      rows.map(async (row) => {
        try {
          const eventsRef = collection(firestore, "shortcodes", row.code, "scanEvents");
          const eventsSnap = await getDocs(
            query(eventsRef, where("timestamp", ">=", cutoffIso))
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
          topCodes = [...topCodes];
        } catch {
          // silent per-row
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
      liveFeedError = err instanceof Error ? err.message : String(err);
    }
  }

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

  function formatNumber(n: number): string {
    return n.toLocaleString();
  }

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

<section class="section" aria-labelledby="shortcodes-title">
  <h3 id="shortcodes-title" class="section-title">
    <i class="fas fa-qrcode" aria-hidden="true"></i>
    Choreo Card Scans
    <span class="section-subtitle">(every QR scan, every print, every world city)</span>
  </h3>

  {#if loading}
    <div class="loading-inline">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading shortcode data…
    </div>
  {:else if loadError}
    <div class="error-box">Failed to load: {loadError}</div>
  {:else}
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">{formatNumber(totalCodes)}</div>
        <div class="metric-label">Durable codes</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{formatNumber(totalScans)}</div>
        <div class="metric-label">Total scans</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{formatNumber(codesWithScans)}</div>
        <div class="metric-label">Codes scanned ≥1×</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">
          {#if topCodes.length > 0 && topCodes[0]?.lastScannedAt}
            {formatRelative(topCodes[0].lastScannedAt)}
          {:else}
            never
          {/if}
        </div>
        <div class="metric-label">Most recent scan</div>
      </div>
    </div>

    <!-- Top 50 -->
    <div class="subsection">
      <h4 class="subsection-title">
        <i class="fas fa-fire" aria-hidden="true"></i>
        Top {topCodes.length} by scan count
      </h4>
      {#if topCodes.length === 0}
        <p class="empty">No codes have been scanned yet. Telemetry was just wired — check back after your first scan.</p>
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
    </div>

    <!-- Zero-scan stale -->
    <div class="subsection">
      <h4 class="subsection-title">
        <i class="fas fa-hourglass-end" aria-hidden="true"></i>
        Deletion candidates — zero scans, {zeroScanCandidates.length} older than 30 days
      </h4>
      {#if zeroScanCandidates.length === 0}
        <p class="empty">No stale zero-scan codes.</p>
      {:else}
        <p class="note">
          Durable codes that nobody has scanned in 30+ days. Cleanup candidates — <strong>do not delete</strong> without confirming they weren't printed on a physical card.
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
    </div>

    <!-- Live feed -->
    <div class="subsection">
      <h4 class="subsection-title">
        <i class="fas fa-signal" aria-hidden="true"></i>
        Live feed — last 100 scans
      </h4>
      {#if liveFeedError}
        <div class="error-box">
          <strong>Live feed unavailable.</strong> A Firestore collection-group index on <code>scanEvents.timestamp</code> is required.
          <pre>{liveFeedError}</pre>
          Deploy <code>firestore.indexes.json</code> to fix.
        </div>
      {:else if liveFeed.length === 0}
        <p class="empty">No scan events yet. They will appear here as cards get scanned in the wild.</p>
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
    </div>
  {/if}
</section>

<style>
  .subsection {
    margin-top: 24px;
  }

  .subsection-title {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e8e8e8);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .subsection-title i {
    color: var(--text-secondary, #888);
    font-size: 13px;
  }

  .loading-inline {
    padding: 12px 0;
    color: var(--text-secondary, #888);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .empty,
  .note {
    color: var(--text-secondary, #888);
    font-size: 13px;
    padding: 8px 0;
    margin: 0 0 8px 0;
  }

  .note strong {
    color: var(--text-primary, #e8e8e8);
  }

  .error-box {
    background: rgba(220, 60, 60, 0.08);
    border: 1px solid rgba(220, 60, 60, 0.3);
    color: #ff9090;
    padding: 12px 14px;
    border-radius: 6px;
    font-size: 13px;
  }

  .error-box pre {
    margin: 8px 0 0 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 11px;
    color: #ffc8c8;
  }

  .table-scroll {
    overflow-x: auto;
    border-radius: 6px;
    border: 1px solid var(--panel-border, rgba(255, 255, 255, 0.08));
    background: var(--panel-bg, rgba(255, 255, 255, 0.02));
  }

  .table-scroll.small {
    max-height: 360px;
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
    padding: 8px 12px;
    border-bottom: 1px solid var(--panel-border, rgba(255, 255, 255, 0.06));
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  th {
    font-weight: 600;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary, #888);
    background: var(--panel-header-bg, rgba(255, 255, 255, 0.03));
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
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  svg.spark {
    width: 80px;
    height: 20px;
    color: var(--theme-accent, #f97316);
    display: block;
  }
</style>
