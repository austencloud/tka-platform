<!--
  LoopBentoBoard — the LOOP "Compose Your Catalog" surface as a bento card grid,
  matching the unified-generation prototype (src/routes/test/unified-generation).
  Every deck control is a real generate card (BaseCard / StepperCard) or opens a
  centered modal; the gorgeous gradient tiles replace the old three-column board.

  Wired to the seeded generation engine + recipe axes:
    Deck Size · Loop Type (modal) · Level · Period · Step Mix · Turns · Transform (modal)
  Loop type / level / period change the pool → onRebuildPool. The rest shape the
  draw/variation, not the pool. Reuses real primitives: BaseCard, StepperCard,
  LOOPExpandedOverlay, TransformPanel, SegmentedControl.
-->
<script lang="ts">
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import StepperCard from "$lib/features/create/generate/components/cards/StepperCard/StepperCard.svelte";
  import TurnIntensityCard from "$lib/features/create/generate/components/cards/TurnIntensityCard.svelte";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { BackgroundType } from "@austencloud/backgrounds";
  import LOOPExpandedOverlay from "$lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte";
  import {
    LOOPType,
    LOOP_TYPE_LABELS,
  } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";
  import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import TransformPanel from "./TransformPanel.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import OrientationCycler from "$lib/features/create/construct/start-position-picker/components/OrientationCycler.svelte";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { type VariationConfig, type StartOriMode } from "../../services/deck-variation";
  import type { ResolvedReversalPattern } from "../../domain/reversal-transform";
  import type { StepCountWeight } from "../../domain/models/DeckRelease";
  import type { CatalogSourceSummary } from "../../services/deck-composer";
  import { releaserState as rs } from "./deck-releaser-state.svelte";

  interface Props {
    weights: StepCountWeight[];
    totalCards: number;
    sourceSummaries: CatalogSourceSummary[];
    selectedSliceTypes: Set<"halved" | "quartered">;
    variationConfig: VariationConfig;
    startOriModes: Set<StartOriMode>;
    gridModes: Set<"diamond" | "box">;
    reversalPattern?: ResolvedReversalPattern | null;
    onWeightChange: (stepCount: number, weight: number) => void;
    onTotalCardsChange: (total: number) => void;
    onSliceTypeToggle: (sliceType: "halved" | "quartered") => void;
    onVariationConfigChange: (config: VariationConfig) => void;
    onToggleStartOriMode: (mode: StartOriMode) => void;
    onToggleGridMode: (mode: "diamond" | "box") => void;
    onReversalChange?: (pattern: ResolvedReversalPattern) => void;
  }

  let {
    weights,
    totalCards,
    sourceSummaries,
    selectedSliceTypes,
    variationConfig,
    startOriModes,
    gridModes,
    reversalPattern = null,
    onWeightChange,
    onTotalCardsChange,
    onSliceTypeToggle,
    onVariationConfigChange,
    onToggleStartOriMode,
    onToggleGridMode,
    onReversalChange,
  }: Props = $props();

  const c = getCardColors(BackgroundType.COSMIC);
  const LOOP_COLOR = "linear-gradient(135deg, #a3a32a 0%, #8a8a22 50%, #6b6b1a 100%)";
  const LOOP_SHADOW = "60deg 55% 35%";
  const POS_COLOR = "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)";
  const POS_SHADOW = "175deg 65% 40%";

  // Deck size is fixed at 52 (a standard deck). Force it on mount so a persisted
  // 26/36 can't linger now that the size tile is gone.
  $effect(() => { if (rs.totalCards !== 52) rs.totalCards = 52; });

  // Length: one fixed step count — every card is GENERATED live at this length.
  // Live generation makes any length at any level, so the full range is open (no
  // enumerated-pool restriction). Multiples of 4 keep halved + quartered seeds whole.
  const LENGTHS = [4, 8, 12, 16];
  function stepLength(dir: number) {
    const i = LENGTHS.indexOf(rs.selectedLength);
    rs.selectedLength = LENGTHS[Math.max(0, Math.min(LENGTHS.length - 1, (i < 0 ? 1 : i) + dir))]!;
    rs.persist();
  }

  // Style axes (the prototype's Smooth/Mixed/Choppy steppers) — all LIVE generation
  // constraints: Props → constraintPreset, Hands → handPathMode, Dashes → motionTypeFilter.
  const PROP_STYLES = ["smooth", "mixed", "choppy"] as const;
  const PROP_LABELS = ["Smooth", "Mixed", "Choppy"];
  const DASH_STYLES = ["low", "mixed", "high"] as const;
  const DASH_LABELS = ["Low", "Mixed", "High"];
  const STYLE_COLORS = {
    props: { color: c.continuity.color, shadow: c.continuity.shadowColor },
    hands: { color: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)", shadow: "245deg 70% 55%" },
    dashes: { color: "linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%)", shadow: "25deg 90% 55%" },
  };
  const propIdx = $derived(PROP_STYLES.indexOf(rs.propStyle));
  const handIdx = $derived(PROP_STYLES.indexOf(rs.handStyle));
  const dashIdx = $derived(DASH_STYLES.indexOf(rs.dashStyle));
  function stepProp(dir: number) {
    rs.propStyle = PROP_STYLES[Math.max(0, Math.min(2, propIdx + dir))]!;
    rs.persist();
  }
  function stepHand(dir: number) {
    rs.handStyle = PROP_STYLES[Math.max(0, Math.min(2, handIdx + dir))]!;
    rs.persist();
  }
  function stepDash(dir: number) {
    rs.dashStyle = DASH_STYLES[Math.max(0, Math.min(2, dashIdx + dir))]!;
    rs.persist();
  }

  // ── derived labels ─────────────────────────────────────────────────────────
  const currentLoop = $derived(([...rs.selectedLoopTypes][0] as LOOPType) ?? LOOPType.ROTATED);
  const currentLevel = $derived([...rs.selectedLevels][0] ?? 1);
  let loopComponents = $state<Set<LOOPComponent>>(parseLoopComponents(LOOPType.ROTATED));
  $effect(() => { loopComponents = parseLoopComponents(currentLoop); });

  const periodLabel = $derived(
    selectedSliceTypes.size === 2
      ? "Q + H"
      : selectedSliceTypes.has("quartered")
        ? "Quartered"
        : selectedSliceTypes.has("halved")
          ? "Halved"
          : "—",
  );
  // Max turn intensity follows the generator model (single scalar). Half-turns
  // unlock at Level 3, mirroring the Generate panel.
  const turnAllowed = $derived(currentLevel >= 3 ? [0, 0.5, 1, 1.5, 2, 2.5, 3] : [0, 1, 2, 3]);
  const ORI_LABEL: Record<string, string> = { radial: "Radial", nonradial: "Nonradial", split: "Mixed" };
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const transformSummary = $derived(
    `${[...startOriModes].map((m) => ORI_LABEL[m] ?? m).join(", ")} · ${[...gridModes].map(cap).join("/")}`,
  );

  // Total cards is fixed at 52.
  const effectiveTotal = 52;

  // ── modals ───────────────────────────────────────────────────────────────
  let showLoop = $state(false);
  let showTransform = $state(false);
  let showPosOri = $state(false);

  // ── start position + orientation (ported from the unified-generation prototype)
  // Positions follow the deck's active grid mode (set in Transform). Selection is
  // stored as GridPosition strings; empty ⇒ any. Orientation is per-hand and
  // baked into every generated card's beat 0 via blue/redStartOrientation.
  let posShowAll = $state(false);
  const posGridMode = $derived(([...rs.selectedGridModes][0] ?? "diamond") as GridMode);
  const posList = $derived<PictographData[]>(
    posShowAll
      ? startPositionManager.getAllStartPositionVariations(posGridMode, rs.startOriBlue as Orientation, rs.startOriRed as Orientation)
      : startPositionManager.getDefaultStartPositions(posGridMode, rs.startOriBlue as Orientation, rs.startOriRed as Orientation),
  );
  function togglePos(pos: string) {
    const next = new Set(rs.selectedStartPositionIds);
    if (next.has(pos)) next.delete(pos);
    else next.add(pos);
    rs.selectedStartPositionIds = next;
    rs.persist();
  }
  function clearPos() { rs.selectedStartPositionIds = new Set(); rs.persist(); }
  function allPos() { rs.selectedStartPositionIds = new Set(posList.map((p) => String(p.startPosition))); rs.persist(); }
  const ORI_SHORT: Record<string, string> = { in: "In", out: "Out", clock: "Clock", counter: "Counter" };
  const oriLabel = (o: string) => ORI_SHORT[o] ?? o;
  const posSummary = $derived(
    `${rs.selectedStartPositionIds.size === 0 ? "Any" : `${rs.selectedStartPositionIds.size} pos`} · ${oriLabel(rs.startOriBlue)}/${oriLabel(rs.startOriRed)}`,
  );

  // ── actions ────────────────────────────────────────────────────────────────
  function pickLoop(lt: LOOPType) {
    rs.selectedLoopTypes = new Set([lt]);
    loopComponents = parseLoopComponents(lt);
    showLoop = false;
    rs.persist();
  }
  function setLevel(n: number) {
    rs.selectedLevels = new Set([Math.max(1, Math.min(3, n))]);
    rs.persist();
  }
  // Period cycles Quartered → Halved (live gen uses one period per card).
  function cyclePeriod() {
    rs.selectedSliceTypes = rs.selectedSliceTypes.has("quartered")
      ? new Set(["halved"])
      : new Set(["quartered"]);
    rs.persist();
  }
