<!--
  Codex IA comparison — decide the information architecture for the unified
  letter explorer (learn Codex + lab Pictograph Explorer → one component).

  Three real candidates, switchable:
    A · Drill        = production CodexTab (overview rows → slide to detail pane)
    B · Sidebar      = production PictographExplorerLab (letter sidebar → all variations inline)
    C · Inline expand = prototype: overview rows + expand-in-place on one scroll surface

  All three render the real pictograph pipeline on the same data layer.
  Throwaway harness for the brainstorm — not shipping code.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import CodexTab from "$lib/features/learn/codex/components/CodexTab.svelte";
  import PictographExplorerLab from "$lib/features/lab/tabs/pictograph-explorer/PictographExplorerLab.svelte";
  import CodexExplorer from "$lib/features/learn/codex/components/CodexExplorer.svelte";

  type IA = "drill" | "sidebar" | "inline";
  let ia = $state<IA>("drill");

  const NOTES: Record<IA, string> = {
    drill:
      "Production CodexTab. Overview = one glyph per letter in canonical rows. Click → slides to a detail pane (40/60 split). Two-level, loads light.",
    sidebar:
      "Production Pictograph Explorer (lab). Persistent letter sidebar + rich controls (visibility, turns, Diamond↔Box, dark). Selecting a letter renders all variations inline. No overview, heavier render.",
    inline:
      "Prototype. Overview rows, but clicking a letter expands its variations in place beneath the grid — single scroll surface, no pane swap. Re-click to collapse.",
  };
</script>

<svelte:head><title>Codex IA — drill vs sidebar vs inline-expand</title></svelte:head>

<div class="page">
  <header class="bar">
    <div class="bar-lead">
      <h1>Codex IA</h1>
      <p class="note">{NOTES[ia]}</p>
    </div>
    <SegmentedControl
      options={[
        { value: "drill", label: "A · Drill", icon: "fas fa-layer-group" },
        { value: "sidebar", label: "B · Sidebar", icon: "fas fa-table-columns" },
        { value: "inline", label: "C · Inline", icon: "fas fa-list" },
      ]}
      value={ia}
      onchange={(v) => (ia = v)}
      color="accent"
    />
  </header>

  <main class="stage">
    {#if ia === "drill"}
      <CodexTab />
    {:else if ia === "sidebar"}
      <PictographExplorerLab />
    {:else}
      <CodexExplorer />
    {/if}
  </main>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--theme-panel-bg, #12121c);
    color: var(--theme-text, #f0f0f5);
  }

  .bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    flex-shrink: 0;
  }

  .bar-lead {
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .note {
    margin: 4px 0 0;
    max-width: 70ch;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .stage {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
