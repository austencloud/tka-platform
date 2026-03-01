<!--
  AsciiLetterPicker.svelte — Letter + variation picker for the ASCII lab.

  Loads pictograph data directly from the static CSV files.
  User clicks a letter → sees variations → clicks a variation → it renders.
  No MCP, no JSON pasting, no manual configuration.

  Domain: Retro DOS Terminal Lab
-->
<script lang="ts">
  import type { RetroHandData, RetroPictographData } from "$lib/features/retro/shared/domain/pictograph-types";
  import {
    GridLocation,
    GridMode,
    MotionType,
    MotionColor,
    Orientation,
  } from "$lib/features/retro/shared/domain/pictograph-types";

  let {
    onLetterLoad,
  }: {
    onLetterLoad: (letter: string, data: RetroPictographData) => void;
  } = $props();

  // -------------------------------------------------------------------
  // CSV row shape (matches DiamondPictographDataframe / BoxPictographDataframe)
  // -------------------------------------------------------------------
  interface CsvRow {
    letter: string;
    startPosition: string;
    endPosition: string;
    timing: string;
    direction: string;
    blueMotionType: string;
    blueRotationDirection: string;
    blueStartLocation: string;
    blueEndLocation: string;
    redMotionType: string;
    redRotationDirection: string;
    redStartLocation: string;
    redEndLocation: string;
  }

  // -------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------
  let allRows = $state<CsvRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedLetter = $state<string | null>(null);
  let selectedVariationIndex = $state<number | null>(null);

  // Derived: unique sorted letters
  const availableLetters = $derived(() => {
    const seen = new Set<string>();
    const letters: string[] = [];
    for (const row of allRows) {
      if (!seen.has(row.letter)) {
        seen.add(row.letter);
        letters.push(row.letter);
      }
    }
    return letters;
  });

  // Derived: variations for selected letter
  const variations = $derived(() => {
    if (!selectedLetter) return [];
    return allRows.filter((r) => r.letter === selectedLetter);
  });

  // -------------------------------------------------------------------
  // CSV loading
  // -------------------------------------------------------------------
  async function loadCsvData(): Promise<void> {
    loading = true;
    error = null;
    try {
      const [diamondResp, boxResp] = await Promise.all([
        fetch("/data/pictographs/DiamondPictographDataframe.csv"),
        fetch("/data/pictographs/BoxPictographDataframe.csv"),
      ]);

      if (!diamondResp.ok || !boxResp.ok) {
        throw new Error("Failed to fetch CSV files");
      }

      const diamondText = await diamondResp.text();
      const boxText = await boxResp.text();

      const diamondRows = parseCsv(diamondText, "diamond");
      const boxRows = parseCsv(boxText, "box");

      allRows = [...diamondRows, ...boxRows];
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load pictograph data";
    } finally {
      loading = false;
    }
  }

  /** Parse CSV text to row objects, tagging each with its grid mode */
  function parseCsv(text: string, _gridMode: string): CsvRow[] {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0]!.split(",").map((h) => h.trim());
    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]!] = values[j] ?? "";
      }
      // Tag with grid mode source
      (obj as Record<string, string>)._gridMode = _gridMode;
      rows.push(obj as unknown as CsvRow);
    }
    return rows;
  }

  // -------------------------------------------------------------------
  // CSV row → RetroPictographData
  // -------------------------------------------------------------------
  function csvRowToRetro(row: CsvRow & { _gridMode?: string }): RetroPictographData {
    const gridMode = row._gridMode === "box" ? GridMode.BOX : GridMode.DIAMOND;

    const blueHand: RetroHandData = {
      color: MotionColor.BLUE,
      location: (row.blueStartLocation as GridLocation) || GridLocation.NORTH,
      endLocation: (row.blueEndLocation as GridLocation) || GridLocation.NORTH,
      motionType: (row.blueMotionType as MotionType) || MotionType.STATIC,
      orientation: Orientation.IN,
      turns: 0,
    };

    const redHand: RetroHandData = {
      color: MotionColor.RED,
      location: (row.redStartLocation as GridLocation) || GridLocation.SOUTH,
      endLocation: (row.redEndLocation as GridLocation) || GridLocation.SOUTH,
      motionType: (row.redMotionType as MotionType) || MotionType.STATIC,
      orientation: Orientation.IN,
      turns: 0,
    };

    return { letter: row.letter, blueHand, redHand, gridMode };
  }

  // -------------------------------------------------------------------
  // User interactions
  // -------------------------------------------------------------------
  function selectLetter(letter: string): void {
    selectedLetter = letter;
    selectedVariationIndex = null;

    // Auto-load first variation
    const letterVariations = allRows.filter((r) => r.letter === letter);
    if (letterVariations.length > 0) {
      selectVariation(0, letterVariations);
    }
  }

  function selectVariation(index: number, vars?: CsvRow[]): void {
    const letterVars = vars ?? variations();
    selectedVariationIndex = index;
    const row = letterVars[index];
    if (row) {
      onLetterLoad(row.letter, csvRowToRetro(row));
    }
  }

  /** Compact description of a variation for the button label */
  function variationLabel(row: CsvRow & { _gridMode?: string }): string {
    const mode = row._gridMode === "box" ? "Box" : "Dia";
    const blue = `B:${row.blueStartLocation}→${row.blueEndLocation}`;
    const red = `R:${row.redStartLocation}→${row.redEndLocation}`;
    return `${mode} ${blue} ${red}`;
  }

  // Load on mount
  $effect(() => {
    loadCsvData();
  });
</script>

<div class="letter-picker">
  {#if loading}
    <span class="status-text">Loading pictograph data...</span>
  {:else if error}
    <span class="status-error">{error}</span>
  {:else}
    <div class="letter-grid">
      {#each availableLetters() as letter}
        <button
          class="letter-btn"
          class:selected={selectedLetter === letter}
          onclick={() => selectLetter(letter)}
        >{letter}</button>
      {/each}
    </div>

    {#if selectedLetter && variations().length > 0}
      <div class="variation-section">
        <span class="section-label">
          {selectedLetter} — {variations().length} variation{variations().length === 1 ? "" : "s"}
        </span>
        <div class="variation-list">
          {#each variations() as row, i}
            <button
              class="variation-btn"
              class:selected={selectedVariationIndex === i}
              onclick={() => selectVariation(i)}
            >{variationLabel(row)}</button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .letter-picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .status-text {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .status-error {
    font-size: var(--font-size-min, 14px);
    color: var(--semantic-error, #ef4444);
  }

  .letter-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .letter-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-family: "Courier New", monospace;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .letter-btn:hover {
    border-color: #33ff33;
    color: #33ff33;
  }

  .letter-btn.selected {
    background: rgba(51, 255, 51, 0.15);
    border-color: #33ff33;
    color: #33ff33;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .variation-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .variation-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .variation-btn {
    padding: 4px 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    font-family: "Courier New", monospace;
    cursor: pointer;
    text-align: left;
    transition: all 150ms ease;
  }

  .variation-btn:hover {
    border-color: #33ff33;
    color: #33ff33;
  }

  .variation-btn.selected {
    background: rgba(51, 255, 51, 0.1);
    border-color: #33ff33;
    color: #33ff33;
  }
</style>