</script>

<div class="bento-stage">
  <div class="card-grid">
    <div class="tile">
      <BaseCard title="Loop Type" currentValue={LOOP_TYPE_LABELS[currentLoop]} color={LOOP_COLOR} shadowColor={LOOP_SHADOW} gridColumnSpan={2} onClick={() => (showLoop = true)} />
    </div>
    <div class="tile">
      <StepperCard title="Length" currentValue={rs.selectedLength} minValue={4} maxValue={16} description="STEP COUNT" color={c.length.color} shadowColor={c.length.shadowColor} gridColumnSpan={2} onIncrement={() => stepLength(1)} onDecrement={() => stepLength(-1)} />
    </div>
    <div class="tile">
      <StepperCard title="Level" currentValue={currentLevel} minValue={1} maxValue={3} description="BASE MOTIONS" color={c.level.color} shadowColor={c.level.shadowColor} gridColumnSpan={2} onIncrement={() => setLevel(currentLevel + 1)} onDecrement={() => setLevel(currentLevel - 1)} />
    </div>
    <div class="tile">
      <BaseCard title="Period" currentValue={periodLabel} color={c.gridMode.color} shadowColor={c.gridMode.shadowColor} gridColumnSpan={2} onClick={cyclePeriod} />
    </div>
    <div class="tile">
      <TurnIntensityCard currentIntensity={rs.turnIntensity} allowedValues={turnAllowed} onIntensityChange={(v: number) => { rs.turnIntensity = v; rs.persist(); }} shadowColor="140deg 70% 45%" gridColumnSpan={2} />
    </div>
    <div class="tile">
      <StepperCard title="Props" currentValue={propIdx} minValue={0} maxValue={2} description="REVERSALS" formatValue={(i: number) => PROP_LABELS[i] ?? ""} color={STYLE_COLORS.props.color} shadowColor={STYLE_COLORS.props.shadow} gridColumnSpan={2} onIncrement={() => stepProp(1)} onDecrement={() => stepProp(-1)} />
    </div>
    <div class="tile">
      <StepperCard title="Hands" currentValue={handIdx} minValue={0} maxValue={2} description="REVERSALS" formatValue={(i: number) => PROP_LABELS[i] ?? ""} color={STYLE_COLORS.hands.color} shadowColor={STYLE_COLORS.hands.shadow} gridColumnSpan={2} onIncrement={() => stepHand(1)} onDecrement={() => stepHand(-1)} />
    </div>
    <div class="tile">
      <StepperCard title="Dashes" currentValue={dashIdx} minValue={0} maxValue={2} description="FREQUENCY" formatValue={(i: number) => DASH_LABELS[i] ?? ""} color={STYLE_COLORS.dashes.color} shadowColor={STYLE_COLORS.dashes.shadow} gridColumnSpan={2} onIncrement={() => stepDash(1)} onDecrement={() => stepDash(-1)} />
    </div>
    <div class="tile">
      <BaseCard title="Start · Ori" currentValue={posSummary} color={POS_COLOR} shadowColor={POS_SHADOW} gridColumnSpan={2} onClick={() => (showPosOri = true)} />
    </div>
    <div class="tile wide">
      <BaseCard title="Transform" currentValue={transformSummary} color={c.duration.color} shadowColor={c.duration.shadowColor} gridColumnSpan={2} onClick={() => (showTransform = true)} />
    </div>
  </div>

  <section class="recipe">
    <span class="recipe-title">This Deck</span>
    <dl class="recipe-list">
      <div class="recipe-row"><dt>Cards</dt><dd>{effectiveTotal}</dd></div>
      <div class="recipe-row"><dt>Loop</dt><dd>{LOOP_TYPE_LABELS[currentLoop]}</dd></div>
      <div class="recipe-row"><dt>Length</dt><dd>{rs.selectedLength} steps</dd></div>
      <div class="recipe-row"><dt>Level</dt><dd>{currentLevel}</dd></div>
      <div class="recipe-row"><dt>Period</dt><dd>{periodLabel}</dd></div>
      <div class="recipe-row"><dt>Max Turns</dt><dd>{rs.turnIntensity}</dd></div>
      <div class="recipe-row"><dt>Style</dt><dd>{PROP_LABELS[propIdx]} · {PROP_LABELS[handIdx]} · {DASH_LABELS[dashIdx]}</dd></div>
      <div class="recipe-row"><dt>Start · Ori</dt><dd>{posSummary}</dd></div>
      <div class="recipe-row"><dt>Transform</dt><dd>{transformSummary}</dd></div>
      <div class="recipe-row"><dt>Reversal</dt><dd>{reversalPattern?.label ?? "Continuous"}</dd></div>
    </dl>
  </section>
