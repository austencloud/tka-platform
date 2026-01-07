<script lang="ts">
  /**
   * Skew Lab - Admin Sandbox for Skewed Positions Development
   *
   * Experimental tab for testing and developing skewed pictograph rendering.
   * This will be removed once skew functionality is properly integrated.
   */

  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import {
    GridLocation,
    GridMode,
    GridPosition,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    MotionType,
    RotationDirection,
    Orientation,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

  // State
  let loading = $state(true);
  let error = $state<string | null>(null);
  let allRows = $state<CsvRow[]>([]);
  let selectedFilter = $state<
    "all" | "zeta" | "eta" | "zeta-start" | "eta-start" | "valid-only"
  >("valid-only");
  let pictographSize = $state(280);
  let showDataIssues = $state(true);

  interface CsvRow {
    letter: string;
    startPosition: string;
    endPosition: string;
    timing: string;
    direction: string;
    blueMotionType: string;
    blueRotationDirection: string;
    blueSkewDir: string;
    blueStartLocation: string;
    blueEndLocation: string;
    redMotionType: string;
    redRotationDirection: string;
    redSkewDir: string;
    redStartLocation: string;
    redEndLocation: string;
  }

  // Check if a motion's claimed type matches its actual movement
  function isValidMotion(
    startLoc: string,
    endLoc: string,
    claimedType: string
  ): { valid: boolean; actualType: string; issue?: string } {
    const locations = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
    const startIdx = locations.indexOf(startLoc.toLowerCase());
    const endIdx = locations.indexOf(endLoc.toLowerCase());

    if (startIdx === -1 || endIdx === -1) {
      return { valid: false, actualType: "unknown", issue: "Invalid location" };
    }

    if (startLoc === endLoc) {
      const isValid = claimedType === "static";
      return {
        valid: isValid,
        actualType: "static",
        issue: isValid ? undefined : `Claimed ${claimedType} but is static`,
      };
    }

    const diff = Math.abs(endIdx - startIdx);
    const steps = Math.min(diff, 8 - diff);

    // 4 steps = 180° = dash
    if (steps === 4) {
      const isValid = claimedType === "dash";
      return {
        valid: isValid,
        actualType: "dash",
        issue: isValid
          ? undefined
          : `${startLoc}→${endLoc} is a DASH (180°), not ${claimedType}`,
      };
    }

    // 1-3 steps = valid shift-like motion for pro/anti
    if (steps >= 1 && steps <= 3) {
      const isValid = claimedType === "pro" || claimedType === "anti";
      return {
        valid: isValid,
        actualType: claimedType === "pro" || claimedType === "anti" ? claimedType : "shift",
        issue: isValid
          ? undefined
          : `${startLoc}→${endLoc} is a shift motion, claimed ${claimedType}`,
      };
    }

    return { valid: false, actualType: "unknown", issue: "Unknown motion type" };
  }

  // Check row for data quality issues
  function getRowIssues(row: CsvRow): string[] {
    const issues: string[] = [];

    const blueCheck = isValidMotion(
      row.blueStartLocation,
      row.blueEndLocation,
      row.blueMotionType
    );
    if (!blueCheck.valid && blueCheck.issue) {
      issues.push(`Blue: ${blueCheck.issue}`);
    }

    const redCheck = isValidMotion(
      row.redStartLocation,
      row.redEndLocation,
      row.redMotionType
    );
    if (!redCheck.valid && redCheck.issue) {
      issues.push(`Red: ${redCheck.issue}`);
    }

    return issues;
  }

  // Filtered rows based on selection
  const filteredRows = $derived.by(() => {
    let filtered = allRows;

    if (selectedFilter === "valid-only") {
      filtered = allRows.filter((r) => getRowIssues(r).length === 0);
    } else if (selectedFilter === "zeta") {
      filtered = allRows.filter(
        (r) =>
          r.startPosition.includes("zeta") || r.endPosition.includes("zeta")
      );
    } else if (selectedFilter === "eta") {
      filtered = allRows.filter(
        (r) => r.startPosition.includes("eta") || r.endPosition.includes("eta")
      );
    } else if (selectedFilter === "zeta-start") {
      filtered = allRows.filter((r) => r.startPosition.includes("zeta"));
    } else if (selectedFilter === "eta-start") {
      filtered = allRows.filter((r) => r.startPosition.includes("eta"));
    }

    return filtered.slice(0, 50); // Limit for performance
  });

  // Stats
  const stats = $derived.by(() => {
    const total = allRows.length;
    const withIssues = allRows.filter((r) => getRowIssues(r).length > 0).length;
    const valid = total - withIssues;
    return { total, valid, withIssues };
  });

  // Helper functions for enum conversion
  function toGridLocation(loc: string): GridLocation {
    const map: Record<string, GridLocation> = {
      n: GridLocation.NORTH,
      e: GridLocation.EAST,
      s: GridLocation.SOUTH,
      w: GridLocation.WEST,
      ne: GridLocation.NORTHEAST,
      se: GridLocation.SOUTHEAST,
      sw: GridLocation.SOUTHWEST,
      nw: GridLocation.NORTHWEST,
    };
    return map[loc.toLowerCase()] || GridLocation.NORTH;
  }

  function toGridPosition(pos: string): GridPosition {
    const normalized = pos.toLowerCase();
    const posMap: Record<string, GridPosition> = {
      alpha1: GridPosition.ALPHA1, alpha2: GridPosition.ALPHA2,
      alpha3: GridPosition.ALPHA3, alpha4: GridPosition.ALPHA4,
      alpha5: GridPosition.ALPHA5, alpha6: GridPosition.ALPHA6,
      alpha7: GridPosition.ALPHA7, alpha8: GridPosition.ALPHA8,
      beta1: GridPosition.BETA1, beta2: GridPosition.BETA2,
      beta3: GridPosition.BETA3, beta4: GridPosition.BETA4,
      beta5: GridPosition.BETA5, beta6: GridPosition.BETA6,
      beta7: GridPosition.BETA7, beta8: GridPosition.BETA8,
      gamma1: GridPosition.GAMMA1, gamma2: GridPosition.GAMMA2,
      gamma3: GridPosition.GAMMA3, gamma4: GridPosition.GAMMA4,
      gamma5: GridPosition.GAMMA5, gamma6: GridPosition.GAMMA6,
      gamma7: GridPosition.GAMMA7, gamma8: GridPosition.GAMMA8,
      gamma9: GridPosition.GAMMA9, gamma10: GridPosition.GAMMA10,
      gamma11: GridPosition.GAMMA11, gamma12: GridPosition.GAMMA12,
      gamma13: GridPosition.GAMMA13, gamma14: GridPosition.GAMMA14,
      gamma15: GridPosition.GAMMA15, gamma16: GridPosition.GAMMA16,
      zeta1: GridPosition.ZETA1, zeta2: GridPosition.ZETA2,
      zeta3: GridPosition.ZETA3, zeta4: GridPosition.ZETA4,
      zeta5: GridPosition.ZETA5, zeta6: GridPosition.ZETA6,
      zeta7: GridPosition.ZETA7, zeta8: GridPosition.ZETA8,
      zeta9: GridPosition.ZETA9, zeta10: GridPosition.ZETA10,
      zeta11: GridPosition.ZETA11, zeta12: GridPosition.ZETA12,
      zeta13: GridPosition.ZETA13, zeta14: GridPosition.ZETA14,
      zeta15: GridPosition.ZETA15, zeta16: GridPosition.ZETA16,
      eta1: GridPosition.ETA1, eta2: GridPosition.ETA2,
      eta3: GridPosition.ETA3, eta4: GridPosition.ETA4,
      eta5: GridPosition.ETA5, eta6: GridPosition.ETA6,
      eta7: GridPosition.ETA7, eta8: GridPosition.ETA8,
      eta9: GridPosition.ETA9, eta10: GridPosition.ETA10,
      eta11: GridPosition.ETA11, eta12: GridPosition.ETA12,
      eta13: GridPosition.ETA13, eta14: GridPosition.ETA14,
      eta15: GridPosition.ETA15, eta16: GridPosition.ETA16,
    };
    return posMap[normalized] || GridPosition.ALPHA1;
  }

  function toMotionType(type: string): MotionType {
    const map: Record<string, MotionType> = {
      static: MotionType.STATIC,
      pro: MotionType.PRO,
      anti: MotionType.ANTI,
      dash: MotionType.DASH,
      float: MotionType.FLOAT,
    };
    return map[type.toLowerCase()] || MotionType.STATIC;
  }

  function toRotationDirection(dir: string): RotationDirection {
    const map: Record<string, RotationDirection> = {
      cw: RotationDirection.CLOCKWISE,
      ccw: RotationDirection.COUNTER_CLOCKWISE,
      no_rotation: RotationDirection.NO_ROTATION,
      "": RotationDirection.NO_ROTATION,
    };
    return map[dir.toLowerCase()] || RotationDirection.NO_ROTATION;
  }

  function toLetter(letter: string): Letter {
    const letterMap: Record<string, Letter> = {
      A: Letter.A, B: Letter.B, C: Letter.C, D: Letter.D,
      E: Letter.E, F: Letter.F, G: Letter.G, H: Letter.H,
      I: Letter.I, J: Letter.J, K: Letter.K, L: Letter.L,
      M: Letter.M, N: Letter.N, O: Letter.O, P: Letter.P,
      Q: Letter.Q, R: Letter.R, S: Letter.S, T: Letter.T,
      U: Letter.U, V: Letter.V, W: Letter.W, X: Letter.X,
      Y: Letter.Y, Z: Letter.Z,
    };
    return letterMap[letter.toUpperCase()] || Letter.A;
  }

  // Convert CSV row to PictographData
  function rowToPictograph(row: CsvRow, index: number): PictographData {
    const startPos = toGridPosition(row.startPosition);
    const endPos = toGridPosition(row.endPosition);
    const gridMode = GridMode.SKEWED;

    const blueMotion = createMotionData({
      motionType: toMotionType(row.blueMotionType),
      startLocation: toGridLocation(row.blueStartLocation),
      endLocation: toGridLocation(row.blueEndLocation),
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: toRotationDirection(row.blueRotationDirection),
      turns: row.blueMotionType === "static" ? 0 : 1,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: PropType.STAFF,
      arrowLocation: toGridLocation(row.blueEndLocation),
      gridMode,
    });

    const redMotion = createMotionData({
      motionType: toMotionType(row.redMotionType),
      startLocation: toGridLocation(row.redStartLocation),
      endLocation: toGridLocation(row.redEndLocation),
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: toRotationDirection(row.redRotationDirection),
      turns: row.redMotionType === "static" ? 0 : 1,
      color: MotionColor.RED,
      isVisible: true,
      propType: PropType.STAFF,
      arrowLocation: toGridLocation(row.redEndLocation),
      gridMode,
    });

    return {
      id: `skew-${index}`,
      letter: toLetter(row.letter),
      startPosition: startPos,
      endPosition: endPos,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    };
  }

  // Parse CSV
  function parseCsv(text: string): CsvRow[] {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",");
    return lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h.trim()] = values[i]?.trim() || "";
      });
      return row as unknown as CsvRow;
    });
  }

  // Load CSV on mount
  onMount(async () => {
    try {
      const response = await fetch(
        "/data/pictographs/SkewedPictographDataframe.csv"
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status}`);
      }
      const text = await response.text();
      allRows = parseCsv(text);
      loading = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Unknown error";
      loading = false;
    }
  });
</script>

<div class="skew-lab">
  <header class="lab-header">
    <div class="title-area">
      <h1>
        <i class="fas fa-flask" aria-hidden="true"></i>
        Skew Lab
      </h1>
      <p class="subtitle">
        Experimental sandbox for skewed positions (zeta/eta)
      </p>
    </div>

    {#if !loading && !error}
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-value">{stats.total}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat valid">
          <span class="stat-value">{stats.valid}</span>
          <span class="stat-label">Valid</span>
        </div>
        <div class="stat issues">
          <span class="stat-value">{stats.withIssues}</span>
          <span class="stat-label">Issues</span>
        </div>
      </div>
    {/if}
  </header>

  {#if loading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>Loading skewed pictograph data...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <p>Error: {error}</p>
    </div>
  {:else}
    <div class="controls">
      <div class="control-group">
        <label for="filter-select">Filter:</label>
        <select id="filter-select" bind:value={selectedFilter}>
          <option value="valid-only">Valid Only ({stats.valid})</option>
          <option value="zeta-start">Zeta Start</option>
          <option value="eta-start">Eta Start</option>
          <option value="zeta">Any Zeta</option>
          <option value="eta">Any Eta</option>
          <option value="all">All (first 50)</option>
        </select>
      </div>

      <div class="control-group">
        <label for="size-slider">Size: {pictographSize}px</label>
        <input
          id="size-slider"
          type="range"
          min="150"
          max="400"
          bind:value={pictographSize}
        />
      </div>

      <label class="checkbox-control">
        <input type="checkbox" bind:checked={showDataIssues} />
        Show data issues
      </label>

      <div class="showing-count">
        Showing: {filteredRows.length}
      </div>
    </div>

    <div class="pictograph-grid" style="--cell-size: {pictographSize}px;">
      {#each filteredRows as row, i}
        {@const pictograph = rowToPictograph(row, i)}
        {@const issues = getRowIssues(row)}
        <div class="pictograph-card" class:has-issues={issues.length > 0}>
          <div class="pictograph-wrapper">
            <PictographContainer pictographData={pictograph} />
          </div>
          <div class="card-info">
            <div class="letter-badge">{row.letter}</div>
            <div class="positions">
              <span class="pos start">{row.startPosition}</span>
              <span class="arrow">→</span>
              <span class="pos end">{row.endPosition}</span>
            </div>
            <div class="motions">
              <span class="blue">
                B: {row.blueStartLocation}→{row.blueEndLocation}
                ({row.blueMotionType}{row.blueSkewDir ? ` skew${row.blueSkewDir}` : ""})
              </span>
              <span class="red">
                R: {row.redStartLocation}→{row.redEndLocation}
                ({row.redMotionType}{row.redSkewDir ? ` skew${row.redSkewDir}` : ""})
              </span>
            </div>
            {#if showDataIssues && issues.length > 0}
              <div class="issues-list">
                {#each issues as issue}
                  <div class="issue">
                    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                    {issue}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if filteredRows.length === 0}
      <div class="empty-state">
        <i class="fas fa-search" aria-hidden="true"></i>
        <p>No pictographs match the current filter.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .skew-lab {
    padding: 1.5rem;
    height: 100%;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .lab-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title-area h1 {
    margin: 0;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #f97316;
  }

  .subtitle {
    margin: 0.25rem 0 0 0;
    color: var(--theme-text-secondary, #888);
    font-size: 0.875rem;
  }

  .stats-bar {
    display: flex;
    gap: 1rem;
  }

  .stat {
    text-align: center;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  .stat-value {
    display: block;
    font-size: 1.25rem;
    font-weight: bold;
    color: var(--theme-text, #fff);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--theme-text-secondary, #888);
  }

  .stat.valid .stat-value {
    color: #22c55e;
  }

  .stat.issues .stat-value {
    color: #ef4444;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--theme-text-secondary, #888);
  }

  .error-state {
    color: #ef4444;
  }

  .controls {
    display: flex;
    gap: 1.5rem;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .control-group label {
    font-size: 0.875rem;
    color: var(--theme-text-secondary, #aaa);
  }

  select,
  input[type="range"] {
    background: var(--theme-panel-bg, #1a1a2e);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #fff);
    padding: 0.5rem;
    border-radius: 4px;
  }

  .checkbox-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--theme-text-secondary, #aaa);
    cursor: pointer;
  }

  .showing-count {
    margin-left: auto;
    font-size: 0.875rem;
    color: var(--theme-text-secondary, #666);
  }

  .pictograph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(var(--cell-size) + 32px), 1fr));
    gap: 1.5rem;
  }

  .pictograph-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .pictograph-card.has-issues {
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.05);
  }

  .pictograph-wrapper {
    width: var(--cell-size);
    height: var(--cell-size);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-info {
    text-align: center;
    width: 100%;
  }

  .letter-badge {
    font-size: 1.25rem;
    font-weight: bold;
    color: var(--theme-text, #fff);
  }

  .positions {
    font-size: 0.75rem;
    margin: 0.25rem 0;
  }

  .pos {
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }

  .pos.start {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .pos.end {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .arrow {
    color: var(--theme-text-secondary, #666);
    margin: 0 4px;
  }

  .motions {
    font-size: 0.625rem;
    color: var(--theme-text-secondary, #666);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .blue {
    color: #60a5fa;
  }
  .red {
    color: #f87171;
  }

  .issues-list {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(239, 68, 68, 0.3);
  }

  .issue {
    font-size: 0.625rem;
    color: #f87171;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    justify-content: center;
  }
</style>
