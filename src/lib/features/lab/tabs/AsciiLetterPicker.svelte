<!--
  AsciiLetterPicker.svelte — Letter selection grid for the ASCII lab.
  Domain: Retro DOS Terminal Lab
-->
<script lang="ts">
  import type { RetroHandData, RetroPictographData } from "$lib/features/retro/shared/domain/pictograph-types";
  import {
    GridLocation,
    GridMode,
    MotionType,
    Orientation,
    MotionColor,
  } from "$lib/features/retro/shared/domain/pictograph-types";

  let {
    onLetterLoad,
  }: {
    onLetterLoad: (letter: string, data: RetroPictographData) => void;
  } = $props();

  const TYPE_1 = "ABCDEFGHIJKLMNOPQRSTUV".split("");
  const TYPE_2 = ["W", "X", "Y", "Z", "\u03A3", "\u0394", "\u0398", "\u03A9"];
  const TYPE_3 = ["W-", "X-", "Y-", "Z-", "\u03A3-", "\u0394-", "\u0398-", "\u03A9-"];

  let selectedLetter = $state<string | null>(null);
  let jsonInput = $state("");
  let jsonError = $state<string | null>(null);

  function selectLetter(letter: string): void {
    selectedLetter = letter;
  }

  function parseAndLoad(): void {
    if (!selectedLetter || !jsonInput.trim()) {
      jsonError = "Select a letter and paste MCP data";
      return;
    }

    try {
      const raw = JSON.parse(jsonInput);
      const data = mapMcpToRetro(selectedLetter, raw);
      onLetterLoad(selectedLetter, data);
      jsonError = null;
    } catch (e) {
      jsonError = e instanceof Error ? e.message : "Invalid JSON";
    }
  }

  function mapMcpToRetro(letter: string, raw: any): RetroPictographData {
    const mapLocation = (loc: string): GridLocation => {
      const map: Record<string, GridLocation> = {
        n: GridLocation.NORTH, ne: GridLocation.NORTHEAST,
        e: GridLocation.EAST, se: GridLocation.SOUTHEAST,
        s: GridLocation.SOUTH, sw: GridLocation.SOUTHWEST,
        w: GridLocation.WEST, nw: GridLocation.NORTHWEST,
        center: GridLocation.CENTER,
      };
      return map[loc?.toLowerCase()] ?? GridLocation.NORTH;
    };

    const mapMotion = (mot: string): MotionType => {
      const map: Record<string, MotionType> = {
        pro: MotionType.PRO, anti: MotionType.ANTI,
        dash: MotionType.DASH, static: MotionType.STATIC,
        float: MotionType.FLOAT,
      };
      return map[mot?.toLowerCase()] ?? MotionType.STATIC;
    };

    const mapOrientation = (ori: string): Orientation => {
      const map: Record<string, Orientation> = {
        in: Orientation.IN, out: Orientation.OUT,
        clock: Orientation.CLOCK, counter: Orientation.COUNTER,
      };
      return map[ori?.toLowerCase()] ?? Orientation.IN;
    };

    const blueRaw = raw.blue_attributes || raw.blueHand || {};
    const redRaw = raw.red_attributes || raw.redHand || {};

    const blueHand: RetroHandData = {
      color: MotionColor.BLUE,
      location: mapLocation(blueRaw.start_loc || blueRaw.location || "n"),
      endLocation: mapLocation(blueRaw.end_loc || blueRaw.endLocation || blueRaw.start_loc || "n"),
      motionType: mapMotion(blueRaw.motion_type || blueRaw.motionType || "static"),
      orientation: mapOrientation(blueRaw.start_ori || blueRaw.orientation || "in"),
      turns: blueRaw.turns ?? 0,
    };

    const redHand: RetroHandData = {
      color: MotionColor.RED,
      location: mapLocation(redRaw.start_loc || redRaw.location || "s"),
      endLocation: mapLocation(redRaw.end_loc || redRaw.endLocation || redRaw.start_loc || "s"),
      motionType: mapMotion(redRaw.motion_type || redRaw.motionType || "static"),
      orientation: mapOrientation(redRaw.start_ori || redRaw.orientation || "in"),
      turns: redRaw.turns ?? 0,
    };

    return {
      letter,
      blueHand,
      redHand,
      gridMode: (raw.grid_mode === "box" ? GridMode.BOX : GridMode.DIAMOND),
    };
  }
</script>

<div class="letter-picker">
  <div class="letter-section">
    <span class="section-label">Type 1</span>
    <div class="letter-grid">
      {#each TYPE_1 as letter}
        <button
          class="letter-btn"
          class:selected={selectedLetter === letter}
          onclick={() => selectLetter(letter)}
        >{letter}</button>
      {/each}
    </div>
  </div>

  <div class="letter-section">
    <span class="section-label">Type 2</span>
    <div class="letter-grid">
      {#each TYPE_2 as letter}
        <button
          class="letter-btn"
          class:selected={selectedLetter === letter}
          onclick={() => selectLetter(letter)}
        >{letter}</button>
      {/each}
    </div>
  </div>

  <div class="letter-section">
    <span class="section-label">Type 3</span>
    <div class="letter-grid">
      {#each TYPE_3 as letter}
        <button
          class="letter-btn"
          class:selected={selectedLetter === letter}
          onclick={() => selectLetter(letter)}
        >{letter}</button>
      {/each}
    </div>
  </div>

  {#if selectedLetter}
    <div class="json-input-section">
      <label class="json-label">
        Paste MCP data for <strong>{selectedLetter}</strong>:
      </label>
      <textarea
        class="json-textarea"
        bind:value={jsonInput}
        placeholder="Paste get_pictograph_data JSON here..."
        rows="4"
      ></textarea>
      {#if jsonError}
        <span class="json-error">{jsonError}</span>
      {/if}
      <button class="load-btn" onclick={parseAndLoad}>Load</button>
    </div>
  {/if}
</div>

<style>
  .letter-picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .letter-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 1px;
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

  .json-input-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .json-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .json-textarea {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: #33ff33;
    font-family: "Courier New", monospace;
    font-size: var(--font-size-compact, 12px);
    padding: 8px;
    resize: vertical;
  }

  .json-textarea::placeholder {
    color: rgba(51, 255, 51, 0.3);
  }

  .json-error {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
  }

  .load-btn {
    align-self: flex-start;
    padding: 6px 16px;
    border: 1px solid #33ff33;
    border-radius: 4px;
    background: rgba(51, 255, 51, 0.1);
    color: #33ff33;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .load-btn:hover {
    background: rgba(51, 255, 51, 0.25);
  }
</style>
