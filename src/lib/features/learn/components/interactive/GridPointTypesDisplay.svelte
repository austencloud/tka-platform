<!--
GridPointTypesDisplay - Side-by-side grids showing point type highlighting
Displays diamond and box grids together, both highlighting the same point type.
Used in the Point Types lesson step.
-->
<script lang="ts">
  import GridPointHighlight from "./GridPointHighlight.svelte";

  type PointTypePhase = "center" | "hand" | "outer";

  let { phase = "center" } = $props<{
    phase: PointTypePhase;
  }>();
</script>

<!-- Two grids side-by-side, centered on their own row -->
<div class="point-types-container">
  <div class="grid-panel">
    <h3 class="mode-label">Diamond</h3>
    <GridPointHighlight gridType="diamond" highlightPhase={phase} />
  </div>

  <div class="grid-panel">
    <h3 class="mode-label">Box</h3>
    <GridPointHighlight gridType="box" highlightPhase={phase} />
  </div>
</div>

<style>
  .point-types-container {
    display: flex;
    flex-direction: row;
    gap: 2rem;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    max-width: 800px;
  }

  .grid-panel {
    flex: 1;
    max-width: 350px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .mode-label {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
    text-align: center;
  }

  /* Responsive: Stack vertically on mobile */
  @media (max-width: 768px) {
    .point-types-container {
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    .grid-panel {
      max-width: 280px;
      width: 100%;
    }

    .mode-label {
      font-size: 1.1rem;
    }
  }

  @media (max-width: 500px) {
    .grid-panel {
      max-width: 240px;
    }

    .mode-label {
      font-size: 1rem;
    }
  }
</style>
