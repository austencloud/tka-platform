<script lang="ts">
  /**
   * Skew Lab Module
   *
   * Admin-only experimental sandbox for developing skewed positions.
   * This module will be deleted once skew functionality is properly integrated.
   *
   * Tabs:
   * - Browser: View and validate skewed pictographs from CSV
   * - Validator: Render all Zeta/Eta as static Type 6 pictographs with hands
   * - Generator: Tools for generating/fixing skewed dataframe (future)
   * - Grid Test: Test skewed grid rendering (future)
   */

  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import PictographBrowserTab from "./components/PictographBrowserTab.svelte";
  import PositionValidatorTab from "./components/PositionValidatorTab.svelte";

  const activeSection = $derived(navigationState.currentSection);
</script>

<div class="skewlab-module">
  {#if !activeSection || activeSection === "browser"}
    <PictographBrowserTab />
  {:else if activeSection === "validator"}
    <PositionValidatorTab />
  {:else if activeSection === "generator"}
    <div class="coming-soon">
      <i class="fas fa-hammer" aria-hidden="true"></i>
      <h2>Generator Tools</h2>
      <p>Tools for generating and fixing SkewedPictographDataframe.csv</p>
      <p class="hint">Coming soon...</p>
    </div>
  {:else if activeSection === "grid"}
    <div class="coming-soon">
      <i class="fas fa-th" aria-hidden="true"></i>
      <h2>Grid Test</h2>
      <p>Test skewed grid rendering and coordinate mapping</p>
      <p class="hint">Coming soon...</p>
    </div>
  {/if}
</div>

<style>
  .skewlab-module {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .coming-soon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
    color: var(--theme-text-secondary, #888);
    text-align: center;
    padding: 2rem;
  }

  .coming-soon i {
    font-size: 3rem;
    color: #f97316;
    opacity: 0.5;
  }

  .coming-soon h2 {
    margin: 0;
    color: var(--theme-text, #fff);
  }

  .coming-soon p {
    margin: 0;
  }

  .coming-soon .hint {
    font-style: italic;
    opacity: 0.6;
  }
</style>
