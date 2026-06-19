<script lang="ts">
  import { onMount } from "svelte";
  import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
  import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
  import { loadCatalogs, loadCatalogSequencesPage, getCachedCatalogs } from "$lib/features/choreo-card/services/catalog-loader";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { cachePrimitivePaths } from "../state/mandala-paths-cache.svelte";
  import type { Catalog } from "$lib/features/choreo-card/domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { MandalaPaths, MandalaPalette, SVGPathData } from "$lib/shared/mandala/domain/mandala-types";
  import type { QueryDocumentSnapshot } from "firebase/firestore";

  const stickerState = getStickerLabContext();

  const MONO_PALETTE: MandalaPalette = {
    blueStroke: "#c0b8e8",
    blueFill: "rgba(192, 184, 232, 0.1)",
    redStroke: "#c0b8e8",
    redFill: "rgba(192, 184, 232, 0.1)",
    purpleStroke: "#c0b8e8",
    purpleFill: "rgba(192, 184, 232, 0.1)",
  };

  const COLOR_PALETTE: MandalaPalette = {
    blueStroke: "#3b82f6",
    blueFill: "rgba(59, 130, 246, 0.08)",
    redStroke: "#ef4444",
    redFill: "rgba(239, 68, 68, 0.08)",
    purpleStroke: "#a855f6",
    purpleFill: "rgba(168, 85, 246, 0.08)",
  };

  const FETCH_PAGE = 200;

  // --- Solo prop path extraction ---
  interface SoloEntry {
    paths: SVGPathData[];
    word: string;
    prop: "blue" | "red";
    seq: SequenceData;
    fullPaths: MandalaPaths;
  }

  function extractSolos(seq: SequenceData, paths: MandalaPaths): SoloEntry[] {
    return [
      { paths: paths.blue, word: seq.word ?? seq.id, prop: "blue" as const, seq, fullPaths: paths },
      { paths: paths.red, word: seq.word ?? seq.id, prop: "red" as const, seq, fullPaths: paths },
    ].filter(s => s.paths.length > 0);
  }

  // Render one solo as mono SVG — put solo paths in blue slot
  function renderSolo(solo: SoloEntry, key: string): string {
    const cached = svgCache.get(key);
    if (cached) return cached;
    const asMandala: MandalaPaths = { blue: solo.paths, red: [], purple: [] };
    const svg = renderMandalaSVG(asMandala, {
      size: 300,
      style: "stroke",
      show: "both",
      strokeWidth: 2.5,
      palette: MONO_PALETTE,
    });
    svgCache.set(key, svg);
    return svg;
  }

  // --- Fingerprint: rotation-invariant sample-point matching ---
  function samplePathPoints(d: string): [number, number][] {
    const pts: [number, number][] = [];
    let cx = 0, cy = 0;
    const commands = d.match(/[MC][^MC]*/g);
    if (!commands) return pts;
    for (const cmd of commands) {
      const nums = cmd.slice(1).match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
      if (cmd[0] === "M" && nums.length >= 2) {
        cx = nums[0]!; cy = nums[1]!;
        pts.push([cx, cy]);
      } else if (cmd[0] === "C" && nums.length >= 6) {
        const cp1x = nums[0]!, cp1y = nums[1]!;
        const cp2x = nums[2]!, cp2y = nums[3]!;
        const ex = nums[4]!, ey = nums[5]!;
        for (let t = 0.1; t <= 1.0; t += 0.1) {
          const u = 1 - t;
          const x = u*u*u*cx + 3*u*u*t*cp1x + 3*u*t*t*cp2x + t*t*t*ex;
          const y = u*u*u*cy + 3*u*u*t*cp1y + 3*u*t*t*cp2y + t*t*t*ey;
          pts.push([x, y]);
        }
        cx = ex; cy = ey;
      }
    }
    return pts;
  }

  function subsample(pts: [number, number][], target: number): [number, number][] {
    if (pts.length <= target) return pts;
    const step = (pts.length - 1) / (target - 1);
    const out: [number, number][] = [];
    for (let i = 0; i < target; i++) out.push(pts[Math.round(i * step)]!);
    return out;
  }

  // Fingerprint: radii signature per tip, sorted. Rotation-invariant.
  // Two solos with same radial profile at same sample positions = same shape regardless of rotation.
  function soloFingerprint(solo: SoloEntry): string {
    const tipSigs = solo.paths
      .map(p => {
        const pts = samplePathPoints(p.d);
        const radii = pts.map(([x, y]) => Math.round(Math.sqrt(x * x + y * y)));
        const sub = subsample(radii.map((r, i) => [r, i] as [number, number]), 16)
          .map(([r]) => r);
        return sub.join(",");
      })
      .sort();
    return tipSigs.join("|");
  }

  interface SoloGroup {
    fp: string;
    repSolo: SoloEntry;
    members: SoloEntry[];
  }

  type View =
    | { kind: "catalogs" }
    | { kind: "solos"; catalog: Catalog }
    | { kind: "members"; catalog: Catalog; group: SoloGroup };

  let catalogs = $state<Catalog[]>([]);
  let loading = $state(true);
  let view = $state<View>({ kind: "catalogs" });
  let groups = $state<SoloGroup[]>([]);
  let scanProgress = $state("");
  let loadError = $state<string | null>(null);

  const copiesMap = $derived(
    new Map(stickerState.sheet.stickers.map((s) => [s.primitiveRef.shapeHash, s.copies])),
  );

  onMount(async () => {
    try {
      const cached = getCachedCatalogs();
      if (cached && cached.length > 0) catalogs = cached;
      const fresh = await loadCatalogs();
      catalogs = fresh;
    } catch (err) {
      console.error("Failed to load sticker catalogs", err);
      loadError = "Couldn't load catalogs. Check your connection and try again.";
      toast.error(loadError);
    } finally {
      loading = false;
    }
  });

  async function openCatalog(catalog: Catalog) {
    view = { kind: "solos", catalog };
    groups = [];
    scanProgress = "Loading...";

    const groupMap = new Map<string, SoloGroup>();
    let lastDoc: QueryDocumentSnapshot | null = null;
    let hasMore = true;
    let loaded = 0;

    while (hasMore) {
      const page = await loadCatalogSequencesPage(catalog.id, FETCH_PAGE, lastDoc ?? undefined);
      for (const seq of page.sequences) {
        if (!seq.steps || seq.steps.length === 0) continue;
        const paths = calculateMandalaGeometry(seq.steps, "staff", "staff");
        const solos = extractSolos(seq, paths);
        for (const solo of solos) {
          const fp = soloFingerprint(solo);
          const existing = groupMap.get(fp);
          if (existing) {
            existing.members.push(solo);
          } else {
            groupMap.set(fp, { fp, repSolo: solo, members: [solo] });
          }
        }
      }
      loaded += page.sequences.length;
      scanProgress = `${loaded} sequences, ${groupMap.size} solo shapes`;
      groups = [...groupMap.values()].sort((a, b) => b.members.length - a.members.length);
      lastDoc = page.lastDoc;
      hasMore = page.sequences.length === FETCH_PAGE;
      await new Promise((r) => setTimeout(r, 0));
    }
    scanProgress = "";
  }

  function openMembers(group: SoloGroup, catalog: Catalog) {
    view = { kind: "members", catalog, group };
  }

  function addToSheet(seq: SequenceData, paths: MandalaPaths) {
    cachePrimitivePaths(seq.id, paths);
    stickerState.addPrimitive({
      shapeHash: seq.id,
      ultraHash: seq.id,
      sourceLoop: {
        sequenceId: seq.id,
        word: seq.word ?? seq.id,
        loopType: "rotated",
      },
      displayName: seq.word ?? seq.id,
    });
  }

  const svgCache = new Map<string, string>();

  function renderCombined(seq: SequenceData): { svg: string; paths: MandalaPaths } | null {
    const key = `c_${seq.id}`;
    const cached = svgCache.get(key);
    if (cached) {
      const paths = calculateMandalaGeometry(seq.steps, "staff", "staff");
      return { svg: cached, paths };
    }
    if (!seq.steps || seq.steps.length === 0) return null;
    const paths = calculateMandalaGeometry(seq.steps, "staff", "staff");
    const svg = renderMandalaSVG(paths, {
      size: 300,
      style: "stroke",
      show: "both",
      strokeWidth: 2.5,
      palette: COLOR_PALETTE,
    });
    svgCache.set(key, svg);
    return { svg, paths };
  }

  function catalogLabel(catalog: Catalog): string {
    return catalog.name ?? `${catalog.turnPattern ?? ""}`.replace("uniform-", "").replace("t", " Turn");
  }

  // --- Diagnostic ---
  function buildDiagnostic(solo: SoloEntry): string {
    const lines: string[] = [`SOLO: ${solo.word} [${solo.prop}]`];
    for (const p of solo.paths) {
      const allPts = samplePathPoints(p.d);
      const pts = subsample(allPts, 12);
      const radii = allPts.map(([x, y]) => Math.sqrt(x * x + y * y));
      const minR = Math.round(Math.min(...radii));
      const maxR = Math.round(Math.max(...radii));
      const coords = pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" ");
      lines.push(`tip${p.tipIndex} r:[${minR}..${maxR}]: ${coords}`);
    }
    lines.push(`FP: ${soloFingerprint(solo)}`);
    return lines.join("\n");
  }

  let copiedKey = $state<string | null>(null);

  async function copyDiagnostic(key: string, solo: SoloEntry) {
    const text = buildDiagnostic(solo);
    await navigator.clipboard.writeText(text);
    toast.success("Diagnostic copied");
    copiedKey = key;
    setTimeout(() => { if (copiedKey === key) copiedKey = null; }, 800);
  }
