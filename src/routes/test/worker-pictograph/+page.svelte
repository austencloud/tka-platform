<script lang="ts">
  // COLD-DECK PROFILER: the proven main-thread render path under a microscope.
  // Two outputs drive the caching-rebuild decision:
  //   1. Dedup analysis (NO render): derive the pictograph content key for every
  //      cell across all cards and count distinct vs total. Plus distinct words,
  //      loop signatures, and QR payloads per card. These ratios quantify how
  //      much persistent caching can eliminate.
  //   2. Cold phase timing: clear ALL caches, render every card cold via the
  //      production composeSequenceImage path, and read the assembly probe to see
  //      where the time went (decode / cell / qr / mandala / header / footer /
  //      border / composite). A warm second pass shows the cold-vs-warm gap.

  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getImageComposer } from "$lib/shared/render/get-image-composer";
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
  import { buildCanonicalCardVisibility } from "$lib/features/choreo-card/domain/canonical-card-visibility";
  import { getPictographKeyHasher } from "$lib/shared/render/get-pictograph-key-hasher";
  import { getLayerCompositor as getLayerCompositorSingleton } from "$lib/shared/render/get-layer-compositor";
  import { clearSvgImageCache } from "$lib/shared/render/services/svg-image-cache";
  import {
    assemblyProbe,
    resetAssemblyProbe,
    snapshotAssemblyProbe,
  } from "$lib/shared/render/services/__assembly-perf-probe";
  import { onMount, onDestroy } from "svelte";

  const CARD_W = 822, CARD_H = 1122; // full-card front dimensions
  // Colored frame thickness, mirrors PrintCardRenderer/card-front-frame:
  // border = round(36 * 1.3) = 47. Content insets by this on every side.
  const CARD_BLEED = 36;
  const CARD_BORDER = Math.round(CARD_BLEED * 1.3); // 47
  const CONTENT_W = CARD_W - CARD_BORDER * 2; // 728
  const CONTENT_H = CARD_H - CARD_BORDER * 2; // 1028

  const engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });

  let loadError = $state<string | null>(null);

  // TnD element drives the accent-color tint + element footer the profiled card
  // builds with. 3 = Split-Opp / fire.
  let selectedElementIdx = $state(3);

  // Cold-deck profiler state (dedup analysis + assembly phase breakdown).
  let profiling = $state(false);
  let profileStatus = $state("idle");
  let profileResult = $state<string | null>(null);

  onMount(async () => {
    try {
      await engine.initialize();
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  });
  onDestroy(() => engine.destroy());

  // Mirrors PrintCardRenderer.renderFront: a REAL TnD choreo-card with the
  // element accent-color tint + element footer + QR. Built per-sequence.
  function buildFrontOptions(): Partial<SequenceExportOptions> {
    const tnd = TND_ELEMENTS[selectedElementIdx]!;
    const canonical = buildCanonicalCardVisibility({
      tndElement: tnd,
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
    });
    const leftLabel = "Austen";
    const rightLabel = "TKA";
    const notes = tnd.name;
    return {
      deckCard: { contentWidth: CONTENT_W, contentHeight: CONTENT_H },
      includeStartPosition: true,
      startPositionLayout: "row",
      addStepNumbers: true,
      addWord: canonical.addWord,
      addDifficultyLevel: false,
      stepSize: 300, stepScale: 1, margin: 0, format: "PNG", quality: 1, scale: 1,
      redVisible: true, blueVisible: true, addReversalSymbols: true, combinedGrids: false,
      showLoopGlyph: false,
      bluePropTypeOverride: PropType.STAFF,
      redPropTypeOverride: PropType.STAFF,
      accentColor: tnd.accentColor,
      accentTintOpacity: tnd.cardTintOpacity,
      // deckId is the QR payload — required for the QR to resolve.
      deckId: "profile-deck",
      showCreatorName: !!leftLabel,
      showNotes: !!(notes || leftLabel || rightLabel || tnd.iconPath),
      showBirthday: false,
      leftLabel, rightLabel, notes,
      iconPath: tnd.iconPath,
      userName: "Austen",
      exportDate: new Date().toISOString(),
      visibilityOverrides: {
        ...canonical.visibilityOverrides,
        // Mandala off so the QR lands in a clear empty cell.
        showMandala: false,
        showQRCode: true,
      },
    } as Partial<SequenceExportOptions>;
  }

  // Defensively wire the QR generator onto the singleton composer. In prod this
  // is registered at app boot (deferred-registrations.ts), but this test route
  // may render before that runs. getQRCodeGenerator is a browser-only singleton,
  // so this is safe and idempotent.
  async function ensureQRWired() {
    const composer = getImageComposer();
    try {
      const { getQRCodeGenerator } = await import("$lib/shared/qr/getQRCodeGenerator");
      (composer as unknown as { setQRCodeGenerator: (g: unknown) => void }).setQRCodeGenerator(
        getQRCodeGenerator(),
      );
    } catch (e) {
      console.warn("[harness] QR generator wiring failed:", e);
    }
  }

  // --- COLD-DECK PROFILER (dedup analysis + assembly phase breakdown) ---------

  const PROFILE_CARDS = 36;

  // Mirror the renderer's per-cell key derivation EXACTLY:
  // renderPictographAt builds finalVisibilitySettings = { ...resolvedVisibility,
  // bluePropType: effectiveBlue ?? resolved.blue, redPropType: effectiveRed ??
  // resolved.red } and applies the prop override onto the step's motions, then
  // (legacy path) calls keyHasher.deriveKey(stepData, finalVisibilitySettings).
  // We reproduce that input shape so the dedup count matches what a content cache
  // keyed on deriveKey would actually collapse.
  function applyPropOverrideToStep(
    step: StepData,
    blueProp?: PropType,
    redProp?: PropType,
  ): StepData {
    if (!blueProp && !redProp) return step;
    return {
      ...step,
      motions: {
        blue:
          step.motions.blue && blueProp
            ? { ...step.motions.blue, propType: blueProp }
            : step.motions.blue,
        red:
          step.motions.red && redProp
            ? { ...step.motions.red, propType: redProp }
            : step.motions.red,
      },
    } as StepData;
  }

  async function clearAllRenderCaches() {
    // SVG decode cache (grids, letters, turn numbers, arrows/props decode source).
    clearSvgImageCache();
    // LayerCompositor base/gridPoints/tka/reversal canvas caches (the dominant
    // per-cell redundancy eliminator).
    getLayerCompositorSingleton().clearCache();
    // ImageComposer memory + IndexedDB blob caches (legacy raster path + L1/L2).
    const composer = getImageComposer();
    await composer.clearCache(true);
    // NOTE: GlyphCache (header glyph data-URL cache) exposes no clear() method,
    // so header-glyph decode is already warm on first render. Its cost still
    // shows up under headerMs (renderWordHeader), just not as a cold decode.
  }

  async function profileColdDeck() {
    if (profiling) return;
    profiling = true;
    profileResult = null;
    try {
      profileStatus = "picking sequences…";
      const source = engine.allSequences.filter(
        (s) => Array.isArray(s.steps) && s.steps.length > 0,
      );
      if (source.length === 0) {
        profileStatus = "no renderable sequences found";
        return;
      }
      // Up to PROFILE_CARDS distinct sequences; report the actual count used.
      const seqs: SequenceData[] = source.slice(0, PROFILE_CARDS);

      await ensureQRWired();
      const composer = getImageComposer();
      const frontOptions = buildFrontOptions();

      // Resolve visibility ONCE the way the renderer does, then merge the
      // effective prop overrides per cell so the key matches the render path.
      const visibility = await composer.resolveVisibilitySettings(frontOptions);
      const effectiveBlue =
        frontOptions.bluePropTypeOverride ?? frontOptions.propTypeOverride;
      const effectiveRed =
        frontOptions.redPropTypeOverride ?? frontOptions.propTypeOverride;
      const cellVisibility = {
        ...visibility,
        bluePropType: effectiveBlue ?? visibility.bluePropType,
        redPropType: effectiveRed ?? visibility.redPropType,
      };

      // --- 1. DEDUP ANALYSIS (no render) -------------------------------------
      profileStatus = "deriving dedup keys (no render)…";
      const hasher = getPictographKeyHasher();
      const pictographKeys = new Set<string>();
      const words = new Set<string>();
      const loopSignatures = new Set<string>();
      const qrPayloads = new Set<string>();
      let totalCells = 0;

      for (const seq of seqs) {
        // Start position cell (composeSequenceImage renders it when
        // includeStartPosition is set), derived from the first step when the
        // sequence carries no explicit start position — mirrors the renderer.
        const cells: StepData[] = [];
        if (frontOptions.includeStartPosition) {
          const sp =
            (seq.startPosition as unknown as StepData | undefined) ??
            (seq.steps[0]
              ? ({ ...seq.steps[0], letter: undefined } as unknown as StepData)
              : undefined);
          if (sp) cells.push(sp);
        }
        for (const step of seq.steps) cells.push(step);

        for (const cell of cells) {
          const withProp = applyPropOverrideToStep(cell, effectiveBlue, effectiveRed);
          const key = hasher.deriveKey(withProp, cellVisibility);
          pictographKeys.add(key);
          totalCells++;
        }

        // Header word: same simplified word the header renders.
        const rawWord =
          seq.word ||
          seq.steps.filter((s) => s.letter).map((s) => s.letter).join("");
        words.add(rawWord);

        // Loop signature: the mandala/header-driving signal is the loop type.
        loopSignatures.add(String(seq.loopType ?? "none"));

        // QR payload: the QR encodes the sequence (deckId is constant in this
        // harness, so the per-card payload distinction is the sequence identity).
        qrPayloads.add(String(seq.id ?? seq.word ?? seq.name ?? ""));
      }

      const cards = seqs.length;
      const distinctPictographs = pictographKeys.size;
      const pictographDedupRatio = distinctPictographs / Math.max(1, totalCells);

      // --- 2. COLD PHASE TIMING ----------------------------------------------
      profileStatus = "clearing ALL caches for cold render…";
      await clearAllRenderCaches();

      profileStatus = "rendering deck COLD (assembly probe on)…";
      assemblyProbe.enabled = true;
      resetAssemblyProbe();
      const coldT0 = performance.now();
      for (const seq of seqs) {
        await composer.composeSequenceImage(seq, frontOptions);
      }
      const coldTotalMs = performance.now() - coldT0;
      const phase = snapshotAssemblyProbe();
      assemblyProbe.enabled = false;

      // --- 3. WARM SECOND PASS (caches now warm) -----------------------------
      profileStatus = "rendering deck WARM (caches hot)…";
      const warmT0 = performance.now();
      for (const seq of seqs) {
        await composer.composeSequenceImage(seq, frontOptions);
      }
      const warmTotalMs = performance.now() - warmT0;

      const pct = (ms: number) =>
        Number(((ms / Math.max(0.0001, coldTotalMs)) * 100).toFixed(2));

      profileResult = JSON.stringify(
        {
          cards,
          totalCells,
          distinctPictographs,
          pictographDedupRatio: Number(pictographDedupRatio.toFixed(4)),
          distinctWords: words.size,
          distinctWordsPerCard: Number((words.size / Math.max(1, cards)).toFixed(4)),
          distinctLoopSignatures: loopSignatures.size,
          distinctLoopSignaturesPerCard: Number(
            (loopSignatures.size / Math.max(1, cards)).toFixed(4),
          ),
          distinctQrPayloads: qrPayloads.size,
          distinctQrPayloadsPerCard: Number(
            (qrPayloads.size / Math.max(1, cards)).toFixed(4),
          ),
          coldTotalMs: Math.round(coldTotalMs),
          coldPerCardMs: Number((coldTotalMs / Math.max(1, cards)).toFixed(2)),
          warmTotalMs: Math.round(warmTotalMs),
          warmPerCardMs: Number((warmTotalMs / Math.max(1, cards)).toFixed(2)),
          phaseBreakdownMs: {
            decode: Math.round(phase.decodeMs),
            cell: Math.round(phase.cellMs),
            qr: Math.round(phase.qrMs),
            mandala: Math.round(phase.mandalaMs),
            header: Math.round(phase.headerMs),
            footer: Math.round(phase.footerMs),
            border: Math.round(phase.borderMs),
            composite: Math.round(phase.compositeMs),
          },
          phaseBreakdownPct: {
            decode: pct(phase.decodeMs),
            cell: pct(phase.cellMs),
            qr: pct(phase.qrMs),
            mandala: pct(phase.mandalaMs),
            header: pct(phase.headerMs),
            footer: pct(phase.footerMs),
            border: pct(phase.borderMs),
            composite: pct(phase.compositeMs),
          },
          cellCount: phase.cellCount,
        },
        null,
        2,
      );
      profileStatus = `cold deck profiled — ${cards} cards, dedup ${(
        pictographDedupRatio * 100
      ).toFixed(1)}% distinct, cold ${Math.round(coldTotalMs)}ms vs warm ${Math.round(
        warmTotalMs,
      )}ms`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      profileStatus = "PROFILE FAILED: " + msg;
      profileResult = msg;
      // Ensure the probe never stays enabled after a failure.
      assemblyProbe.enabled = false;
    } finally {
      profiling = false;
    }
  }
</script>

<svelte:head><title>Cold-Deck Profiler</title></svelte:head>

<div class="page">
  <div class="shell">
    <header class="hero">
      <a class="back" href="/test/parity">← Parity Tests</a>
      <h1>Cold-Deck Profiler</h1>
    </header>

    <section class="panel">
      <h2>Cold-Deck Profiler <span class="tag">metrics</span></h2>
      <p class="desc">
        Clears caches, renders {PROFILE_CARDS} cards cold via the production
        main-thread composer — dedup ratios + per-phase timing.
      </p>
      <div class="elements">
        {#each TND_ELEMENTS as el, i (el.familyId)}
          <button
            type="button"
            class="el"
            class:active={i === selectedElementIdx}
            onclick={() => (selectedElementIdx = i)}
            disabled={profiling}
          >{el.name}</button>
        {/each}
      </div>
      <div class="controls">
        <button type="button" class="run" onclick={profileColdDeck} disabled={profiling || !!loadError}>
          {profiling ? "Profiling…" : "Profile cold deck"}
        </button>
        <span class="chip" class:run={profiling}>{loadError ? `error: ${loadError}` : profileStatus}</span>
      </div>
      {#if profileResult}<pre>{profileResult}</pre>{/if}
    </section>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 40px clamp(16px, 5vw, 48px) 80px;
    background: linear-gradient(180deg, #0a0a12, #0c0c15);
    color: #eaeaf2;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .shell {
    max-width: 880px;
    margin: 0 auto;
  }
  .hero {
    text-align: center;
    margin-bottom: 28px;
  }
  .back {
    display: inline-block;
    font-size: 13px;
    color: #8c8ca6;
    text-decoration: none;
    margin-bottom: 14px;
  }
  .back:hover {
    color: #fff;
  }
  h1 {
    margin: 0;
    font-size: clamp(24px, 4vw, 32px);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #fff;
  }
  .panel {
    text-align: center;
    margin-bottom: 16px;
    padding: 22px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.025);
  }
  h2 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 650;
    color: #fff;
  }
  .tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    vertical-align: middle;
    margin-left: 6px;
    padding: 2px 8px;
    border-radius: 999px;
    color: #9aa0b8;
    background: rgba(255, 255, 255, 0.06);
  }
  .desc {
    margin: 0 0 16px;
    font-size: 13px;
    color: #8c8ca6;
  }
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  button.run {
    padding: 11px 24px;
    border-radius: 10px;
    border: none;
    background: #6366f1;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.1s ease;
  }
  button.run:hover:not(:disabled) {
    background: #7c7ef5;
  }
  button.run:active:not(:disabled) {
    transform: translateY(1px);
  }
  button.run:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .chip {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: #9aa0b8;
    padding: 5px 10px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }
  .chip.run {
    color: #ffd43b;
    border-color: rgba(255, 212, 59, 0.3);
  }
  .elements {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }
  .el {
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: #cfcfe0;
    cursor: pointer;
  }
  .el.active {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
    font-weight: 700;
  }
  .el:disabled {
    opacity: 0.5;
    cursor: default;
  }
  pre {
    text-align: left;
    background: #08080d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px;
    font-size: 12px;
    line-height: 1.5;
    color: #b8c0cc;
    white-space: pre-wrap;
    margin: 14px 0 0;
  }
</style>
