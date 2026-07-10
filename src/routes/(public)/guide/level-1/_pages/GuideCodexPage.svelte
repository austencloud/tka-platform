<script lang="ts">
  /**
   * GuideCodexPage — body page (manifest `codex`), guide/codex merge
   * (2026-07-10, docs/superpowers/specs/2026-07-10-guide-codex-merge-design.md).
   *
   * Replaces the 7 broken/static catalog entries (bl-double-staff[-36],
   * bl-clubs, bl-buugeng, bl-triads, bl-fans, bl-mini-hoops) with ONE
   * interactive page composed of the Learn module's real Codex pieces
   * (CodexSheetPicker, CodexControlPanel, letterQueryHandler, getCodex()
   * transforms) — reused directly, not forked. New capability over the Learn
   * tab's CodexExplorer: a PropType selector (staff/club/buugeng/triad/fan/
   * mini hoop/hand) that re-skins every rendered pictograph, picker + grid +
   * companion payload together.
   *
   * PRINT/BOOK SEAM: /print and /book share this exact manifest + BUILT
   * registry with the reader (see built-pages.ts, guide-manifest.ts) — there
   * is no separate per-route page map. Rather than fork the registry, this
   * component branches on getGuidePrintMode(): print/book render the faithful
   * static Double-Staff codex sheets (CodexSheet + SHEET1/SHEET2, the same
   * content DoubleStaffCodexT12/36Page rendered) so the printed hand-out keeps
   * its ink-cheap, non-interactive layout; the reader renders the live
   * explorer. This is the minimal seam — one BUILT entry, one component,
   * self-selecting its presentation from context already set by the host route.
   *
   * Guide overrides do NOT apply here — the dataset is canonical (spec
   * non-goal). Clicking a variation does not set a stripKey, so the
   * companion's admin edit row (Replace/Revert/Reset/Transform/Remix/Edit
   * steps) stays hidden for codex cells, same as the spec's "no override
   * system" requirement.
   */
  import { onMount } from "svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    MotionColor,
    MotionType,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { createMotionData, type MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import CodexSheetPicker from "$lib/features/learn/codex/components/CodexSheetPicker.svelte";
  import CodexControlPanel from "$lib/features/learn/codex/components/CodexControlPanel.svelte";
  import { getCodex } from "$lib/features/learn/codex/get-codex";
  import { getGuideSequenceClick, getGuidePrintMode } from "../_data/guide-data-context";
  import { bakeReversals } from "../_data/guide-sequence-adapter";
  import CodexSheet from "../../codex/_components/CodexSheet.svelte";
  import { SHEET1, SHEET2 } from "../../codex/_data/codex-groups";
  import {
    GUIDE_CODEX_PROP_TYPES,
    GUIDE_CODEX_STORAGE_KEY,
    defaultGuideCodexPrefs,
    restoreGuideCodexPrefs,
    serializeGuideCodexPrefs,
    type GuideCodexVisibility,
  } from "../_data/guide-codex-persistence";

  const emitSequence = getGuideSequenceClick();
  // The reader ALSO sets guide print mode (print STYLE + eager pictographs), so
  // getGuidePrintMode() can't tell reader from /print,/book. The sequence-click
  // context can: only the reader provides it. Interactive there; static sheets
  // everywhere else.
  const printMode = getGuidePrintMode() && emitSequence === null;

  // ── Persisted view state (letter, grid mode, visibility, prop type) ───────
  const initial = (() => {
    if (typeof localStorage === "undefined") return defaultGuideCodexPrefs();
    return restoreGuideCodexPrefs(localStorage.getItem(GUIDE_CODEX_STORAGE_KEY));
  })();

  let selectedLetter = $state(initial.selectedLetter);
  let gridMode = $state<"diamond" | "box">(initial.gridMode);
  let visibility = $state<GuideCodexVisibility>({ ...initial.visibility });
  let propType = $state<PropType>(initial.propType);
  const gridModeEnum = $derived(gridMode === "box" ? GridMode.BOX : GridMode.DIAMOND);

  onMount(() => {
    if (printMode) return; // print/book render the static branch — no interactive state to persist
    const t = setInterval(() => {
      try {
        localStorage.setItem(
          GUIDE_CODEX_STORAGE_KEY,
          serializeGuideCodexPrefs({
            version: 1,
            selectedLetter,
            gridMode,
            visibility: $state.snapshot(visibility),
            propType,
          })
        );
      } catch {
        // private mode / quota — not worth surfacing
      }
    }, 500);
    return () => clearInterval(t);
  });

  const PROP_OPTIONS: { value: PropType; label: string }[] = [
    { value: PropType.STAFF, label: "Staff" },
    { value: PropType.CLUB, label: "Club" },
    { value: PropType.BUUGENG, label: "Buugeng" },
    { value: PropType.TRIAD, label: "Triad" },
    { value: PropType.FAN, label: "Fan" },
    { value: PropType.MINIHOOP, label: "Mini Hoop" },
    { value: PropType.HAND, label: "Hand" },
  ];

  const VISIBILITY_CHIPS: { key: keyof GuideCodexVisibility; label: string; icon: string }[] = [
    { key: "showGlyph", label: "Glyph", icon: "fas fa-fire" },
    { key: "showGrid", label: "Grid", icon: "fas fa-border-all" },
    { key: "showTKA", label: "TKA", icon: "fas fa-font" },
    { key: "showPositions", label: "Positions", icon: "fas fa-location-dot" },
    { key: "showReversals", label: "Reversals", icon: "fas fa-left-right" },
    { key: "showNonRadialPoints", label: "Non-Radial", icon: "fas fa-circle-dot" },
  ];

  let allPictographs = $state<PictographData[]>([]);
  let isLoading = $state(true);
  let transformed = $state<PictographData[] | null>(null);
  let transformedReps = $state<Map<string, PictographData> | null>(null);

  async function load() {
    isLoading = true;
    allPictographs = await letterQueryHandler.getAllPictographVariations(gridModeEnum);
    isLoading = false;
  }

  async function setGridMode(mode: GridMode) {
    if (mode === gridModeEnum) return;
    gridMode = mode === GridMode.BOX ? "box" : "diamond";
    transformed = null;
    transformedReps = null;
    await load();
  }

  function selectLetter(letter: string) {
    selectedLetter = letter;
    transformed = null;
  }

  let variationsRaw = $derived(allPictographs.filter((p) => p.letter === selectedLetter));
  let baseRepsRaw = $derived.by(() => {
    const m = new Map<string, PictographData>();
    for (const p of allPictographs) {
      if (p.letter && !m.has(p.letter)) m.set(p.letter, p);
    }
    return m;
  });

  // Codex-wide transforms (rotate/mirror/colorswap) act on picker reps AND
  // current variations together — same coupling as CodexExplorer.
  async function applyTransform(op: "rotate" | "mirror" | "colorswap") {
    const codex = getCodex();
    const run = (arr: PictographData[]) =>
      op === "rotate"
        ? codex.rotateAllPictographs(arr)
        : op === "mirror"
          ? codex.mirrorAllPictographs(arr)
          : codex.colorSwapAllPictographs(arr);

    const baseVars = transformed ?? variationsRaw;
    if (baseVars.length > 0) transformed = await run(baseVars);

    const repArr = [...baseRepsRaw.values()];
    if (repArr.length > 0) {
      const out = await run(repArr);
      const m = new Map<string, PictographData>();
      for (const p of out) if (p.letter) m.set(p.letter, p);
      transformedReps = m;
    }
  }

  // ── Prop selector: re-skin every rendered PictographData's motions ────────
  function withPropType(p: PictographData, type: PropType): PictographData {
    const blue = p.motions?.[MotionColor.BLUE];
    const red = p.motions?.[MotionColor.RED];
    return {
      ...p,
      motions: {
        blue: blue ? createMotionData({ ...blue, propType: type }) : blue,
        red: red ? createMotionData({ ...red, propType: type }) : red,
      },
    };
  }

  let variations = $derived(
    (transformed ?? variationsRaw).map((p) => withPropType(p, propType))
  );
  let representatives = $derived.by(() => {
    const src = transformedReps ?? baseRepsRaw;
    const m = new Map<string, PictographData>();
    for (const [letter, p] of src) m.set(letter, withPropType(p, propType));
    return m;
  });

  // ── Companion click: a static Start pose, then the clicked variation ──────
  function staticFrom(m: MotionData | undefined, color: MotionColor) {
    if (!m) return undefined;
    return createMotionData({
      motionType: MotionType.STATIC,
      startLocation: m.startLocation,
      endLocation: m.startLocation,
      startOrientation: m.startOrientation,
      endOrientation: m.startOrientation,
      color,
      propType: m.propType,
      gridMode: m.gridMode,
    });
  }

  function handleVariationClick(p: PictographData, idx: number) {
    if (!emitSequence) return;
    const blue = p.motions?.[MotionColor.BLUE];
    const red = p.motions?.[MotionColor.RED];
    const key = `codex-${p.letter ?? selectedLetter}-${idx}`;
    const start: StepData = {
      id: `${key}-start`,
      letter: null,
      gridMode: p.gridMode ?? gridModeEnum,
      stepNumber: 0,
      startPosition: p.startPosition,
      endPosition: p.startPosition,
      motions: {
        blue: staticFrom(blue, MotionColor.BLUE),
        red: staticFrom(red, MotionColor.RED),
      },
    } as unknown as StepData;
    const step: StepData = {
      ...p,
      id: `${key}-1`,
      stepNumber: 1,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    } as unknown as StepData;
    const strip = [start, ...bakeReversals([step])];
    emitSequence({
      strip,
      word: p.letter ?? selectedLetter,
      key,
      propType,
    });
  }

  onMount(() => {
    if (!printMode) load();
  });
</script>

{#if printMode}
  <!-- Faithful print/book branch — the static Double-Staff sheets (Types 1-6),
       identical content to the retired DoubleStaffCodexT12/36Page pair. -->
  <div class="codex-print">
    <div class="codex-print-sheet">
      <CodexSheet sheet={SHEET1} embed />
    </div>
    <div class="codex-print-sheet page-break">
      <CodexSheet sheet={SHEET2} embed />
    </div>
  </div>
{:else}
  <!-- Interactive reader branch — live Codex explorer + prop selector. -->
  <div class="guide-codex">
    <header class="topbar">
      <div class="cg">
        <SegmentedControl
          options={[
            { value: GridMode.DIAMOND, label: "Diamond", icon: "fas fa-gem" },
            { value: GridMode.BOX, label: "Box", icon: "fas fa-square" },
          ]}
          value={gridModeEnum}
          onchange={setGridMode}
          color="accent"
          size="sm"
        />
      </div>
      <div class="cg">
        <CodexControlPanel
          showOrientation={false}
          onRotate={() => applyTransform("rotate")}
          onMirror={() => applyTransform("mirror")}
          onColorSwap={() => applyTransform("colorswap")}
        />
      </div>
      <div class="cg">
        <SegmentedControl
          options={PROP_OPTIONS}
          value={propType}
          onchange={(v) => (propType = v)}
          color="accent"
          size="sm"
        />
      </div>
      <div class="cg grow vis-chips">
        {#each VISIBILITY_CHIPS as chip (chip.key)}
          <FilterChipBase
            mode="toggle"
            size="sm"
            label={chip.label}
            icon={chip.icon}
            active={visibility[chip.key]}
            onclick={() => (visibility = { ...visibility, [chip.key]: !visibility[chip.key] })}
          />
        {/each}
      </div>
    </header>

    <div class="body">
      <div class="picker-pane themed-scrollbar">
        {#key gridMode}
          <CodexSheetPicker {representatives} {selectedLetter} darkMode={false} onSelect={selectLetter} />
        {/key}
      </div>

      <div class="vars-pane themed-scrollbar">
        {#if isLoading}
          <div class="state"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Loading…</div>
        {:else if variations.length === 0}
          <div class="state">No variations for "{selectedLetter}"</div>
        {:else}
          {#key selectedLetter + "|" + gridMode}
            <div class="pgrid">
              {#each variations as v, i (v.id ?? i)}
                <button
                  type="button"
                  class="pcard"
                  onclick={() => handleVariationClick(v, i)}
                  aria-label={`Animate ${v.letter ?? selectedLetter} variation ${i + 1}`}
                >
                  <PictographContainer
                    pictographData={v}
                    darkMode={false}
                    showGrid={visibility.showGrid}
                    showTKA={visibility.showTKA}
                    showTnD={visibility.showGlyph}
                    showElemental={visibility.showGlyph}
                    showPositions={visibility.showPositions}
                    showReversals={visibility.showReversals}
                    showNonRadialPoints={visibility.showNonRadialPoints}
                  />
                </button>
              {/each}
            </div>
          {/key}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .codex-print {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .codex-print-sheet {
    padding-top: 0.6in;
  }
  .codex-print-sheet.page-break {
    break-before: page;
  }

  .guide-codex {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding-top: 90px; /* clear GuidePage's absolute .guide-title overlay */
    color: #141414;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    padding: 0 8px 10px;
    border-bottom: 1px solid rgba(20, 20, 20, 0.12);
    flex-shrink: 0;
  }
  .cg { display: flex; align-items: center; }
  .cg.grow { flex: 1; min-width: 0; }
  .vis-chips { display: flex; flex-wrap: wrap; gap: 6px; }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 16px;
    padding-top: 12px;
  }

  .picker-pane {
    flex: 0 0 42%;
    min-width: 0;
    overflow-y: auto;
    padding: 4px 10px;
  }

  .vars-pane {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 4px 10px;
  }

  .pgrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 110px));
    gap: 10px;
  }
  .pcard {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    width: 100%;
    aspect-ratio: 1;
    padding: 6px;
    border-radius: 10px;
    background: #f6f7fb;
    border: 1px solid rgba(20, 20, 20, 0.1);
    transition: transform 120ms, box-shadow 120ms;
    -webkit-tap-highlight-color: transparent;
  }
  .pcard:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); }
  .pcard:focus-visible { outline: 2px solid #3730a3; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .pcard { transition: none; }
    .pcard:hover { transform: none; }
  }

  .state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 20px;
    color: rgba(20, 20, 20, 0.5);
    width: 100%;
  }
</style>