</script>

<div class="shape-browser">
  {#if view.kind === "members"}
    <nav class="sb-nav">
      <button class="back-btn" onclick={() => view = { kind: "solos", catalog: view.kind === "members" ? view.catalog : catalogs[0]! }}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Solos
      </button>
      <span class="sep" aria-hidden="true">/</span>
      <span class="current">{view.group.members.length} members</span>
      <span class="hint">right-click = diagnostic</span>
    </nav>

    <div class="grid">
      {#each view.group.members as solo, i (i)}
        {@const key = `m_${solo.word}_${solo.prop}_${i}`}
        <button
          class="tile"
          class:copied={copiedKey === key}
          oncontextmenu={(e) => { e.preventDefault(); copyDiagnostic(key, solo); }}
          onclick={() => {
            const result = renderCombined(solo.seq);
            if (result) addToSheet(solo.seq, result.paths);
          }}
        >
          <div class="art">{@html renderSolo(solo, `solo_${solo.word}_${solo.prop}`)}</div>
          <span class="label">{solo.word} <span class="prop-tag">{solo.prop}</span></span>
        </button>
      {/each}
    </div>

  {:else if view.kind === "solos"}
    <nav class="sb-nav">
      <button class="back-btn" onclick={() => { view = { kind: "catalogs" }; groups = []; }}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Catalogs
      </button>
      <span class="sep" aria-hidden="true">/</span>
      <span class="current">{catalogLabel(view.catalog)}</span>
      {#if scanProgress}
        <span class="status"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> {scanProgress}</span>
      {:else}
        <span class="hint">{groups.length} solo shapes — right-click = diagnostic</span>
      {/if}
    </nav>

    <div class="grid">
      {#each groups as group (group.fp)}
        <button
          class="tile"
          class:copied={copiedKey === `s_${group.fp}`}
          onclick={() => { if (view.kind === "solos") openMembers(group, view.catalog); }}
          oncontextmenu={(e) => { e.preventDefault(); copyDiagnostic(`s_${group.fp}`, group.repSolo); }}
        >
          <div class="art">{@html renderSolo(group.repSolo, group.fp)}</div>
          <span class="label">{group.repSolo.word}</span>
          {#if group.members.length > 1}<span class="count">{group.members.length}</span>{/if}
        </button>
      {/each}

      {#if groups.length === 0 && !scanProgress}
        <p class="empty">No sequences in this catalog</p>
      {/if}
    </div>

  {:else}
    <div class="sb-header">
      <span class="title">Solo Mandala Shapes</span>
      {#if loading}
        <span class="status"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Loading</span>
      {:else}
        <span class="status">{catalogs.length} catalogs</span>
      {/if}
    </div>

    {@const loopCatalogs = catalogs.filter(d => d.collection === 'LOOPs')}
    {@const tndCatalogs = catalogs.filter(d => d.collection !== 'LOOPs')}

    <div class="catalog-list">
      {#if loopCatalogs.length > 0}
        <section>
          <h3 class="section-label">LOOP Catalogs <span class="dim">({loopCatalogs.length})</span></h3>
          <div class="catalog-grid">
            {#each loopCatalogs as catalog (catalog.id)}
              <button class="catalog-card" onclick={() => openCatalog(catalog)}>
                <span class="catalog-name">{catalogLabel(catalog)}</span>
                <span class="catalog-meta">{catalog.totalSequences.toLocaleString()} seq</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}
      {#if tndCatalogs.length > 0}
        <section>
          <h3 class="section-label">TnD Catalogs <span class="dim">({tndCatalogs.length})</span></h3>
          <div class="catalog-grid">
            {#each tndCatalogs as catalog (catalog.id)}
              <button class="catalog-card" onclick={() => openCatalog(catalog)}>
                <span class="catalog-name">{catalogLabel(catalog)}</span>
                <span class="catalog-meta">{catalog.totalSequences.toLocaleString()} seq</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      {#if !loading && loadError}
        <div class="error-state" role="alert">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <p>{loadError}</p>
        </div>
      {:else if !loading && catalogs.length === 0}
        <p class="empty">No catalogs found</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .shape-browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .sb-nav {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    flex-wrap: wrap;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 12px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .back-btn:hover { color: var(--theme-text, #fff); border-color: var(--theme-stroke, rgba(255, 255, 255, 0.25)); }
  .back-btn:focus-visible { outline: 2px solid var(--accent, #63b7cd); outline-offset: 2px; }

  .sep { color: var(--theme-text-dim, rgba(255, 255, 255, 0.2)); font-size: 13px; }
  .current { font-size: 13px; font-weight: 600; color: var(--theme-text, #fff); }
  .hint { margin-left: auto; font-size: 11px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.25)); }
  .status { margin-left: auto; font-size: 11px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.4)); display: flex; align-items: center; gap: 6px; }

  .sb-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }
  .title { font-size: 14px; font-weight: 600; color: var(--theme-text, #fff); }

  .catalog-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    scrollbar-width: thin;
    scrollbar-color: var(--theme-stroke, rgba(255, 255, 255, 0.12)) transparent;
  }

  .section-label {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .dim { font-weight: 400; }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }

  .catalog-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    text-align: left;
    font: inherit;
  }
  .catalog-card:hover { border-color: var(--accent, #63b7cd); }
  .catalog-card:focus-visible { outline: 2px solid var(--accent, #63b7cd); outline-offset: 2px; }
  .catalog-name { font-size: 13px; font-weight: 600; }
  .catalog-meta { font-size: 11px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.4)); }

  .grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    grid-auto-rows: min-content;
    gap: 8px;
    padding: 16px;
    overflow-y: auto;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: var(--theme-stroke, rgba(255, 255, 255, 0.12)) transparent;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    cursor: pointer;
    color: var(--theme-text, #fff);
    font: inherit;
    text-align: left;
  }
  .tile:hover { border-color: var(--accent, #63b7cd); }
  .tile:focus-visible { outline: 2px solid var(--accent, #63b7cd); outline-offset: 2px; }
  .tile.copied {
    border-color: var(--semantic-success, #22c55e);
    box-shadow: 0 0 0 1px var(--semantic-success, #22c55e);
  }

  .art {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
  }
  .art :global(svg) { width: 100%; height: 100%; }

  .label {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prop-tag {
    font-size: 10px;
    opacity: 0.5;
  }

  .count {
    position: absolute;
    top: 6px;
    right: 6px;
    min-width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    background: var(--theme-overlay-strong, rgba(0, 0, 0, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, #fff);
  }

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 48px 24px;
    margin: 0;
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 48px 24px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
  .error-state i {
    font-size: 24px;
    color: var(--semantic-error, #ef4444);
  }
  .error-state p {
    margin: 0;
    font-size: 13px;
    max-width: 32ch;
  }

  @media (max-width: 768px) {
    .catalog-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); padding: 12px; }
    .catalog-list { padding: 12px; gap: 16px; }
    .sb-nav, .sb-header { padding: 10px 12px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile, .catalog-card, .back-btn { transition: none; }
  }
</style>
