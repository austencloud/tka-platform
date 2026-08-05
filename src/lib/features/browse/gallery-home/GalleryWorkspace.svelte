<!--
  GalleryWorkspace — the filter workspace half of the gallery drill.

  Every value editor (level, length, letter, position, grid mode, creator,
  LOOPs, T&D families, max turn intensity) plus the unified decision canvas
  that flat-chooser hosts open on. The editorial landing lives in
  GalleryLanding.svelte; the tile they share is CategoryTile.svelte.

  Split out of GalleryDrill.svelte 2026-08-04 (split-pane workspace project).

  `.drill-ctx` is a display:contents mirror of the drill root: it carries the
  same modifier classes and `data-section` so the workspace's own CSS can key
  off them without reaching across the component boundary.
-->
<script lang="ts">
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import SequencePeek from "$lib/shared/browse/components/SequencePeek.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import LessonGridDisplay from "$lib/shared/pictograph/grid/components/LessonGridDisplay.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import CategoryTile from "./CategoryTile.svelte";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import { DIFFICULTY_LEVELS } from "$lib/shared/config/difficulty-styles";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { FilterConnective } from "$lib/shared/browse/services/multi-filter";
  import { Slider } from "bits-ui";
  import {
    FAN_TILTS,
    LEVEL_DESCRIPTIONS,
    type CategoryEntry,
    type GalleryCatalog,
    type Section,
  } from "./gallery-drill-catalog.svelte";

  interface Props {
    catalog: GalleryCatalog;
    section: Section;
    drillWidth: number;
    sheet: boolean;
    /** Rendering inside the split pane's left column. */
    splitPane?: boolean;
    unifiedFilterChooser: boolean;
    adaptiveValueLayout: boolean;
    persistentDesktopCatalog: boolean;
    chooserTitle?: string;
    chooserHint?: string;
    stackHint?: string;
    isValueApplied?: (type: BrowseFilterType, value: string | number) => boolean;
    activeLoopValues?: ReadonlySet<string>;
    onToggleLoop?: unknown;
    loopConnective: FilterConnective;
    onLoopConnectiveChange?: (connective: FilterConnective) => void;
    activeFamilyValues?: ReadonlySet<string>;
    onToggleFamily?: unknown;
    familyConnective: FilterConnective;
    onFamilyConnectiveChange?: (connective: FilterConnective) => void;
    onBack: () => void;
    onPickValue: (
      type: BrowseFilterType,
      value: string | number,
      label: string,
      color?: string
    ) => void;
    onPickLoop: (v: { value: string; label: string; color: string }) => void;
    onPickFamily: (v: { value: string; label: string; color: string }) => void;
    onApply: (
      type: BrowseFilterType,
      value: string | number,
      label: string,
      color?: string
    ) => void;
    onSelectCategory: (entry: CategoryEntry) => void;
  }

  let {
    catalog,
    section,
    drillWidth,
    sheet,
    splitPane = false,
    unifiedFilterChooser,
    adaptiveValueLayout,
    persistentDesktopCatalog,
    chooserTitle,
    chooserHint,
    stackHint,
    isValueApplied,
    activeLoopValues,
    onToggleLoop,
    loopConnective,
    onLoopConnectiveChange,
    activeFamilyValues,
    onToggleFamily,
    familyConnective,
    onFamilyConnectiveChange,
    onBack,
    onPickValue,
    onPickLoop,
    onPickFamily,
    onApply,
    onSelectCategory,
  }: Props = $props();

  // Art scale inside the capped editor pane — the container queries widen the
  // cards, but SequencePeek's box is a prop.
  const levelPeekWidth = $derived(
    adaptiveValueLayout && drillWidth >= 640 && drillWidth < 900
      ? 120
      : adaptiveValueLayout && drillWidth >= 480 && drillWidth < 640
        ? 104
        : catalog.PEEK.levelW
  );
  const levelPeekHeight = $derived(
    adaptiveValueLayout && drillWidth >= 640 && drillWidth < 900
      ? 112
      : adaptiveValueLayout && drillWidth >= 480 && drillWidth < 640
        ? 97
        : catalog.PEEK.levelH
  );
  const letterGlyphHeight = $derived(
    adaptiveValueLayout && drillWidth < 640
      ? 30
      : adaptiveValueLayout
        ? catalog.PEEK.letterH
        : 26
  );

  // Zero-count options render dimmed everywhere — a tap that can only land on
  // an empty grid is a dead end in the onApply flow too.
  function valueDisabled(count: number, applied: boolean): boolean {
    return count === 0 && !applied;
  }

  const maxTurnStops = $derived(
    catalog.maxTurnIntensityValues.map((value) => value.value)
  );
  let pendingMaxTurn = $state(1.5);
  const selectedMaxTurn = $derived(
    catalog.maxTurnIntensityValues.find(
      (value) => value.value === pendingMaxTurn
    ) ?? catalog.maxTurnIntensityValues[0]
  );
  // A limit already in the rule wins over the midpoint default, so re-entering
  // this editor shows the applied value instead of a guess.
  const appliedMaxTurn = $derived(
    isValueApplied
      ? catalog.maxTurnIntensityValues.find((value) =>
          isValueApplied(BrowseFilterType.MAX_TURN_INTENSITY, value.value)
        )?.value
      : undefined
  );
  $effect(() => {
    if (
      catalog.maxTurnIntensityValues.length > 0 &&
      !catalog.maxTurnIntensityValues.some(
        (value) => value.value === pendingMaxTurn
      )
    ) {
      const middleChoice =
        catalog.maxTurnIntensityValues[
          Math.floor((catalog.maxTurnIntensityValues.length - 1) / 2)
        ];
      const seeded = appliedMaxTurn ?? middleChoice?.value;
      if (seeded !== undefined) pendingMaxTurn = seeded;
    }
  });
  $effect(() => {
    if (section === "max_turn_intensity" && appliedMaxTurn !== undefined) {
      pendingMaxTurn = appliedMaxTurn;
    }
  });

  function applyMaxTurnIntensity() {
    if (!selectedMaxTurn) return;
    onApply(
      BrowseFilterType.MAX_TURN_INTENSITY,
      selectedMaxTurn.value,
      selectedMaxTurn.label
    );
  }
</script>