</div>

{#if showLoop}
  <div class="modal-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) showLoop = false; }}>
    <div class="loop-col" transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}>
      <div class="loop-host">
        <LOOPExpandedOverlay currentType={currentLoop} selectedComponents={loopComponents} onChange={(lt: LOOPType) => pickLoop(lt)} onClose={() => (showLoop = false)} />
      </div>
    </div>
  </div>
{/if}

{#if showTransform}
  <div class="modal-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) showTransform = false; }}>
    <div class="picker-overlay" transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}>
      <div class="po-header">
        <h3>Transform</h3>
        <button class="po-close" aria-label="Close" onclick={() => (showTransform = false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="po-body">
        <TransformPanel {startOriModes} {onToggleStartOriMode} {gridModes} {onToggleGridMode} {reversalPattern} onReversalChange={(p) => onReversalChange?.(p)} reversalCustomDefault={false} />
      </div>
      <button class="po-done" onclick={() => (showTransform = false)}>Done</button>
    </div>
  </div>
{/if}

{#if showPosOri}
  <div class="modal-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) showPosOri = false; }}>
    <div class="picker-overlay posori" transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}>
      <div class="po-header">
        <h3>Start Position &amp; Orientation</h3>
        <button class="po-close" aria-label="Close" onclick={() => (showPosOri = false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="po-body">
        <div class="pos-controls">
          <button class="pc-btn" onclick={allPos}>All</button>
          <button class="pc-btn" onclick={clearPos}>Clear</button>
          <button class="pc-btn pc-scope" class:active={posShowAll} onclick={() => (posShowAll = !posShowAll)}>
            {posShowAll ? "Simple (3)" : "All Variations"}
          </button>
        </div>
        <div class="pos-grid" class:all={posShowAll}>
          {#each posList as p (p.id)}
            {@const sel = rs.selectedStartPositionIds.has(String(p.startPosition))}
            <button class="pos-cell" class:on={sel} aria-pressed={sel} onclick={() => togglePos(String(p.startPosition))}>
              <PictographContainer pictographData={p} />
              {#if sel}<span class="pos-check">✓</span>{/if}
            </button>
          {/each}
        </div>
        <div class="pos-ori-row">
          <OrientationCycler orientation={rs.startOriBlue as Orientation} onOrientationChange={(o: Orientation) => { rs.startOriBlue = o; rs.persist(); }} color="blue" />
          <OrientationCycler orientation={rs.startOriRed as Orientation} onOrientationChange={(o: Orientation) => { rs.startOriRed = o; rs.persist(); }} color="red" />
        </div>
        <p class="pos-hint">No selection = any start position. Orientation applies to every card in the deck.</p>
      </div>
      <button class="po-done" onclick={() => (showPosOri = false)}>Done</button>
    </div>
  </div>
{/if}

<style>
  .bento-stage {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 1180px;
    margin-inline: auto;
    /* theme vars the real generate cards read */
    --card-text-size: 22px;
    --card-text-weight: 800;
    --card-text-spacing: 0.3px;
    --card-text-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
    --element-spacing: 10px;
  }
  .card-grid {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 12px;
    width: 100%;
  }
  .card-grid > .tile {
    flex: 1 1 230px;
    min-width: 200px;
    height: 120px;
  }
  .card-grid > .tile.wide {
    flex: 1 1 360px;
  }
  .tile > :global(*) {
    width: 100%;
    height: 100%;
  }
  /* Unify type scale across the cards (matches the prototype). */
  .card-grid :global(.value-number),
  .card-grid :global(.base-card .card-value) { font-size: 24px !important; line-height: 1.15 !important; }
  .card-grid :global(.card-title) { font-size: 11px !important; letter-spacing: 0.8px !important; }

  .recipe {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px 22px;
    padding: 16px 18px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
  }
  .recipe-title {
    grid-column: 1 / -1;
    font-size: 12px;
    font-weight: 700;
    color: var(--theme-text, #fff);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .recipe-list { display: contents; }
  .recipe-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .recipe-row dt { font-size: 12px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.45)); }
  .recipe-row dd { margin: 0; font-size: 13px; font-weight: 600; color: var(--theme-text, #fff); text-align: right; }

  /* ── modals (match the prototype chrome) ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 4vh, 48px);
    background: rgba(4, 7, 14, 0.62);
    backdrop-filter: blur(5px);
  }
  .loop-col { width: min(1000px, 94vw); max-height: 92vh; display: flex; flex-direction: column; gap: 12px; }
  .loop-host { position: relative; min-height: 0; overflow: hidden; border-radius: 18px; }
  .loop-host :global(.loop-expanded-overlay) { position: relative !important; inset: auto !important; width: 100%; max-height: 82vh; }
  .loop-host :global(.grid-container) { flex: 0 0 auto; }

  .picker-overlay {
    width: min(880px, 94vw);
    max-height: min(840px, 90vh);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%);
    border-radius: 18px;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .po-header { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .po-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #fff; }
  .po-close { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 8px; }
  .po-close svg { width: 20px; height: 20px; }
  .po-close:hover { background: rgba(255, 255, 255, 0.15); }
  .po-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
  .po-done { flex-shrink: 0; width: 100%; padding: 12px 20px; min-height: 44px; background: color-mix(in srgb, var(--theme-accent) 30%, transparent); border: 2px solid var(--theme-accent); border-radius: 10px; color: #fff; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; }
  .po-done:hover { background: color-mix(in srgb, var(--theme-accent) 45%, transparent); }

  /* ── start position + orientation picker ── */
  /* Definite height so the 4×4 "All Variations" grid doesn't collapse. */
  .picker-overlay.posori { height: min(740px, 90vh); }
  .pos-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .pc-btn {
    min-height: 36px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .pc-btn:hover { background: rgba(255, 255, 255, 0.14); }
  .pc-scope { margin-left: auto; }
  .pc-scope.active { background: color-mix(in srgb, var(--theme-accent) 35%, transparent); border-color: var(--theme-accent); }
  .pos-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .pos-grid.all { grid-template-columns: repeat(4, 1fr); }
  .pos-cell {
    position: relative;
    aspect-ratio: 1;
    padding: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 2px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
  }
  .pos-cell:hover { background: rgba(255, 255, 255, 0.08); transform: translateY(-1px); }
  .pos-cell.on { border-color: #14b8a6; background: color-mix(in srgb, #14b8a6 18%, transparent); }
  .pos-cell :global(*) { width: 100%; height: 100%; }
  .pos-check {
    position: absolute;
    top: 4px;
    right: 6px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #14b8a6;
    color: #042f2a;
    font-size: 13px;
    font-weight: 900;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
  .pos-ori-row { display: flex; gap: 16px; justify-content: center; margin-top: 16px; }
  .pos-hint { margin: 12px 2px 0; font-size: 12px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.5)); text-align: center; }
</style>