{#snippet valueHead(title: string, hint?: string)}
  <!-- Back lives IN the screen header (same spot on every value screen, part
       of the crossfading layer) — a persistent bar above the stage burned
       ~44px on the chooser where Back doesn't exist. -->
  <header class="drill-head with-back">
    <button
      class="head-back"
      type="button"
      onclick={onBack}
      aria-label={unifiedFilterChooser
        ? "Back to filters"
        : "Back to browse options"}
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      <!-- Icon-only reads as an anonymous circle when the wide stage strands
           it far from the title — the label makes it unmistakably a button. -->
      <span class="head-back-label">Back</span>
    </button>
    <h2 tabindex="-1">{title}</h2>
    {#if hint}<p>{hint}</p>{/if}
  </header>
{/snippet}

<div
  class="drill-ctx"
  class:sheet
  class:split-pane={splitPane}
  class:unified-filter-chooser={unifiedFilterChooser}
  class:adaptive-value-layout={adaptiveValueLayout}
  class:persistent-desktop-catalog={persistentDesktopCatalog}
  data-section={section}
>
  {#if section === "chooser"}
    <!-- Refinement is already a focused "add a filter" task. Put every
         available category in one consistent canvas instead of making two
         categories privileged and hiding the rest behind More. -->
    <div class="drill-screen screen-chooser">
      <header class="drill-head">
        <h2 tabindex="-1">
          {chooserTitle ??
            (sheet ? "Filter sequences" : "How do you want to browse?")}
        </h2>
        <p>
          {chooserHint ??
            (sheet
              ? "Counts update with your current filters."
              : "Pick one to narrow it down.")}
        </p>
      </header>
      <div class="unified-choice-grid">
        {#each [...catalog.primaryCategories, ...catalog.secondaryCategories] as entry (entry.key)}
          <CategoryTile
            {entry}
            composition="unified"
            active={section === entry.section}
            avatarFor={(name) => catalog.creatorAvatars.get(name)}
            onselect={onSelectCategory}
          />
        {/each}
      </div>
    </div>
  {:else if section === "level"}
    <div class="drill-screen screen-level">
      {@render valueHead("Pick a level", stackHint)}
      <div class="value-list">
        {#each catalog.levelValues as v (v.value)}
          {@const style = DIFFICULTY_LEVELS[v.value]}
          {@const levelApplied =
            isValueApplied?.(BrowseFilterType.DIFFICULTY, v.value) ?? false}
          <button
            class="level-tile"
            class:value-applied={levelApplied}
            type="button"
            style:background={style?.cssBg}
            style:color={style?.text ?? "#000"}
            aria-pressed={isValueApplied ? levelApplied : undefined}
            disabled={valueDisabled(v.count, levelApplied)}
            onclick={() =>
              onPickValue(BrowseFilterType.DIFFICULTY, v.value, v.label)}
          >
            <span class="value-numeral">{v.value}</span>
            <span class="value-main">
              <span class="value-label">Level {v.value}</span>
              <span class="value-desc on-gradient"
                >{LEVEL_DESCRIPTIONS[v.value]}</span
              >
              <span class="density-bar on-gradient">
                <span
                  class="density-fill"
                  style:width="{(v.count / catalog.maxLevelCount) * 100}%"
                ></span>
              </span>
            </span>
            <span class="value-count">{v.count}</span>
            <SequencePeek
              sequence={catalog.levelReps.get(v.value)}
              width={levelPeekWidth}
              height={levelPeekHeight}
              eager
            />
          </button>
        {/each}
      </div>
    </div>
  {:else if section === "length"}
    <div class="drill-screen screen-length">
      {@render valueHead("Pick a length", stackHint)}
      <div class="value-list" class:dense={catalog.lengthValues.length > 8}>
        {#each catalog.lengthValues as v (v.value)}
          {@const lengthApplied =
            isValueApplied?.(BrowseFilterType.LENGTH, v.value) ?? false}
          <button
            class="length-row monument"
            class:value-applied={lengthApplied}
            type="button"
            aria-pressed={isValueApplied ? lengthApplied : undefined}
            disabled={valueDisabled(v.count, lengthApplied)}
            onclick={() => onPickValue(BrowseFilterType.LENGTH, v.value, v.label)}
          >
            <span class="value-numeral small">{v.value}</span>
            <span class="value-main">
              <span class="value-label muted">steps</span>
              <span class="density-bar">
                <span
                  class="density-fill"
                  style:width="{(v.count / catalog.maxLengthCount) * 100}%"
                ></span>
              </span>
            </span>
            <span class="value-count">{v.count}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if section === "max_turn_intensity"}
    <div class="drill-screen screen-max-turns">
      {@render valueHead("Set a turn limit")}
      {#if adaptiveValueLayout && selectedMaxTurn}
        <div class="turn-picker">
          <div class="turn-summary" aria-live="polite">
            <span class="turn-limit">≤{selectedMaxTurn.value}</span>
            <span class="turn-unit">turns</span>
            <!-- "would match": the slider is a projection until the button
                 below commits it. -->
            <span class="turn-count">would match {selectedMaxTurn.count}</span>
          </div>

          <div class="turn-slider-shell">
            <Slider.Root
              type="single"
              min={maxTurnStops[0]}
              max={maxTurnStops.at(-1)}
              step={maxTurnStops}
              bind:value={pendingMaxTurn}
              class="turn-slider-root"
              trackPadding={3}
            >
              {#snippet children({ tickItems })}
                <span class="turn-slider-track">
                  <Slider.Range class="turn-slider-range" />
                </span>
                {#each tickItems as { index, value } (value)}
                  <Slider.Tick {index} class="turn-slider-tick" />
                  <Slider.TickLabel
                    {index}
                    position="bottom"
                    class="turn-slider-label"
                  >
                    ≤{value}
                  </Slider.TickLabel>
                {/each}
                <Slider.Thumb
                  index={0}
                  class="turn-slider-thumb"
                  aria-label="Maximum turn intensity"
                  aria-valuetext={`At most ${selectedMaxTurn.value} turns, ${selectedMaxTurn.count} matches`}
                />
              {/snippet}
            </Slider.Root>
          </div>

          <div class="turn-action">
            <PanelButton variant="primary" fullWidth onclick={applyMaxTurnIntensity}>
              Use ≤{selectedMaxTurn.value} turns
            </PanelButton>
          </div>
        </div>
      {:else}
        <div class="value-list">
          {#each catalog.maxTurnIntensityValues as v (v.value)}
            <button
              class="length-row monument"
              type="button"
              onclick={() =>
                onApply(BrowseFilterType.MAX_TURN_INTENSITY, v.value, v.label)}
            >
              <span class="value-numeral small">≤{v.value}</span>
              <span class="value-main">
                <span class="value-label muted">max turns</span>
                <span class="density-bar">
                  <span
                    class="density-fill"
                    style:width="{(v.count / catalog.maxTurnIntensityCount) *
                      100}%"
                  ></span>
                </span>
              </span>
              <span class="value-count">{v.count}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else if section === "letter"}
    <div class="drill-screen screen-letter">
      {@render valueHead("Pick a starting letter", stackHint)}
      <div class="letter-grid">
        {#each catalog.letterValues as v (v.value)}
          {@const letterApplied =
            isValueApplied?.(BrowseFilterType.STARTING_LETTER, v.value) ?? false}
          <button
            class="letter-chip"
            class:value-applied={letterApplied}
            type="button"
            aria-label="{v.value}, {v.count} sequences"
            aria-pressed={isValueApplied ? letterApplied : undefined}
            disabled={valueDisabled(v.count, letterApplied)}
            onclick={() =>
              onPickValue(BrowseFilterType.STARTING_LETTER, v.value, v.value)}
          >
            <span class="letter-glyph" style:height="{letterGlyphHeight}px">
              <TKAWordGlyph word={v.value} height={letterGlyphHeight} darkMode />
            </span>
            <span class="letter-count">{v.count}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if section === "position"}
    <div class="drill-screen screen-positions">
      {@render valueHead("Pick a start position", stackHint)}
      <div class="value-list">
        {#each catalog.positionValues as v (v.value)}
          {@const positionApplied =
            isValueApplied?.(BrowseFilterType.STARTING_POSITION, v.value) ??
            false}
          <button
            class="length-row tall monument"
            class:value-applied={positionApplied}
            type="button"
            aria-pressed={isValueApplied ? positionApplied : undefined}
            disabled={valueDisabled(v.count, positionApplied)}
            onclick={() =>
              onPickValue(BrowseFilterType.STARTING_POSITION, v.value, v.label)}
          >
            <span class="value-pictograph" aria-hidden="true">
              {#if catalog.startPosPictographs.get(v.value)}
                <PictographContainer
                  pictographData={catalog.startPosPictographs.get(v.value)}
                  showTKA={false}
                  showPositions={false}
                  showTnD={false}
                  showElemental={false}
                />
              {/if}
            </span>
            <span class="value-main">
              <span class="value-label">{v.label}</span>
              <span class="value-desc">{v.desc}</span>
              <span class="density-bar">
                <span
                  class="density-fill"
                  style:width="{(v.count / catalog.maxPositionCount) * 100}%"
                ></span>
              </span>
            </span>
            <span class="value-count">{v.count}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if section === "author"}
    <div class="drill-screen screen-creator">
      {@render valueHead("Pick a creator", stackHint)}
      <div class="value-list creator-list">
        {#each catalog.creatorValues as v (v.value)}
          {@const creatorApplied =
            isValueApplied?.(BrowseFilterType.OWNER, v.value) ?? false}
          <button
            class="length-row tall creator-row"
            class:value-applied={creatorApplied}
            type="button"
            aria-label={`${v.value}, ${v.count} sequences`}
            aria-pressed={isValueApplied ? creatorApplied : undefined}
            disabled={valueDisabled(v.count, creatorApplied)}
            onclick={() => onPickValue(BrowseFilterType.OWNER, v.value, v.value)}
          >
            <RobustAvatar
              class="creator-avatar"
              src={catalog.creatorAvatars.get(v.value)?.avatarUrl}
              googleId={catalog.creatorAvatars.get(v.value)?.ownerId}
              name={v.value}
              alt=""
              customSize={adaptiveValueLayout && drillWidth < 640 ? 36 : 44}
            />
            <span class="value-main">
              <span class="value-label" title={v.value}>{v.value}</span>
              <span class="density-bar">
                <span
                  class="density-fill"
                  style:width="{(v.count / catalog.maxCreatorCount) * 100}%"
                ></span>
              </span>
            </span>
            <span class="value-count">{v.count}</span>
            <!-- The creator's own work, not stock art — same peek primitive as
                 the chooser fans, clipped by the row's overflow. -->
            <span class="peek-fan creator-fan" aria-hidden="true">
              {#each catalog.creatorSamples.get(v.value) ?? [] as seq, i (seq.id)}
                <SequencePeek
                  sequence={seq}
                  width={catalog.PEEK.creatorW}
                  height={catalog.PEEK.creatorH}
                  tilt={FAN_TILTS[i]}
                />
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {:else if section === "gridmode"}
    <div class="drill-screen screen-gridmode">
      {@render valueHead("Pick a grid mode", stackHint)}
      <div class="value-list">
        {#each catalog.gridModeValues as v (v.value)}
          {@const gridModeApplied =
            isValueApplied?.(BrowseFilterType.GRID_MODE, v.value) ?? false}
          <button
            class="length-row tall monument"
            class:value-applied={gridModeApplied}
            type="button"
            aria-pressed={isValueApplied ? gridModeApplied : undefined}
            disabled={valueDisabled(v.count, gridModeApplied)}
            onclick={() =>
              onPickValue(BrowseFilterType.GRID_MODE, v.value, v.label)}
          >
            <span class="value-grid-preview" aria-hidden="true">
              <LessonGridDisplay
                type={v.value === GridMode.BOX ? "box" : "diamond"}
                size="large"
              />
            </span>
            <span class="value-main">
              <span class="value-label">{v.label}</span>
              <span class="value-desc">{v.desc}</span>
              <span class="density-bar">
                <span
                  class="density-fill"
                  style:width="{(v.count / catalog.maxGridModeCount) * 100}%"
                ></span>
              </span>
            </span>
            <span class="value-count">{v.count}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if section === "loop"}
    <div class="drill-screen screen-loop">
      {@render valueHead(
        "Pick a LOOP type",
        onToggleLoop
          ? loopConnective === "all"
            ? "Tap several — sequences need every one of them."
            : "Tap several — sequences match any of them."
          : undefined
      )}
      {#if onLoopConnectiveChange}
        <div class="connective-row">
          <SegmentedControl
            size="sm"
            density="compact"
            color="accent"
            ariaLabel="How selected LOOPs combine"
            options={[
              { value: "any", label: "Match any" },
              { value: "all", label: "Match all" },
            ]}
            value={loopConnective}
            onchange={(v) => onLoopConnectiveChange?.(v)}
          />
        </div>
      {/if}
      <div class="value-list">
        {#each catalog.loopValues as v (v.value)}
          {@const isOn = activeLoopValues?.has(v.value) ?? false}
          <button
            class="length-row tall monument tinted"
            class:loop-active={isOn}
            style:--row-color={v.color}
            type="button"
            aria-pressed={onToggleLoop ? isOn : undefined}
            disabled={Boolean(onToggleLoop) && v.count === 0 && !isOn}
            onclick={() => onPickLoop(v)}
          >
            <span class="loop-icon" style:color={v.color} aria-hidden="true">
              <i class="fas {v.icon}"></i>
            </span>
            <span class="value-main">
              <span class="value-label">{v.label}</span>
              <span class="value-desc">{v.desc}</span>
              <span class="density-bar">
                <span
                  class="density-fill"
                  style:width="{(v.count / catalog.maxLoopCount) * 100}%"
                  style:background={v.color}
                ></span>
              </span>
            </span>
            <span class="value-count">{v.count}</span>
            <!-- Slot reserved either way — appearing check must not shift the row. -->
            {#if onToggleLoop}
              <span class="loop-check" class:on={isOn} aria-hidden="true">
                <i class="fas fa-check"></i>
              </span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {:else if section === "family"}
    <div class="drill-screen screen-family">
      {@render valueHead(
        "Pick a Timing & Direction family",
        onToggleFamily
          ? familyConnective === "all"
            ? "Tap several — sequences need every family."
            : "Tap several — sequences match any family."
          : undefined
      )}
      {#if onFamilyConnectiveChange}
        <div class="connective-row">
          <SegmentedControl
            size="sm"
            density="compact"
            color="accent"
            ariaLabel="How selected families combine"
            options={[
              { value: "any", label: "Match any" },
              { value: "all", label: "Match all" },
            ]}
            value={familyConnective}
            onchange={(v) => onFamilyConnectiveChange?.(v)}
          />
        </div>
      {/if}
      <div class="value-list">
        {#each catalog.familyValues as v (v.value)}
          {@const isOn = activeFamilyValues?.has(v.value) ?? false}
          <button
            class="length-row tall family-row monument tinted"
            class:loop-active={isOn}
            style:--row-color={v.color}
            type="button"
            aria-label={`${v.label}, ${v.count} sequences`}
            aria-pressed={onToggleFamily ? isOn : undefined}
            disabled={Boolean(onToggleFamily) && v.count === 0 && !isOn}
            onclick={() => onPickFamily(v)}
          >
            <img
              class="value-img family-icon"
              src={v.icon}
              alt=""
              width="44"
              height="44"
              loading="eager"
            />
            <span class="value-main">
              <span class="value-label">{v.label}</span>
              <span class="density-bar">
                <span
                  class="density-fill"
                  style:width="{(v.count / catalog.maxFamilyCount) * 100}%"
                  style:background={v.color}
                ></span>
              </span>
            </span>
            <span class="value-count">{v.count}</span>
            {#if onToggleFamily}
              <span class="loop-check" class:on={isOn} aria-hidden="true">
                <i class="fas fa-check"></i>
              </span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* A display:contents mirror of the drill root — it carries the modifier
     classes and data-section so the rules below can key off them without
     crossing the component boundary. It adds no box of its own. */
  .drill-ctx {
    display: contents;
  }

  /* Each screen fills its (absolute, stage-sized) crossfade layer and owns its
     own scroll; short screens center, tall ones scroll from the top. */
  .drill-screen {
    display: flex;
    flex-direction: column;
    justify-content: safe center;
    gap: 0.75rem;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }
  .drill-head {
    display: block;
    text-align: center;
  }
  .drill-head h2 {
    margin: 0 0 0.2rem;
    font-size: 1.25rem;
    font-weight: 800;
    text-transform: none;
    color: var(--theme-text, #e8edf6);
  }
  /* Headings receive PROGRAMMATIC focus after navigation (screen-reader
     anchor, WCAG 2.4.3) — a visible ring on a non-interactive heading reads
     as a broken control. */
  .drill-head h2:focus {
    outline: none;
  }
  .drill-head p {
    margin: 0;
    font-size: 0.88rem;
    color: var(--theme-text-muted, #9aa6b8);
  }
  /* Value-screen header: back control left of the centered title (mirrored
     1fr columns keep the title truly centered whatever the button's width);
     hint spans the full row. */
  .drill-head.with-back {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    row-gap: 0.3rem;
  }
  .drill-head.with-back h2 {
    grid-column: 2;
    margin: 0;
  }
  .drill-head.with-back p {
    grid-column: 1 / -1;
  }
  .head-back {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: 44px;
    height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-border, #2a3140);
    border-radius: 999px;
    color: var(--theme-text, #e8edf6);
    font-size: 0.95rem;
    cursor: pointer;
  }
  /* Phone: icon-only circle (sits right next to the title, no room needed). */
  .head-back-label {
    display: none;
    font-weight: 600;
  }
  .head-back:hover {
    border-color: var(--theme-accent, #6aa0ff);
  }
  .head-back:focus-visible {
    outline: 2px solid var(--theme-accent, #6aa0ff);
    outline-offset: 2px;
  }


  .value-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
  }

  /* Match any / all control on connective-bearing editors (LOOPs, T&D).
     Sized to its labels, never stretched across the screen — the shared
     SegmentedControl is width:100% by design, so the consumer caps it. */
  .connective-row {
    display: flex;
    justify-content: center;
    flex: 0 0 auto;
    margin-bottom: 0.6rem;
  }

  .connective-row :global(.segmented-control) {
    width: max-content;
  }

  /* Two short fixed labels — never let "Match any" break across lines. */
  .connective-row :global(.segmented-control button) {
    white-space: nowrap;
  }

  /* Level tiles wear the canonical difficulty gradients (light backgrounds,
     black text per the canonical config). */
  .level-tile {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    min-height: 76px;
    padding: 0.7rem 0.9rem;
    text-align: left;
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.35);
    cursor: pointer;
    transition:
      transform 0.16s ease,
      filter 0.16s ease;
  }
  .level-tile:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }
  .level-tile:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .length-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    min-height: 56px;
    padding: 0.55rem 0.9rem;
    text-align: left;
    border-radius: 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    transition:
      border-color 0.16s ease,
      transform 0.16s ease;
  }
  .length-row:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: translateY(-1px);
  }
  .length-row:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Monument numeral — same face as DifficultyBadge (Cambria serif). */
  .value-numeral {
    font-family: Cambria, Georgia, serif;
    font-weight: 700;
    font-size: 2.4rem;
    line-height: 1;
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .value-numeral.small {
    font-size: 1.6rem;
  }

  .value-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }
  .value-label {
    font-size: 0.95rem;
    font-weight: 700;
  }
  .value-label.muted {
    color: var(--theme-text-muted, #9aa6b8);
    font-weight: 600;
    font-size: 0.8rem;
  }
  .value-desc {
    font-size: 0.75rem;
    line-height: 1.25;
    color: var(--theme-text-muted, #9aa6b8);
    /* Centered monument descriptions (levels, families) wrap to two lines in
       their narrow column — balance splits them evenly instead of orphaning
       the last word ("…the same / way."). No-op on single-line rows. */
    text-wrap: balance;
  }
  /* On the light level gradients, descriptions read in dark ink. */
  .value-desc.on-gradient {
    color: rgba(0, 0, 0, 0.65);
  }
  .value-img {
    flex: 0 0 auto;
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: 10px;
  }
  .value-img.plate {
    background: #fff;
    padding: 4px;
  }
  /* Real start-position pictograph, rendered by PictographContainer in the
     user's live theme (grid + props adapt to light/dark). Square box the
     container fills; scales up on the desktop monument. */
  .value-pictograph {
    flex: 0 0 auto;
    width: 76px;
    height: 76px;
    border-radius: 12px;
    overflow: hidden;
  }
  /* Family rows lead with the element PNG at the loop-icon footprint so the
     two stacking screens (LOOPs / families) share one row rhythm. */
  .value-img.family-icon {
    width: 44px;
    height: 44px;
    border-radius: 0;
  }
  /* Colored value rows (families, loops, collections) wear their accent at
     rest, not just when active — panel tinted and edged in the row's color at
     every tier. Identical charcoal bars undersold the color-coded systems. */
  .length-row.tinted {
    background: color-mix(
      in srgb,
      var(--row-color) 10%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border-color: color-mix(in srgb, var(--row-color) 35%, transparent);
  }
  .length-row.tinted:hover {
    border-color: color-mix(in srgb, var(--row-color) 65%, transparent);
  }
  .length-row.tall {
    min-height: 76px;
  }
  /* Creator rows: monogram disc + the creator's own work as a trailing fan. */
  .creator-row {
    overflow: hidden;
  }
  /* RobustAvatar owns its size (customSize) + circular clip; the row only adds
     the stroke ring and pins it against the flex layout. */
  :global(.creator-avatar.robust-avatar) {
    flex: 0 0 auto;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .peek-fan.creator-fan {
    margin-right: -0.4rem;
  }
  .peek-fan.creator-fan > :global(.peek + .peek) {
    margin-left: -0.8rem;
  }
  /* Tight rows (phones, the filter sheet): one sample is flavor, three is a
     squeeze — keep the lead peek, drop the rest. */
  @container drill (max-width: 560px) {
    .peek-fan.creator-fan > :global(.peek:nth-child(n + 2)) {
      display: none;
    }
  }
  /* Loop-structure rows lead with the component's canonical icon + color —
     the same coding as the LOOP icon strip and deck labels. */
  .loop-icon {
    flex: 0 0 auto;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }
  /* Applied structure (sheet toggles): border + tint in the component's color. */
  /* Selected reads stronger than the resting .tinted panel. */
  .length-row.loop-active {
    border-color: color-mix(in srgb, var(--row-color) 60%, transparent);
    background: color-mix(in srgb, var(--row-color) 20%, transparent);
  }

  /* Stability over deletion: options and catalog tiles that a rule change
     zeroes out dim instead of unmounting (audit X-4/D-5). */
.length-row:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
.length-row:disabled:hover {
    transform: none;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Single-select editors mark the value already in the host's rule (builder
     re-entry, audit X-2/C-6/F-12) — same selection language as loop-active,
     in the accent instead of a component color. */
  .length-row.value-applied,
  .letter-chip.value-applied {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 70%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 18%,
      transparent
    );
    box-shadow: inset 3px 0 0 var(--theme-accent, #6366f1);
  }
  /* Level tiles carry full-bleed difficulty gradients — a ring reads over
     them where a background tint cannot. */
  .level-tile.value-applied {
    box-shadow:
      0 0 0 3px var(--theme-panel-bg, #11131a),
      0 0 0 6px var(--theme-accent, #6366f1);
  }
  .loop-check {
    flex: 0 0 auto;
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--row-color);
    font-size: 0.9rem;
    visibility: hidden;
  }
  .loop-check.on {
    visibility: visible;
  }

  /* ── Letter grid ───────────────────────────────────────────────── */
  .letter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: 0.5rem;
  }
  .letter-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-height: 60px;
    padding: 0.45rem 0.3rem;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    transition:
      border-color 0.16s ease,
      transform 0.16s ease;
  }
  .letter-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: translateY(-1px);
  }
  .letter-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
  .letter-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
  }
  .letter-count {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-muted, #9aa6b8);
  }

  /* Density bar: fill = count ÷ largest bucket on screen. Fixed track. */
  .density-bar {
    display: block;
    width: 100%;
    max-width: 160px;
    height: 5px;
    border-radius: 999px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }
  .density-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--theme-text-muted, #9aa6b8);
  }
  .density-bar.on-gradient {
    background: rgba(0, 0, 0, 0.15);
  }
  .density-bar.on-gradient .density-fill {
    background: rgba(0, 0, 0, 0.55);
  }

  .value-count {
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 0.95rem;
  }
  .length-row .value-count {
    color: var(--theme-text, #e8edf6);
  }

  /* Instant tap feedback — touch has no :hover, so a press must register
     visually the moment it lands (the grid paints a beat later). */
  .length-row:active,
  .letter-chip:active {
    transform: scale(0.985);
  }
  .level-tile:active {
    transform: scale(0.985);
    filter: brightness(1.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .level-tile,
    .length-row,
    .letter-chip {
      transition: none;
    }
    .level-tile:hover,
    .length-row:hover,
    .letter-chip:hover,
    .level-tile:active,
    .length-row:active,
    .letter-chip:active {
      transform: none;
    }
  }

  /* ── Mid tier: unfolded foldables + small tablets (640–899px) ──────
     Z Fold unfolded portrait (~740cqw) and iPad portrait landed in the phone
     tier: a 520px ribbon stranding 100px+ of dead space per side while the
     stacked chooser forced a scroll. Two-up heroes (show-all spanning) and a
     wrapping mini-grid pull the chooser back above the fold. Value screens
     keep the phone list — capped and centered as ONE band with their header
     so Back sits on the content edge, not the far stage edge (same shared-
     band trick as the desktop tier). Sheet variant (≤480px drawer) can't
     reach this tier. */
  @container drill (min-width: 640px) and (max-width: 899.98px) {
    .drill-screen > .drill-head.with-back,
    .drill-screen > .value-list,
    .drill-screen > .letter-grid {
      width: 100%;
      max-width: 560px;
      align-self: center;
    }
  }

  /* ── Desktop (wide container) ──────────────────────────────────────
     The drill was born mobile-first and shipped as a 520px ribbon on every
     screen size — on a 4K monitor that's a strip floating in empty ocean.
     Past 900px of container width the stage earns real estate: hero tiles go
     two-up, the mini-grid spreads to four columns, and every value screen
     lays its choices out as a multi-column wall instead of a phone list.
     Nothing here touches the phone layout, and the filter-sheet variant's
     drawer (≤480px) can never reach these rules. */
  @container drill (min-width: 900px) {
    .drill-head h2 {
      font-size: 1.6rem;
    }
    .drill-head p {
      font-size: 0.95rem;
    }
    .drill-screen {
      gap: 1rem;
    }


    /* Back earns its label once the wide stage strands it away from the title. */
    .head-back {
      padding: 0 1.1rem 0 0.95rem;
    }
    .head-back-label {
      display: inline;
    }
    .creator-avatar {
      width: 56px;
      height: 56px;
    }
    .creator-row {
      min-height: 96px;
    }

    /* Value screens: choices tile the width instead of stacking as a phone
       list. auto-fill keeps short catalogs (3 positions, 2 grid modes)
       centered-looking without stranding one giant row. */
    .value-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 0.8rem;
    }
    /* Centered screens (positions, grid mode, creators): cap the header AND the
       list to one shared band and center it, so Back sits at the content's left
       edge — matching the full-width screens — instead of floating far left. The
       cards fill the band (no sub-centering slack) so alignment is exact. */
    .screen-positions > .drill-head.with-back,
    .screen-positions > .value-list,
    .screen-gridmode > .drill-head.with-back,
    .screen-gridmode > .value-list,
    .screen-creator > .drill-head.with-back,
    .screen-creator > .value-list {
      align-self: center;
      width: 100%;
    }
    .screen-positions > .drill-head.with-back,
    .screen-positions > .value-list {
      max-width: 840px;
    }
    .screen-gridmode > .drill-head.with-back,
    .screen-gridmode > .value-list {
      max-width: 560px;
    }
    .screen-creator > .drill-head.with-back,
    .screen-creator > .value-list {
      max-width: 720px;
    }
    .screen-positions > .value-list {
      grid-template-columns: repeat(3, 1fr);
    }
    .screen-gridmode > .value-list {
      grid-template-columns: repeat(2, 1fr);
    }
    /* Creators are rich horizontal rows (avatar + name + count + work-fan), so
       a multi-column grid strands the last creator (5 → ragged 4+1). Keep them
       a single centered column — a most-prolific-first leaderboard that reads
       the same for 5 creators or 50. */
    .value-list.creator-list {
      grid-template-columns: minmax(0, 720px);
      justify-content: center;
    }
    /* Groups of exactly 6 (the six T&D families, a 6-tile mini-grid) square
       up as 3x2 — a 4+2 ragged break reads as an accident, not a set. */
    .value-list:has(> :nth-child(6):last-child) {
      grid-template-columns: repeat(3, 1fr);
    }

    /* Levels: three monument columns — the numeral and gradient carry the
       screen the way the difficulty badges carry the cards. */
    .value-list:has(.level-tile) {
      grid-template-columns: repeat(3, 1fr);
    }
    .level-tile {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.6rem;
      min-height: 230px;
      padding: 1.4rem 1.2rem;
      border-radius: 20px;
    }
    .level-tile .value-numeral {
      font-size: 3.6rem;
      min-width: 0;
    }
    /* Monument order: rank numeral → showcase card → description → count.
       (DOM keeps the phone row order; flex `order` re-stacks the column.) */
    .level-tile .value-numeral {
      order: 1;
    }
    .level-tile :global(.peek) {
      order: 2;
    }
    .level-tile .value-main {
      order: 3;
    }
    .level-tile .value-count {
      order: 4;
    }
    .level-tile .value-main {
      align-items: center;
      gap: 0.45rem;
    }
    .level-tile .value-label {
      font-size: 1.1rem;
    }
    .level-tile .value-desc {
      font-size: 0.85rem;
    }
    .level-tile .value-count {
      font-size: 1.05rem;
    }

    .letter-grid {
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 0.6rem;
    }
    .letter-chip {
      min-height: 70px;
    }

    /* Every value screen joins the levels as monument panels: lead media on
       top, label (+ desc / tag), density, count — centered in a tall column
       instead of a thin horizontal bar stranded in the wide grid. Creators are
       the deliberate exception (kept horizontal — the trailing work-fan is the
       identity, and there are too many for tall panels).
       (.length-row.monument: must outweigh the base .length-row.tall
       min-height, and @container adds no specificity.) */
    .length-row.monument {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.55rem;
      /* Floor, not a fixed height — sparse screens (LOOP, family) were
         stranding the count far below the content in an over-tall panel. */
      min-height: 168px;
      padding: 1.2rem 1.2rem;
      border-radius: 20px;
    }
    .monument .value-main {
      align-items: center;
      gap: 0.4rem;
    }
    .monument .density-bar {
      margin-inline: auto;
    }
    .monument .value-label {
      font-size: 1.05rem;
    }
    .monument .value-count {
      font-size: 1.05rem;
    }
    /* Lead media grows to monument scale, per screen. */
    .monument .value-numeral.small {
      font-size: 3rem;
    }
    .monument .value-img,
    .monument .value-img.family-icon {
      width: 64px;
      height: 64px;
    }
    .monument .value-pictograph {
      width: 148px;
      height: 148px;
    }
    .monument .loop-icon {
      font-size: 2.6rem;
    }
  }

  /* ── Ultra-wide (4K-class) ─────────────────────────────────────────
     Past 1600px the two-up tier starts leaving real acreage unused, so the
     chooser becomes a three-door hub: level / length / show-all as equal hero
     panels in one row, with the ultra PEEK art tier filling them. The stage
     then grows fluidly with its host and caps at 2496px, so 4K canvases gain
     useful scale without turning choices into edge-to-edge targets. */
  @container drill (min-width: 1600px) {
    .drill-head h2 {
      font-size: 1.85rem;
    }
    .drill-head p {
      font-size: 1.05rem;
    }


    .value-list {
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1rem;
    }
    .screen-positions > .drill-head.with-back,
    .screen-positions > .value-list {
      max-width: 960px;
    }
    .screen-gridmode > .drill-head.with-back,
    .screen-gridmode > .value-list {
      max-width: 620px;
    }
    .screen-creator > .drill-head.with-back,
    .screen-creator > .value-list {
      max-width: 820px;
    }
    .value-list.creator-list {
      grid-template-columns: minmax(0, 820px);
    }
    /* Exactly-6 rule again at this tier — the wider auto-fill would break
       the six families 4+2. */
    .value-list:has(> :nth-child(6):last-child) {
      grid-template-columns: repeat(3, 1fr);
    }
    .level-tile {
      min-height: 290px;
    }
    .level-tile .value-numeral {
      font-size: 4.4rem;
    }
    .length-row {
      min-height: 64px;
    }
    .length-row.tall {
      min-height: 88px;
    }
    .letter-grid {
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: 0.7rem;
    }
    .letter-chip {
      min-height: 78px;
    }
    .length-row.monument {
      min-height: 188px;
      padding: 1.4rem 1.5rem;
    }
    .monument .value-img,
    .monument .value-img.family-icon {
      width: 76px;
      height: 76px;
    }
    .monument .value-pictograph {
      width: 176px;
      height: 176px;
    }
    .monument .value-numeral.small {
      font-size: 3.6rem;
    }
    .monument .loop-icon {
      font-size: 3rem;
    }
    .monument .value-label {
      font-size: 1.15rem;
    }
  }

  /* ── Smart Collection decision canvas ─────────────────────────────
     The standard Gallery front door remains editorial and progressive. A
     Smart Collection refinement is a different job: the user has explicitly
     asked to add one filter inside a fixed-height workspace. Its opt-in canvas
     therefore shows every available category together and recomposes value
     choices by their real cardinality. Scrolling remains a safety fallback for
     an unusually large live catalog, not the default navigation mechanism. */
  .drill-ctx.unified-filter-chooser .screen-chooser {
    justify-content: safe center;
    overflow-y: auto;
  }

  .unified-choice-grid {
    display: grid;
    gap: 0.6rem;
    width: min(100%, 72rem);
    flex: 0 1 auto;
    align-self: center;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: minmax(5.5rem, auto);
  }








  .unified-choice-grid:has(> :nth-child(2):last-child),
  .unified-choice-grid:has(> :nth-child(4):last-child),
  .unified-choice-grid:has(> :nth-child(8):last-child),
  .unified-choice-grid:has(> :nth-child(10):last-child) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .unified-choice-grid:has(> :nth-child(5):last-child) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .unified-choice-grid:has(> :nth-child(5):last-child) > :global(.mini-tile) {
    grid-column: span 2;
  }

  .unified-choice-grid:has(> :nth-child(5):last-child) > :last-child {
    grid-column: 2 / span 2;
  }

  .unified-choice-grid:has(> :nth-child(7):last-child) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .unified-choice-grid:has(> :nth-child(7):last-child) > :global(.mini-tile) {
    grid-column: span 2;
  }

  .unified-choice-grid:has(> :nth-child(7):last-child) > :last-child {
    grid-column: 3 / span 2;
  }

  .drill-ctx.adaptive-value-layout .drill-head.with-back {
    position: sticky;
    z-index: 2;
    top: 0;
    width: min(100%, var(--decision-band-width, 90rem));
    max-width: var(--decision-band-width, 90rem);
    flex: 0 0 auto;
    align-self: center;
    padding-bottom: 0.25rem;
    background: var(--theme-panel-bg, #11131a);
  }

  .drill-ctx.adaptive-value-layout .value-list,
  .drill-ctx.adaptive-value-layout .letter-grid {
    display: grid;
    width: min(100%, var(--decision-band-width, 90rem));
    max-width: var(--decision-band-width, 90rem);
    flex: 1 1 0;
    min-height: 0;
    align-self: center;
    align-content: center;
    gap: 0.5rem;
  }

  .drill-ctx.adaptive-value-layout .screen-gridmode .value-grid-preview {
    display: flex;
    width: clamp(5.5rem, 24cqw, 9rem);
    height: clamp(5.5rem, 24cqw, 9rem);
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 1rem;
  }

  .drill-ctx.adaptive-value-layout
    .screen-gridmode
    .value-grid-preview
    :global(.lesson-grid-display),
  .drill-ctx.adaptive-value-layout
    .screen-gridmode
    .value-grid-preview
    :global(.grid-svg) {
    width: 100%;
    max-width: none;
    height: 100%;
  }

  .drill-ctx.adaptive-value-layout .screen-gridmode .value-label {
    font-size: var(--font-size-sm, 14px);
  }

  .drill-ctx.adaptive-value-layout .screen-gridmode .value-desc {
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .drill-ctx.adaptive-value-layout .level-tile,
  .drill-ctx.adaptive-value-layout .length-row.monument {
    height: auto;
    min-height: 44px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.7rem;
    border-radius: 1rem;
    text-align: center;
  }

  .drill-ctx.adaptive-value-layout .screen-level,
  .drill-ctx.adaptive-value-layout .screen-positions {
    --decision-band-width: 96rem;
  }

  .drill-ctx.adaptive-value-layout .screen-gridmode {
    --decision-band-width: 64rem;
  }

  .drill-ctx.adaptive-value-layout .screen-letter {
    --decision-band-width: 104rem;
  }

  .drill-ctx.adaptive-value-layout .level-tile .value-main,
  .drill-ctx.adaptive-value-layout .monument .value-main {
    align-items: center;
    gap: 0.3rem;
  }

  .drill-ctx.adaptive-value-layout .level-tile .density-bar,
  .drill-ctx.adaptive-value-layout .monument .density-bar {
    margin-inline: auto;
  }

  .drill-ctx.adaptive-value-layout .length-row.monument {
    position: relative;
  }

  .drill-ctx.adaptive-value-layout .loop-check {
    position: absolute;
    top: 0.55rem;
    right: 0.55rem;
  }

  .drill-ctx.adaptive-value-layout .turn-picker {
    display: grid;
    width: min(100%, 48rem);
    max-width: 48rem;
    flex: 1 1 0;
    min-height: 0;
    align-self: center;
    align-content: center;
    gap: 1.25rem;
    padding: 1rem;
  }

  .turn-summary {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.45rem;
    color: var(--theme-text, #e8edf6);
    font-variant-numeric: tabular-nums;
  }

  .turn-limit {
    font-size: clamp(2.75rem, 10cqw, 5rem);
    font-weight: 800;
    line-height: 0.9;
  }

  .turn-unit {
    color: var(--theme-text-muted, #9aa6b8);
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
  }

  .turn-count {
    margin-left: 0.35rem;
    color: var(--theme-text-muted, #9aa6b8);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
  }

  .turn-slider-shell {
    width: 100%;
    padding: 0 1rem 1.75rem;
  }

  .turn-picker :global(.turn-slider-root) {
    position: relative;
    display: flex;
    width: 100%;
    min-height: 44px;
    align-items: center;
    touch-action: none;
    user-select: none;
  }

  .turn-slider-track {
    position: relative;
    display: block;
    width: 100%;
    height: 0.55rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    box-shadow: inset 0 0 0 1px var(--theme-stroke, rgba(255, 255, 255, 0.1));
    cursor: pointer;
  }

  .turn-picker :global(.turn-slider-range) {
    position: absolute;
    height: 100%;
    border-radius: inherit;
    background: var(--theme-accent, #6366f1);
  }

  .turn-picker :global(.turn-slider-thumb) {
    position: relative;
    z-index: 2;
    display: block;
    width: 1.9rem;
    height: 1.9rem;
    border: 3px solid var(--theme-panel-bg, #11131a);
    border-radius: 999px;
    background: var(--theme-accent, #6366f1);
    box-shadow:
      0 0 0 1px var(--theme-accent, #6366f1),
      0 0.35rem 1rem rgba(0, 0, 0, 0.35);
    cursor: grab;
  }

  /* The visual knob stays 1.9rem; the HIT AREA meets the 44px floor at every
     width (pseudo-elements participate in the element's hit-testing). */
  .turn-picker :global(.turn-slider-thumb)::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: max(44px, 100%);
    height: max(44px, 100%);
    border-radius: 999px;
    transform: translate(-50%, -50%);
  }

  .turn-picker :global(.turn-slider-thumb:active) {
    cursor: grabbing;
  }

  .turn-picker :global(.turn-slider-thumb:focus-visible) {
    outline: 3px solid
      color-mix(in srgb, var(--theme-accent, #6366f1) 48%, white);
    outline-offset: 3px;
  }

  .turn-picker :global(.turn-slider-tick) {
    z-index: 1;
    width: 0.42rem;
    height: 0.42rem;
    border: 1px solid var(--theme-panel-bg, #11131a);
    border-radius: 999px;
    background: var(--theme-text-muted, #9aa6b8);
    pointer-events: none;
  }

  .turn-picker :global(.turn-slider-tick[data-bounded]) {
    background: var(--theme-text-on-accent, #fff);
  }

  .turn-picker :global(.turn-slider-label) {
    padding-top: 0.55rem;
    color: var(--theme-text-muted, #9aa6b8);
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .turn-picker :global(.turn-slider-label[data-selected]) {
    color: var(--theme-text, #e8edf6);
  }

  .turn-action {
    width: min(100%, 18rem);
    justify-self: center;
  }

  @container drill (max-width: 639.98px) {
    .drill-ctx.unified-filter-chooser .drill-screen {
      gap: 0.55rem;
    }

    .unified-choice-grid {
      gap: 0.35rem;
      grid-auto-rows: minmax(4.25rem, auto);
    }









    /* The complete Smart Collection catalog is ten choices. Two equal columns
       keep every label readable without sending the user to another screen. */
    .unified-choice-grid:has(> :nth-child(2):last-child),
    .unified-choice-grid:has(> :nth-child(4):last-child),
    .unified-choice-grid:has(> :nth-child(8):last-child),
    .unified-choice-grid:has(> :nth-child(10):last-child) {
      grid-auto-rows: minmax(4.25rem, auto);
    }

    .drill-ctx.adaptive-value-layout .drill-screen {
      gap: 0.45rem;
    }

    .drill-ctx.adaptive-value-layout .drill-head h2 {
      font-size: 1.05rem;
    }

    .drill-ctx.adaptive-value-layout .drill-head p {
      font-size: 0.72rem;
      line-height: 1.25;
      text-wrap: balance;
    }

    .drill-ctx.adaptive-value-layout .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(44px, auto);
    }

    .drill-ctx.adaptive-value-layout .screen-level > .value-list,
    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout
      .screen-max-turns
      > .value-list:has(> :nth-child(6):last-child) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(5):last-child)
      > :last-child,
    .drill-ctx.adaptive-value-layout
      .screen-loop
      > .value-list:has(> :nth-child(7):last-child)
      > :last-child,
    .drill-ctx.adaptive-value-layout
      .screen-creator
      > .value-list:has(> :nth-child(7):last-child)
      > :last-child {
      width: calc(50% - 0.25rem);
      grid-column: 1 / -1;
      justify-self: center;
    }

    .drill-ctx.adaptive-value-layout .screen-letter > .letter-grid {
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: minmax(44px, 3.25rem);
      align-content: space-evenly;
      gap: 0.35rem;
    }

    .drill-ctx.adaptive-value-layout .screen-letter > .letter-grid > * {
      grid-column: span 2;
    }

    /* The live catalog currently has 46 letters. Center its final four while
       retaining six equal-width targets on every complete row. */
    .drill-ctx.adaptive-value-layout
      .screen-letter
      > .letter-grid:has(> :nth-child(46):last-child)
      > :nth-child(43) {
      grid-column: 3 / span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-letter
      > .letter-grid:has(> :nth-child(46):last-child)
      > :nth-child(44) {
      grid-column: 5 / span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-letter
      > .letter-grid:has(> :nth-child(46):last-child)
      > :nth-child(45) {
      grid-column: 7 / span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-letter
      > .letter-grid:has(> :nth-child(46):last-child)
      > :nth-child(46) {
      grid-column: 9 / span 2;
    }

    .drill-ctx.adaptive-value-layout .letter-chip {
      height: 100%;
      min-height: 44px;
      gap: 0;
      padding: 0.25rem;
      border-radius: 0.55rem;
    }

    /* The glyph is the decision. Counts remain in the accessible name but do
       not steal the 44px phone target's visual area. */
    .drill-ctx.adaptive-value-layout .letter-count {
      display: none;
    }

    .drill-ctx.adaptive-value-layout .level-tile {
      padding: 0.55rem 0.35rem;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-numeral {
      min-width: 0;
      font-size: 2rem;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-label,
    .drill-ctx.adaptive-value-layout .monument .value-label,
    .drill-ctx.adaptive-value-layout .level-tile .value-count,
    .drill-ctx.adaptive-value-layout .monument .value-count {
      font-size: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-desc,
    .drill-ctx.adaptive-value-layout .monument .value-desc {
      font-size: 0.66rem;
      line-height: 1.2;
    }

    .drill-ctx.adaptive-value-layout .monument .value-numeral.small {
      min-width: 0;
      font-size: 1.9rem;
    }

    .drill-ctx.adaptive-value-layout .monument .value-pictograph {
      width: 4.25rem;
      height: 4.25rem;
    }

    .drill-ctx.adaptive-value-layout .monument .value-img,
    .drill-ctx.adaptive-value-layout .monument .value-img.family-icon {
      width: 2.75rem;
      height: 2.75rem;
    }

    .drill-ctx.adaptive-value-layout .monument .loop-icon {
      width: auto;
      font-size: 1.65rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-desc {
      display: none;
    }

    .drill-ctx.adaptive-value-layout .creator-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout .creator-row {
      height: 100%;
      min-height: 44px;
      flex-direction: column;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.5rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .creator-row .value-main {
      align-items: center;
    }

    .drill-ctx.adaptive-value-layout .creator-fan {
      display: none;
    }

    /* The phone builder has one job per screen. Bounded catalogs use a
       composition sized to their real option count, so the full decision is
       visible without turning the modal body into a scrolling list. */
    .drill-ctx.adaptive-value-layout .screen-length,
    .drill-ctx.adaptive-value-layout .screen-loop,
    .drill-ctx.adaptive-value-layout .screen-family,
    .drill-ctx.adaptive-value-layout .screen-max-turns {
      overflow-y: hidden;
    }

    .drill-ctx.adaptive-value-layout .screen-length > .value-list {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-auto-rows: minmax(6.5rem, 7rem);
      align-content: center;
      gap: 0.45rem;
    }

    /* Seven live lengths form a centered 4 + 3 composition. All seven cards
       keep exactly the same width, unlike the old 3 + 2 + 2 arrangement. */
    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child) {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > * {
      grid-column: span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(5) {
      grid-column: 2 / span 2;
      grid-row: 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(6) {
      grid-column: 4 / span 2;
      grid-row: 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(7) {
      grid-column: 6 / span 2;
      grid-row: 2;
    }

    .drill-ctx.adaptive-value-layout .screen-length .length-row.monument {
      height: 100%;
      gap: 0.2rem;
      padding: 0.4rem 0.25rem;
      border-radius: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode > .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(13rem, 15rem);
      align-content: center;
      gap: 0.65rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .length-row.monument {
      height: 100%;
      gap: 0.65rem;
      padding: 0.8rem 0.5rem;
      border-radius: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-main {
      flex: 0 1 auto;
      gap: 0.35rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .density-bar {
      max-width: 6rem;
      height: 5px;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-count {
      font-size: var(--font-size-sm, 14px);
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-main {
      flex: 0 1 auto;
      gap: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-numeral.small {
      font-size: 1.65rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-label,
    .drill-ctx.adaptive-value-layout .screen-length .value-count {
      font-size: var(--font-size-compact, 12px);
    }

    .drill-ctx.adaptive-value-layout .screen-length .density-bar {
      max-width: 3rem;
      height: 4px;
    }

    /* LOOP names need horizontal room more than poster-sized icons. Seven
       compact rows keep the labels intact and every composable choice visible. */
    .drill-ctx.adaptive-value-layout .screen-loop > .value-list {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: minmax(44px, 2.9rem);
      align-content: center;
      gap: 0.35rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .length-row.monument {
      height: 100%;
      flex-direction: row;
      justify-content: flex-start;
      gap: 0.5rem;
      padding: 0.3rem 0.6rem;
      border-radius: 0.75rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .loop-icon {
      width: 2rem;
      font-size: 1.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-main {
      align-items: stretch;
      gap: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-label {
      overflow: hidden;
      font-size: var(--font-size-compact, 12px);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .density-bar {
      max-width: none;
      height: 4px;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-count {
      font-size: var(--font-size-compact, 12px);
    }

    .drill-ctx.adaptive-value-layout .screen-loop .loop-check {
      position: static;
      width: 1rem;
    }

    .drill-ctx.adaptive-value-layout
      .screen-loop
      > .value-list:has(> :nth-child(7):last-child)
      > :last-child {
      width: 100%;
      grid-column: auto;
      justify-self: stretch;
    }

    /* Creator names are the decision. A full-width row gives long names one
       stable line, while the avatar and count keep each target scannable. */
    .drill-ctx.adaptive-value-layout .screen-creator > .creator-list {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: minmax(44px, 3rem);
      align-content: center;
      gap: 0.35rem;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .creator-row {
      width: 100%;
      height: 100%;
      min-height: 44px;
      flex-direction: row;
      justify-content: flex-start;
      gap: 0.6rem;
      padding: 0.25rem 0.6rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .creator-row .value-main {
      align-items: stretch;
      gap: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .value-label {
      width: 100%;
      overflow: hidden;
      font-size: var(--font-size-compact, 12px);
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .density-bar {
      max-width: none;
      height: 4px;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .value-count {
      margin-left: auto;
      font-size: var(--font-size-compact, 12px);
    }

    .drill-ctx.adaptive-value-layout
      .screen-creator
      > .creator-list:has(> :nth-child(7):last-child)
      > :last-child {
      width: 100%;
      grid-column: auto;
      justify-self: stretch;
    }

    /* The six Timing & Direction families are a stable 2 × 3 set. The icons
       carry their elemental identity; repeating WATER / EARTH / etc. only
       crowds the action label on a phone. */
    .drill-ctx.adaptive-value-layout .screen-family > .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(5.25rem, 5.5rem);
      align-content: center;
      gap: 0.45rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .length-row.monument {
      height: 100%;
      gap: 0.2rem;
      padding: 0.35rem;
      border-radius: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-img.family-icon {
      width: 2rem;
      height: 2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-main {
      gap: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-label,
    .drill-ctx.adaptive-value-layout .screen-family .value-count {
      font-size: var(--font-size-compact, 12px);
    }

    .drill-ctx.adaptive-value-layout .screen-family .density-bar {
      max-width: 4rem;
      height: 4px;
    }

    /* Six turn ceilings stay in a stable 3 × 2 grid from first paint. This
       avoids the transient two-column overflow that could flash a scrollbar
       while the live counts arrived. */
    .drill-ctx.adaptive-value-layout .screen-max-turns > .value-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-auto-rows: minmax(5.5rem, 6rem);
      align-content: center;
      gap: 0.4rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .length-row.monument {
      height: 100%;
      gap: 0.25rem;
      padding: 0.4rem 0.2rem;
      border-radius: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .value-numeral.small {
      font-size: 1.5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .value-main {
      flex: 0 1 auto;
      gap: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .value-label,
    .drill-ctx.adaptive-value-layout .screen-max-turns .value-count {
      font-size: var(--font-size-compact, 12px);
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .density-bar {
      max-width: 3rem;
      height: 4px;
    }
  }

  @container drill (min-width: 640px) {



    .drill-ctx.adaptive-value-layout .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(7rem, auto);
    }

    .drill-ctx.adaptive-value-layout .screen-level > .value-list,
    .drill-ctx.adaptive-value-layout .screen-positions > .value-list,
    .drill-ctx.adaptive-value-layout .screen-max-turns > .value-list,
    .drill-ctx.adaptive-value-layout .screen-family > .value-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout .screen-creator > .creator-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-width: none;
    }

    .drill-ctx.adaptive-value-layout .screen-letter > .letter-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
      grid-auto-rows: minmax(4rem, auto);
    }
  }

  @container drill (min-width: 640px) and (max-width: 899.98px) {
    .drill-ctx.unified-filter-chooser .unified-choice-grid {
      grid-auto-rows: minmax(5.5rem, auto);
    }





  }

  @container drill (min-width: 900px) {
    .unified-choice-grid {
      width: min(100%, clamp(64rem, 78cqw, 94rem));
      gap: 1rem;
      grid-auto-rows: minmax(8rem, auto);
    }

    .drill-ctx.unified-filter-chooser .unified-choice-grid:has(> :nth-child(9)) {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }






    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(5):last-child) {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(5):last-child)
      > * {
      grid-column: span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(5):last-child)
      > :nth-child(4) {
      grid-column: 2 / span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-loop
      > .value-list:has(> :nth-child(7):last-child) {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout
      .screen-loop
      > .value-list:has(> :nth-child(7):last-child)
      > * {
      grid-column: span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-loop
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(5) {
      grid-column: 2 / span 2;
    }

    .drill-ctx.adaptive-value-layout .screen-letter > .letter-grid {
      grid-template-columns: repeat(10, minmax(0, 1fr));
      grid-auto-rows: minmax(4.5rem, auto);
    }

    .drill-ctx.adaptive-value-layout {
      --decision-band-width: clamp(64rem, 78cqw, 96rem);
    }

    .drill-ctx.adaptive-value-layout .screen-level,
    .drill-ctx.adaptive-value-layout .screen-positions {
      --decision-band-width: clamp(64rem, 78cqw, 96rem);
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode {
      --decision-band-width: clamp(48rem, 56cqw, 64rem);
    }

    .drill-ctx.adaptive-value-layout .screen-letter {
      --decision-band-width: clamp(68rem, 82cqw, 104rem);
    }

    .drill-ctx.adaptive-value-layout .level-tile {
      min-height: clamp(17rem, 19cqw, 27rem);
    }

    .drill-ctx.adaptive-value-layout .length-row.monument {
      min-height: clamp(9.5rem, 11cqw, 17rem);
    }
  }

  @container drill (min-width: 1600px) {
    .drill-ctx.unified-filter-chooser .unified-choice-grid {
      width: min(100%, clamp(90rem, 70cqw, 132rem));
      grid-auto-rows: minmax(10rem, auto);
    }


    .drill-ctx.adaptive-value-layout {
      --decision-band-width: clamp(90rem, 72cqw, 132rem);
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode {
      --decision-band-width: clamp(64rem, 48cqw, 90rem);
    }

    .drill-ctx.adaptive-value-layout .screen-letter {
      --decision-band-width: clamp(96rem, 76cqw, 150rem);
    }

    .drill-ctx.adaptive-value-layout .level-tile {
      min-height: clamp(21rem, 16cqw, 31rem);
    }

    .drill-ctx.adaptive-value-layout .length-row.monument {
      min-height: clamp(11rem, 9cqw, 19rem);
    }

    /* The slider is the entire decision surface on this screen. Let it grow
       with native desktop canvases instead of leaving a phone-sized control
       floating in the middle of a 2K modal. */
    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-picker {
      width: min(100%, clamp(64rem, 54cqw, 84rem));
      max-width: none;
      gap: 2rem;
      padding: 2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-limit {
      font-size: clamp(4.75rem, 4.2cqw, 6.75rem);
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-unit {
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-count {
      font-size: 0.9rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-slider-track {
      height: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns :global(.turn-slider-thumb) {
      width: 2.75rem;
      height: 2.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns :global(.turn-slider-label) {
      padding-top: 0.75rem;
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-action {
      width: min(100%, 24rem);
    }
  }

  @container drill (min-width: 2600px) {





    .drill-ctx.adaptive-value-layout .level-tile {
      gap: 0.85rem;
      padding: 2rem;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-numeral {
      font-size: 5.25rem;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-label,
    .drill-ctx.adaptive-value-layout .monument .value-label {
      font-size: 1.65rem;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-desc,
    .drill-ctx.adaptive-value-layout .monument .value-desc {
      font-size: 1.1rem;
      line-height: 1.35;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-count,
    .drill-ctx.adaptive-value-layout .monument .value-count {
      font-size: 1.4rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-picker {
      width: min(100%, clamp(88rem, 52cqw, 112rem));
      gap: 2.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-limit {
      font-size: clamp(6.75rem, 3.6cqw, 8.5rem);
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-unit {
      font-size: 1.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-count {
      font-size: 1.1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-slider-track {
      height: 0.9rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns :global(.turn-slider-thumb) {
      width: 3.25rem;
      height: 3.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns :global(.turn-slider-label) {
      padding-top: 0.9rem;
      font-size: 1.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-action {
      width: min(100%, 32rem);
    }
  }

  /* Portrait tablets should follow their long axis. Three-choice screens use
     one substantial vertical stack instead of a short strip surrounded by
     unused height. The same cards stay multi-column in landscape. */
  @media (min-width: 700px) and (max-width: 1100px) and (orientation: portrait) {
    .drill-ctx.adaptive-value-layout .screen-level,
    .drill-ctx.adaptive-value-layout .screen-positions {
      --decision-band-width: 34rem;
    }

    .drill-ctx.adaptive-value-layout .screen-level > .value-list,
    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: minmax(clamp(9rem, 14dvh, 12rem), auto);
      gap: 0.875rem;
    }

    .drill-ctx.adaptive-value-layout .screen-level .level-tile,
    .drill-ctx.adaptive-value-layout .screen-positions .length-row.monument {
      min-height: clamp(9rem, 14dvh, 12rem);
      flex-direction: row;
      justify-content: flex-start;
      gap: 1rem;
      padding: 1rem 1.25rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout .screen-level .value-main,
    .drill-ctx.adaptive-value-layout .screen-positions .value-main {
      flex: 1;
      align-items: flex-start;
    }

    .drill-ctx.adaptive-value-layout .screen-level .density-bar,
    .drill-ctx.adaptive-value-layout .screen-positions .density-bar {
      margin-inline: 0;
    }

    .drill-ctx.adaptive-value-layout .screen-level .value-count,
    .drill-ctx.adaptive-value-layout .screen-positions .value-count {
      margin-left: auto;
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-level .level-tile :global(.peek) {
      order: -1;
      flex: 0 0 auto;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
      width: 6rem;
      height: 6rem;
    }
  }

  /* A desktop rule rail can be phone-width but is not phone-height. When it
     has the vertical room, keep three-choice pickers as readable rows rather
     than crushing them into three tiny columns at the far left of a 4K modal. */
  @media (min-height: 840px) {
    @container drill (max-width: 639.98px) {
      .drill-ctx.adaptive-value-layout .screen-level,
      .drill-ctx.adaptive-value-layout .screen-positions {
        --decision-band-width: 28rem;
      }

      .drill-ctx.adaptive-value-layout .screen-level > .value-list,
      .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
        grid-template-columns: minmax(0, 1fr);
        grid-auto-rows: minmax(clamp(8.5rem, 15dvh, 13rem), auto);
        gap: 0.65rem;
      }

      .drill-ctx.adaptive-value-layout .screen-level .level-tile,
      .drill-ctx.adaptive-value-layout .screen-positions .length-row.monument {
        min-height: clamp(8.5rem, 15dvh, 13rem);
        flex-direction: row;
        justify-content: flex-start;
        gap: 0.75rem;
        padding: 0.75rem;
        text-align: left;
      }

      .drill-ctx.adaptive-value-layout .screen-level .value-main,
      .drill-ctx.adaptive-value-layout .screen-positions .value-main {
        flex: 1;
        align-items: flex-start;
      }

      .drill-ctx.adaptive-value-layout .screen-level .density-bar,
      .drill-ctx.adaptive-value-layout .screen-positions .density-bar {
        margin-inline: 0;
      }

      .drill-ctx.adaptive-value-layout .screen-level .value-count,
      .drill-ctx.adaptive-value-layout .screen-positions .value-count {
        margin-left: auto;
      }

      .drill-ctx.adaptive-value-layout .screen-level .level-tile :global(.peek) {
        order: -1;
        flex: 0 0 auto;
      }

      .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
        width: 5.5rem;
        height: 5.5rem;
      }
    }
  }

  /* The unfolded Fold is wide enough for four length choices without turning
     them into tiny phone chips. Center the final three as a second row so the
     seven-value catalog reads as one balanced set instead of 2 + 2 + 2 + 1. */
  @media (min-width: 640px) and (max-width: 899.98px) and (max-height: 900px) {
    .drill-ctx.adaptive-value-layout .screen-length > .value-list {
      grid-template-columns: repeat(8, minmax(0, 1fr));
      grid-auto-rows: minmax(8.5rem, 11rem);
      align-content: center;
    }

    .drill-ctx.adaptive-value-layout .screen-length > .value-list > .length-row {
      grid-column: span 2;
    }

    .drill-ctx.adaptive-value-layout .screen-length > .value-list > :nth-child(5) {
      grid-column: 2 / span 2;
    }
  }

  /* Fold landscape is the one case where vertical fill and tap size compete.
     Use balanced horizontal bands, while keeping every option on the canvas. */
  @media (min-width: 700px) and (max-height: 520px) {
    .drill-ctx.unified-filter-chooser .screen-chooser {
      gap: 0.45rem;
      overflow-y: hidden;
    }

    /* Chooser-only: the value screens' hints are handled below, where the
       multi-select screens keep theirs (audit C-1). */
    .drill-ctx.unified-filter-chooser .screen-chooser .drill-head p {
      display: none;
    }

    .drill-ctx.unified-filter-chooser .unified-choice-grid:has(> :nth-child(9)) {
      width: 100%;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(44px, 1fr));
      grid-auto-rows: minmax(44px, 1fr);
      gap: 0.45rem;
    }

    .drill-ctx.unified-filter-chooser
      .unified-choice-grid:has(> :nth-child(9))
      > :global(.mini-tile) {
      grid-column: span 2;
      min-height: 44px;
      flex-direction: row;
      gap: 0.45rem;
      padding: 0.4rem 0.55rem;
      text-align: left;
    }

    .drill-ctx.unified-filter-chooser
      .unified-choice-grid:has(> :nth-child(9))
      > :global(.mini-tile)
      :global(.mini-main) {
      align-items: flex-start;
    }

    .drill-ctx.unified-filter-chooser
      .unified-choice-grid:has(> :nth-child(9))
      > :global(.mini-tile)
      :global(.mini-sub) {
      display: none;
    }



    .unified-choice-grid:has(> :nth-child(9):last-child) > :nth-child(6) {
      grid-column: 2 / span 2;
    }

    .unified-choice-grid:has(> :nth-child(8):last-child) > :nth-child(6) {
      grid-column: 3 / span 2;
    }

    .unified-choice-grid:has(> :nth-child(7):last-child) > :nth-child(6) {
      grid-column: 4 / span 2;
    }

    .unified-choice-grid:has(> :nth-child(6):last-child) > :nth-child(6) {
      grid-column: 5 / span 2;
    }

    /* Short-height density drops the header hint EXCEPT on the multi-select
       screens — "tap several to combine" is the only signal that these
       editors stack, and losing it while a "choose one" footer shows was a
       flat contradiction (audit C-1). */
    .drill-ctx.adaptive-value-layout
      .drill-screen:not(.screen-loop, .screen-family)
      .drill-head
      p {
      display: none;
    }

    .drill-ctx.adaptive-value-layout .value-list,
    .drill-ctx.adaptive-value-layout .screen-length > .value-list,
    .drill-ctx.adaptive-value-layout .screen-max-turns > .value-list,
    .drill-ctx.adaptive-value-layout .screen-family > .value-list {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-auto-rows: minmax(44px, 1fr);
      gap: 0.4rem;
    }

    .drill-ctx.adaptive-value-layout .screen-level > .value-list,
    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode > .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list > * {
      grid-column: span 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-loop
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(5) {
      grid-column: 2 / span 2;
    }

    .drill-ctx.adaptive-value-layout .screen-creator > .creator-list {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .drill-ctx.adaptive-value-layout .screen-letter > .letter-grid {
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: minmax(44px, 1fr);
      gap: 0.25rem;
    }

    .drill-ctx.adaptive-value-layout .level-tile,
    .drill-ctx.adaptive-value-layout .length-row.monument {
      min-height: 44px;
      flex-direction: row;
      justify-content: flex-start;
      gap: 0.5rem;
      padding: 0.45rem 0.6rem;
      border-radius: 0.75rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout .level-tile .value-main,
    .drill-ctx.adaptive-value-layout .monument .value-main {
      align-items: flex-start;
    }

    .drill-ctx.adaptive-value-layout .level-tile :global(.peek),
    .drill-ctx.adaptive-value-layout .screen-loop .value-desc {
      display: none;
    }

    .drill-ctx.adaptive-value-layout .monument .value-pictograph,
    .drill-ctx.adaptive-value-layout .monument .value-img,
    .drill-ctx.adaptive-value-layout .monument .value-img.family-icon {
      width: 2.5rem;
      height: 2.5rem;
    }

    .drill-ctx.adaptive-value-layout .creator-fan {
      display: none;
    }

    .drill-ctx.adaptive-value-layout .letter-chip {
      min-height: 44px;
      padding: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .letter-count {
      display: none;
    }

    .drill-ctx.adaptive-value-layout .drill-head.with-back {
      position: relative;
      top: auto;
      width: 100%;
      max-width: none;
      padding-bottom: 0;
      background: transparent;
    }

    .drill-ctx.adaptive-value-layout .screen-level > .value-list {
      width: min(100%, 50rem);
      max-width: 50rem;
      height: 100%;
      grid-auto-rows: minmax(8.75rem, 9.5rem);
      align-content: center;
    }

    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      height: 100%;
      grid-auto-rows: minmax(0, 1fr);
      align-content: stretch;
    }

    .drill-ctx.adaptive-value-layout .screen-level .level-tile {
      display: grid;
      height: 100%;
      min-height: 0;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: "numeral main count";
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout .screen-level .level-tile > :global(.peek) {
      display: none;
    }

    .drill-ctx.adaptive-value-layout .screen-level .value-numeral {
      min-width: 0;
      grid-area: numeral;
      font-size: 3.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-level .value-main {
      grid-area: main;
      align-items: flex-start;
    }

    .drill-ctx.adaptive-value-layout .screen-level .value-count {
      grid-area: count;
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-level .value-label {
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-level .value-desc {
      font-size: var(--font-size-compact, 12px);
      line-height: 1.25;
    }

    .drill-ctx.adaptive-value-layout .screen-level .density-bar {
      width: 100%;
      max-width: 8rem;
      margin-inline: 0;
    }

    .drill-ctx.adaptive-value-layout .screen-length > .value-list {
      height: 100%;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      align-content: stretch;
    }

    .drill-ctx.adaptive-value-layout .screen-length .length-row.monument {
      height: 100%;
      min-height: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.65rem 0.45rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-numeral.small {
      font-size: 3rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-main {
      flex: 0 0 auto;
      align-items: center;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-label,
    .drill-ctx.adaptive-value-layout .screen-length .value-count {
      font-size: var(--font-size-sm, 14px);
    }

    .drill-ctx.adaptive-value-layout .screen-length .density-bar {
      width: 4rem;
      max-width: 4rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode > .value-list {
      height: 100%;
      grid-auto-rows: minmax(0, 1fr);
      align-content: stretch;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .length-row.monument {
      height: 100%;
      min-height: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.5rem 0.75rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-main {
      flex: 0 0 auto;
      align-items: center;
      gap: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-desc {
      white-space: nowrap;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .density-bar {
      width: 5rem;
      max-width: 5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-count {
      position: absolute;
      top: 0.6rem;
      right: 0.7rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .length-row.monument {
      position: relative;
      display: flex;
      height: 100%;
      min-height: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0.3rem;
      padding: 0.45rem 0.7rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
      width: 7.5rem;
      height: 7.5rem;
      flex: 0 0 auto;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-main {
      flex: 0 0 auto;
      align-items: center;
      gap: 0.2rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-label,
    .drill-ctx.adaptive-value-layout .screen-positions .value-count {
      font-size: var(--font-size-sm, 14px);
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-desc {
      font-size: var(--font-size-compact, 12px);
      line-height: 1.25;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .density-bar {
      width: 6rem;
      max-width: 6rem;
      margin-inline: auto;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-count {
      position: absolute;
      top: 0.6rem;
      right: 0.7rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list,
    .drill-ctx.adaptive-value-layout .screen-family > .value-list {
      height: 100%;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      align-content: stretch;
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list > * {
      grid-column: auto !important;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .length-row.monument,
    .drill-ctx.adaptive-value-layout .screen-family .length-row.monument {
      height: 100%;
      min-height: 0;
      flex-direction: row;
      justify-content: flex-start;
      gap: 0.75rem;
      padding: 0.55rem 0.75rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .loop-icon {
      width: 2.75rem;
      font-size: 1.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-main,
    .drill-ctx.adaptive-value-layout .screen-family .value-main {
      align-items: stretch;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-label,
    .drill-ctx.adaptive-value-layout .screen-family .value-label,
    .drill-ctx.adaptive-value-layout .screen-loop .value-count,
    .drill-ctx.adaptive-value-layout .screen-family .value-count {
      font-size: var(--font-size-sm, 14px);
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-img.family-icon {
      width: 3rem;
      height: 3rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-picker {
      width: 100%;
      max-width: none;
      grid-template-columns: 9rem minmax(0, 1fr) 13rem;
      align-items: center;
      gap: 1.25rem;
      padding: 0 1.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-summary {
      display: grid;
      grid-template-columns: auto auto;
      justify-content: start;
      column-gap: 0.4rem;
      row-gap: 0.3rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-limit {
      font-size: 2.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-count {
      grid-column: 1 / -1;
      margin-left: 0;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-slider-shell {
      padding: 0 0.5rem 1.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-action {
      width: 100%;
    }
  }

  /* A tall cover screen is not an iPhone SE with spare pixels. Keep the
     compact phone composition below 820px, then use the extra vertical axis
     for larger, category-specific targets without introducing scrolling. */
  @media (max-width: 480px) and (min-height: 820px) {
    .drill-ctx.unified-filter-chooser .screen-chooser {
      justify-content: safe center;
      gap: 0.75rem;
      overflow-y: hidden;
    }

    .drill-ctx.unified-filter-chooser .unified-choice-grid {
      flex: 0 1 auto;
      gap: 0.45rem;
      grid-auto-rows: minmax(7rem, 7.25rem);
    }








    /* The single-column stretch composition below is tuned to the SHORT
       page-gallery list (≤8 values). A dense builder catalog keeps its
       compact wrapped chips (see the dense section at the end of this file). */
    .drill-ctx.adaptive-value-layout .screen-length > .value-list:not(.dense) {
      grid-template-columns: minmax(0, 1fr) !important;
      grid-auto-rows: minmax(4.65rem, 5rem);
      align-content: center;
      gap: 0.45rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length > .value-list:not(.dense) > * {
      width: 100% !important;
      grid-column: auto !important;
      grid-row: auto !important;
      justify-self: stretch !important;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      .value-list:not(.dense)
      .length-row.monument {
      height: 100%;
      min-height: 0;
      flex-direction: row;
      justify-content: flex-start;
      gap: 0.75rem;
      padding: 0.45rem 0.8rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      .value-list:not(.dense)
      .value-numeral.small {
      min-width: 3rem;
      font-size: 2.25rem;
      text-align: left;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      .value-list:not(.dense)
      .value-main {
      flex: 1 1 auto;
      align-items: stretch;
      gap: 0.3rem;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      .value-list:not(.dense)
      .density-bar {
      width: 100%;
      max-width: none;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      .value-list:not(.dense)
      .value-count {
      margin-left: auto;
      font-size: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      grid-auto-rows: minmax(10.25rem, 10.75rem);
      align-content: center;
      gap: 0.65rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .length-row.monument {
      height: 100%;
      min-height: 0;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
      width: 7.5rem;
      height: 7.5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode > .value-list {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: minmax(14rem, 15rem);
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .length-row.monument {
      height: 100%;
      min-height: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0.55rem;
      padding: 0.75rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-main {
      flex: 0 1 auto;
      align-items: center;
      gap: 0.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .density-bar {
      width: 7rem;
      max-width: 7rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(8rem, 8.75rem));
      grid-auto-rows: minmax(8rem, 8.75rem);
      align-content: center;
      gap: 0.55rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list > * {
      width: 100% !important;
      grid-column: auto !important;
      grid-row: auto !important;
      justify-self: stretch !important;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .length-row.monument {
      height: 100%;
      min-height: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.5rem 0.35rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .loop-icon {
      width: auto;
      font-size: 2.35rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-main {
      flex: 0 1 auto;
      align-items: center;
      gap: 0.3rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-label {
      font-size: 0.75rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .density-bar {
      width: 5rem;
      max-width: 5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-count {
      font-size: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-creator > .creator-list {
      grid-auto-rows: minmax(4rem, 4.35rem);
      align-content: center;
      gap: 0.4rem;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .creator-row {
      gap: 0.7rem;
      padding: 0.35rem 0.7rem;
    }

    .drill-ctx.adaptive-value-layout
      .screen-creator
      :global(.creator-avatar.robust-avatar) {
      --avatar-size: 2.75rem !important;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .value-label,
    .drill-ctx.adaptive-value-layout .screen-creator .value-count {
      font-size: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family > .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(7.5rem, 8rem));
      grid-auto-rows: minmax(7.5rem, 8rem);
      align-content: center;
      gap: 0.55rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .length-row.monument {
      height: 100%;
      min-height: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.5rem 0.35rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-img.family-icon {
      width: 3.75rem;
      height: 3.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-main {
      flex: 0 1 auto;
      align-items: center;
      gap: 0.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-label,
    .drill-ctx.adaptive-value-layout .screen-family .value-count {
      font-size: 0.75rem;
      text-align: center;
    }

    .drill-ctx.adaptive-value-layout .screen-family .density-bar {
      width: 5rem;
      max-width: 5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-picker {
      width: 100%;
      max-width: none;
      gap: 2rem;
      padding: 1.5rem 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-limit {
      font-size: 4.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-unit {
      font-size: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-count {
      font-size: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-slider-shell {
      padding-inline: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-slider-track {
      height: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns :global(.turn-slider-thumb) {
      width: 2.75rem;
      height: 2.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-max-turns .turn-action {
      width: 100%;
    }
  }

  @media (min-width: 700px) and (max-width: 900px) and (min-height: 1000px) {
    .drill-ctx.unified-filter-chooser
      .unified-choice-grid:has(> :nth-child(10):last-child) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: 9rem;
      align-content: center;
      gap: 0.75rem;
    }








    /* Seven values need a composition, not an orphan. A 2 / 3 / 2 diamond
       gives every length a substantial tablet target while preserving one
       glance access to the complete set. */
    .drill-ctx.adaptive-value-layout .screen-length {
      --decision-band-width: 49rem;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child) {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-rows: repeat(3, 15rem);
      grid-auto-rows: 15rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > * {
      height: 100%;
      grid-column: span 2;
      grid-row: auto;
      justify-self: stretch;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(1) {
      grid-column: 2 / span 2;
      grid-row: 1;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(2) {
      grid-column: 4 / span 2;
      grid-row: 1;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(3) {
      grid-column: 1 / span 2;
      grid-row: 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(4) {
      grid-column: 3 / span 2;
      grid-row: 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(5) {
      grid-column: 5 / span 2;
      grid-row: 2;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(6) {
      grid-column: 2 / span 2;
      grid-row: 3;
    }

    .drill-ctx.adaptive-value-layout
      .screen-length
      > .value-list:has(> :nth-child(7):last-child)
      > :nth-child(7) {
      grid-column: 4 / span 2;
      grid-row: 3;
    }

    .drill-ctx.adaptive-value-layout .screen-length .length-row.monument {
      min-height: 0;
      gap: 0.6rem;
      padding: 1rem 0.7rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-numeral.small {
      font-size: 3.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-label,
    .drill-ctx.adaptive-value-layout .screen-length .value-count {
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .density-bar {
      width: 5rem;
      max-width: 5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions {
      --decision-band-width: 44rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: 15rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .length-row.monument {
      height: 100%;
      min-height: 0;
      gap: 1.25rem;
      padding: 1.1rem 1.35rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
      width: 10rem;
      height: 10rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-label,
    .drill-ctx.adaptive-value-layout .screen-positions .value-count {
      font-size: 1.05rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-desc {
      font-size: 0.86rem;
    }

    /* Portrait tablet comparisons follow the long axis. The live grid
       primitive carries the theme, so the diagrams can own most of each card
       instead of sitting on a small white legacy plate. */
    .drill-ctx.adaptive-value-layout .screen-gridmode {
      --decision-band-width: 38rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode > .value-list {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: repeat(2, 21rem);
      grid-auto-rows: 21rem;
      align-content: center;
      gap: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .length-row.monument {
      height: 100%;
      min-height: 0;
      gap: 0.75rem;
      padding: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-grid-preview {
      width: 13rem;
      height: 13rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-label,
    .drill-ctx.adaptive-value-layout .screen-gridmode .value-count {
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .value-desc {
      font-size: 0.86rem;
    }

    .drill-ctx.adaptive-value-layout .screen-gridmode .density-bar {
      width: 8rem;
      max-width: 8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, 15rem);
      grid-auto-rows: 15rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop > .value-list > * {
      width: 100%;
      grid-column: auto;
      grid-row: auto;
      justify-self: stretch;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .length-row.monument {
      height: 100%;
      min-height: 0;
      gap: 0.7rem;
      padding: 0.9rem 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .loop-icon {
      width: auto;
      font-size: 3.25rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-label,
    .drill-ctx.adaptive-value-layout .screen-loop .value-count {
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .value-desc {
      display: block;
      font-size: 0.8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-loop .density-bar {
      width: 8rem;
      max-width: 8rem;
    }

    .drill-ctx.adaptive-value-layout .screen-creator > .creator-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: 10.75rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .creator-row {
      height: 100%;
      min-height: 0;
      gap: 1rem;
      padding: 0.85rem 1rem;
    }

    .drill-ctx.adaptive-value-layout
      .screen-creator
      :global(.creator-avatar.robust-avatar) {
      --avatar-size: 4rem !important;
    }

    .drill-ctx.adaptive-value-layout .screen-creator .value-label,
    .drill-ctx.adaptive-value-layout .screen-creator .value-count {
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family > .value-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(3, 14.5rem);
      grid-auto-rows: 14.5rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .length-row.monument {
      height: 100%;
      min-height: 0;
      gap: 0.65rem;
      padding: 0.9rem 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-img.family-icon {
      width: 6rem;
      height: 6rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .value-label,
    .drill-ctx.adaptive-value-layout .screen-family .value-count {
      font-size: 1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-family .density-bar {
      width: 7rem;
      max-width: 7rem;
    }
  }

  /* The unfolded portrait is much shorter than a tablet. Keep the balanced
     4 + 3 length set, but let its two rows and numerals use the available
     height instead of inheriting the phone-sized card treatment. */
  @media (min-width: 700px) and (max-width: 899.98px) and (min-height: 760px) and (max-height: 900px) and (orientation: portrait) {
    .drill-ctx.adaptive-value-layout .screen-length > .value-list {
      grid-template-columns: repeat(8, minmax(0, 1fr));
      grid-template-rows: repeat(2, 15rem);
      grid-auto-rows: 15rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length > .value-list > * {
      height: 100%;
      grid-column: span 2;
    }

    .drill-ctx.adaptive-value-layout .screen-length > .value-list > :nth-child(5) {
      grid-column: 2 / span 2;
    }

    .drill-ctx.adaptive-value-layout .screen-length .length-row.monument {
      min-height: 0;
      gap: 0.55rem;
      padding: 0.9rem 0.45rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-numeral.small {
      font-size: 3.1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .value-label,
    .drill-ctx.adaptive-value-layout .screen-length .value-count {
      font-size: 0.95rem;
    }

    .drill-ctx.adaptive-value-layout .screen-length .density-bar {
      width: 4.5rem;
      max-width: 4.5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions {
      --decision-band-width: 44rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      grid-auto-rows: 11rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .length-row.monument {
      height: 100%;
      min-height: 0;
      gap: 1rem;
      padding: 0.9rem 1.1rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
      width: 7.75rem;
      height: 7.75rem;
    }
  }

  /* Open landscape keeps one row, but the diagrams are the decision and need
     enough area to be read without leaning into the screen. */
  @media (min-width: 800px) and (max-width: 899.98px) and (min-height: 600px) and (max-height: 900px) and (orientation: landscape) {
    .drill-ctx.adaptive-value-layout .screen-positions {
      --decision-band-width: 100%;
    }

    .drill-ctx.adaptive-value-layout .screen-positions > .value-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-auto-rows: 15.5rem;
      align-content: center;
      gap: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .length-row.monument {
      height: 100%;
      min-height: 0;
      gap: 0.5rem;
      padding: 0.75rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
      width: 9.5rem;
      height: 9.5rem;
    }

    .drill-ctx.adaptive-value-layout .screen-positions .value-label,
    .drill-ctx.adaptive-value-layout .screen-positions .value-count {
      font-size: 1rem;
    }
  }

  /* Smart Collection desktop composer. Compact phones, Fold modes, and the
     approved portrait tablet all stay below this two-dimensional seam. The
     catalog persists only while editing a value, so the first chooser remains
     a clean overview and the desktop stops forcing Back-driven drilldowns. */
  @media (min-height: 650px) {
    @container drill (min-width: 900px) {
      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-screen {
        padding: 0.75rem;
      }

      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back {
        position: static;
        width: 100%;
        max-width: none;
        grid-template-columns: minmax(0, 1fr);
        padding-bottom: 0;
        background: transparent;
      }

      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back
        .head-back {
        display: none;
      }

      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back
        h2,
      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back
        p {
        grid-column: 1;
      }

      .drill-ctx.persistent-desktop-catalog .screen-length {
        --decision-band-width: 100%;
      }

      .drill-ctx.persistent-desktop-catalog
        .screen-length
        > .value-list:has(> :nth-child(7):last-child) {
        grid-template-columns: repeat(7, minmax(0, 1fr));
        grid-template-rows: minmax(11rem, 14rem);
        grid-auto-rows: minmax(11rem, 14rem);
        align-content: center;
        gap: 0.65rem;
      }

      .drill-ctx.persistent-desktop-catalog
        .screen-length
        > .value-list:has(> :nth-child(7):last-child)
        > * {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        grid-column: auto;
        grid-row: auto;
        justify-self: stretch;
      }

      .drill-ctx.persistent-desktop-catalog .screen-length .length-row.monument {
        min-height: 0;
        gap: 0.6rem;
        padding: 1rem 0.5rem;
      }

      .drill-ctx.persistent-desktop-catalog .screen-length .value-numeral.small {
        font-size: clamp(2.5rem, 3.2cqw, 3.6rem);
      }

      .drill-ctx.persistent-desktop-catalog .screen-length .density-bar {
        width: min(100%, 5.5rem);
        max-width: 5.5rem;
      }

      .drill-ctx.persistent-desktop-catalog .screen-length .value-count {
        font-size: 0.95rem;
      }
    }
  }

  /* ── Large-canvas scale tiers (audit D-1/D-10/D-13, C1/C5) ─────────────
     The editor COLUMN is deliberately width-capped at desktop (Austen: extra
     width belongs to live results, controls stay human-sized). What must NOT
     stay frozen is the scale INSIDE that capped pane: on tall displays the
     type, decision art, and card heights step up so the pane's vertical is
     spent on the decision instead of black. Height-keyed because the pane's
     WIDTH is capped by design — cqw can never reach a 4K tier here. */
  @media (min-height: 1150px) {
    @container drill (min-width: 1200px) {
      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back
        h2 {
        font-size: 1.6rem;
      }

      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back
        p {
        font-size: 1rem;
      }

      .drill-ctx.persistent-desktop-catalog
        .screen-length
        > .value-list:has(> :nth-child(7):last-child) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: none;
        grid-auto-rows: minmax(15rem, 19rem);
      }

      /* Content groups in the card's center — numeral, unit, bar, count as
         one readable stack instead of fragments pinned to the card's edges
         with a hollow middle (audit D-18). */
      .drill-ctx.persistent-desktop-catalog .screen-length .length-row.monument {
        justify-content: center;
        gap: 0.85rem;
      }

      .drill-ctx.persistent-desktop-catalog .screen-length .value-numeral.small {
        font-size: clamp(3rem, 3.6cqw, 4.25rem);
      }

      .drill-ctx.adaptive-value-layout .screen-gridmode .value-grid-preview {
        width: clamp(9rem, 13cqw, 14rem);
        height: clamp(9rem, 13cqw, 14rem);
      }

      .drill-ctx.adaptive-value-layout .screen-gridmode > .value-list {
        grid-auto-rows: minmax(17rem, 21rem);
      }

      .drill-ctx.adaptive-value-layout .screen-gridmode .value-label {
        font-size: 1.2rem;
      }

      .drill-ctx.adaptive-value-layout .screen-gridmode .value-desc,
      .drill-ctx.adaptive-value-layout .screen-positions .value-desc {
        font-size: var(--font-size-sm, 14px);
      }

      .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
        width: clamp(11rem, 14cqw, 16rem);
        height: clamp(11rem, 14cqw, 16rem);
      }

      .drill-ctx.adaptive-value-layout .screen-positions .value-label,
      .drill-ctx.adaptive-value-layout .screen-level .value-label {
        font-size: 1.2rem;
      }

      .drill-ctx.adaptive-value-layout .creator-row {
        min-height: 8.5rem;
      }

    }
  }

  @media (min-height: 1900px) {
    @container drill (min-width: 1200px) {
      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back
        h2 {
        font-size: 2rem;
      }

      .drill-ctx.persistent-desktop-catalog:not([data-section="chooser"])
        .drill-head.with-back
        p {
        font-size: 1.15rem;
      }

      .drill-ctx.persistent-desktop-catalog
        .screen-length
        > .value-list:has(> :nth-child(7):last-child) {
        grid-auto-rows: minmax(20rem, 24rem);
        gap: 1rem;
      }

      .drill-ctx.persistent-desktop-catalog .screen-length .value-numeral.small {
        font-size: 5rem;
      }

      .drill-ctx.persistent-desktop-catalog .screen-length .value-count {
        font-size: 1.2rem;
      }

      .drill-ctx.adaptive-value-layout .screen-gridmode .value-grid-preview {
        width: 18rem;
        height: 18rem;
      }

      .drill-ctx.adaptive-value-layout .screen-gridmode > .value-list {
        grid-auto-rows: minmax(26rem, 30rem);
      }

      .drill-ctx.adaptive-value-layout .screen-gridmode .value-label,
      .drill-ctx.adaptive-value-layout .screen-positions .value-label,
      .drill-ctx.adaptive-value-layout .screen-level .value-label {
        font-size: 1.5rem;
      }

      .drill-ctx.adaptive-value-layout .screen-positions .value-pictograph {
        width: 20rem;
        height: 20rem;
      }

      .drill-ctx.adaptive-value-layout .level-tile {
        min-height: clamp(26rem, 30cqh, 34rem);
      }

      .drill-ctx.adaptive-value-layout .creator-row {
        min-height: 11rem;
      }

      .drill-ctx.adaptive-value-layout .screen-letter > .letter-grid {
        grid-auto-rows: minmax(6.5rem, auto);
      }

      .drill-ctx.adaptive-value-layout .letter-chip :global(svg) {
        transform: scale(1.35);
      }

      .drill-ctx.adaptive-value-layout .screen-max-turns .turn-limit {
        font-size: 8rem;
      }

      .drill-ctx.adaptive-value-layout .screen-max-turns .turn-count,
      .drill-ctx.adaptive-value-layout .screen-max-turns .turn-unit {
        font-size: 1.3rem;
      }

    }
  }

  /* ── Dense length catalog ──────────────────────────────────────────
     The builder shows every live length (no ≥3 noise floor), so the list can
     run ~19 values. The monument compositions above are all keyed to small
     counts (5 or 7) and collapse into two giant scrolling columns past that.
     Past 8 values the list switches to compact chips: flex-wrap centers any
     partial final row for free at every cardinality, and the pinned per-row
     widths keep the whole catalog on screen at every tier. This section sits
     last on purpose — it must outrank every tiered monument rule. */
  .drill-ctx .screen-length:has(> .value-list.dense) {
    overflow-y: auto;
  }

  .drill-ctx .screen-length > .value-list.dense {
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    align-content: center;
    gap: 0.5rem;
  }

  .drill-ctx .screen-length > .value-list.dense > .length-row.monument {
    flex: 0 0 auto;
    width: calc(25% - 0.375rem);
    height: auto;
    min-height: 3.75rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    padding: 0.45rem 0.3rem;
    border-radius: 0.85rem;
    text-align: center;
  }

  .drill-ctx .screen-length > .value-list.dense .value-numeral.small {
    min-width: 0;
    font-size: 1.5rem;
  }

  .drill-ctx .screen-length > .value-list.dense .value-main {
    flex: 0 0 auto;
    align-items: center;
    gap: 0.1rem;
  }

  .drill-ctx .screen-length > .value-list.dense .value-label.muted {
    font-size: 0.62rem;
  }

  .drill-ctx .screen-length > .value-list.dense .density-bar {
    display: none;
  }

  .drill-ctx .screen-length > .value-list.dense .value-count {
    font-size: 0.78rem;
  }

  @container drill (min-width: 640px) {
    .drill-ctx .screen-length > .value-list.dense {
      width: min(100%, 44rem);
      align-self: center;
      gap: 0.6rem;
    }

    .drill-ctx .screen-length > .value-list.dense > .length-row.monument {
      width: calc(20% - 0.48rem);
      min-height: 4.5rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-numeral.small {
      font-size: 1.8rem;
    }
  }

  @container drill (min-width: 900px) {
    .drill-ctx .screen-length > .value-list.dense {
      width: min(100%, 60rem);
      gap: 0.75rem;
    }

    .drill-ctx .screen-length > .value-list.dense > .length-row.monument {
      width: calc(16.666% - 0.625rem);
      min-height: 5.5rem;
      border-radius: 1rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-numeral.small {
      font-size: 2.1rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-label.muted {
      font-size: 0.7rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-count {
      font-size: 0.85rem;
    }
  }

  @container drill (min-width: 1600px) {
    .drill-ctx .screen-length > .value-list.dense {
      width: min(100%, 84rem);
      gap: 1rem;
    }

    .drill-ctx .screen-length > .value-list.dense > .length-row.monument {
      width: calc(16.666% - 0.84rem);
      min-height: 7rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-numeral.small {
      font-size: 2.6rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-label.muted {
      font-size: 0.78rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-count {
      font-size: 0.95rem;
    }
  }

  /* Folded-landscape heights: three chip rows must fit a ~220px body, so the
     chips flatten into slim rows at the 44px touch floor. */
  @media (max-height: 520px) {
    .drill-ctx .screen-length > .value-list.dense {
      gap: 0.4rem;
    }

    .drill-ctx .screen-length > .value-list.dense > .length-row.monument {
      width: calc(16.666% - 0.34rem);
      min-height: 44px;
      flex-direction: row;
      gap: 0.3rem;
      padding: 0.25rem 0.4rem;
      border-radius: 0.6rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-numeral.small {
      font-size: 1.2rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-label.muted {
      font-size: 0.55rem;
    }

    .drill-ctx .screen-length > .value-list.dense .value-count {
      font-size: 0.7rem;
    }
  }

  /* Tall desktop canvases (same height-keyed seam as the monument C1 tiers):
     the capped editor pane gains height, not width, so the dense chips grow
     vertically with it instead of floating small in a tall column. */
  @media (min-height: 1150px) {
    @container drill (min-width: 1200px) {
      .drill-ctx .screen-length > .value-list.dense {
        gap: 1.1rem;
      }

      .drill-ctx .screen-length > .value-list.dense > .length-row.monument {
        width: calc(16.666% - 0.92rem);
        min-height: 8.5rem;
        border-radius: 1.25rem;
      }

      .drill-ctx .screen-length > .value-list.dense .value-numeral.small {
        font-size: 3.1rem;
      }

      .drill-ctx .screen-length > .value-list.dense .value-label.muted {
        font-size: 0.85rem;
      }

      .drill-ctx .screen-length > .value-list.dense .value-count {
        font-size: 1rem;
      }
    }
  }

  @media (min-height: 1900px) {
    @container drill (min-width: 1200px) {
      .drill-ctx .screen-length > .value-list.dense {
        gap: 1.4rem;
      }

      .drill-ctx .screen-length > .value-list.dense > .length-row.monument {
        width: calc(16.666% - 1.17rem);
        min-height: 11rem;
        border-radius: 1.5rem;
      }

      .drill-ctx .screen-length > .value-list.dense .value-numeral.small {
        font-size: 4rem;
      }

      .drill-ctx .screen-length > .value-list.dense .value-label.muted {
        font-size: 1rem;
      }

      .drill-ctx .screen-length > .value-list.dense .value-count {
        font-size: 1.15rem;
      }
    }
  }

  /* ── Split pane (LAST: must outrank every tier above) ──────────── */
  /* Split pane: the editor is a COLUMN under the catalog, not a stage of its
     own. Vertically centering a short option set there opens a hole under the
     header; start at the top and let the column breathe at the bottom, where
     the results grid beside it is already carrying the eye. */
  .drill-ctx.split-pane .drill-screen {
    justify-content: flex-start;
    padding-top: 0.25rem;
  }
  /* `.drill-screen >` matches the per-screen tier rules' weight (they key off
     .screen-loop / .screen-length on this same element), so this override wins
     on order rather than losing on specificity. */
  .drill-ctx.split-pane .drill-screen > .value-list,
  .drill-ctx.split-pane .drill-screen > .letter-grid,
  .drill-ctx.split-pane .drill-screen > .turn-picker {
    flex: 0 1 auto;
    align-content: start;
  }
  /* Back is redundant beside a permanently visible category catalog. */
  .drill-ctx.split-pane .drill-head.with-back {
    position: static;
    grid-template-columns: minmax(0, 1fr);
    background: transparent;
  }
  .drill-ctx.split-pane .drill-head.with-back .head-back {
    display: none;
  }
  .drill-ctx.split-pane .drill-head.with-back h2 {
    grid-column: 1;
    font-size: 1.15rem;
  }
  .drill-ctx.split-pane .drill-head.with-back p {
    grid-column: 1;
  }

  .drill-ctx.sheet .drill-screen {
    justify-content: flex-start;
  }
</style>
