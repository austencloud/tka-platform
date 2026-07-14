<script lang="ts">
  /**
   * Learn-module Guide tab — hosts the faithful GuideReader (manifest nav +
   * one-page-fit printable sheet + slide-open live-animation companion), with a
   * Level 1 / Level 2 picker on top. The SAME reader shell renders both levels;
   * only its `config` seam swaps (see guide-reader-config.ts) — no forked reader.
   *
   * `container-type: inline-size` makes GuideReader's mobile `@container` rule
   * fire on narrow app panes. The picker bar sits above; the reader fills the
   * rest. `{#key level}` remounts the reader on switch so each level restores its
   * own scroll/companion state cleanly.
   */
  import GuideReader from "../../../../routes/(public)/guide/level-1/_components/GuideReader.svelte";
  import { LEVEL1_READER_CONFIG } from "../../../../routes/(public)/guide/level-1/_data/guide-reader-config";
  import { LEVEL2_READER_CONFIG } from "../../../../routes/(public)/guide/level-2/_data/guide-reader-config";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

  type Level = "1" | "2";
  const STORE_KEY = "guide-active-level";

  function initialLevel(): Level {
    if (typeof localStorage === "undefined") return "1";
    return localStorage.getItem(STORE_KEY) === "2" ? "2" : "1";
  }

  let level = $state<Level>(initialLevel());

  const config = $derived(level === "2" ? LEVEL2_READER_CONFIG : LEVEL1_READER_CONFIG);

  function pick(next: Level) {
    level = next;
    try {
      localStorage.setItem(STORE_KEY, next);
    } catch {
      // private mode / disabled — the choice just won't persist across reloads.
    }
  }
</script>

<div class="guide-tab">
  <div class="level-bar">
    <div class="level-switch">
      <SegmentedControl
        options={[
          { value: "1", label: "Level 1" },
          { value: "2", label: "Level 2" },
        ]}
        value={level}
        onchange={(v: Level) => pick(v)}
        size="sm"
        color="accent"
      />
    </div>
  </div>

  <div class="reader-host">
    {#key level}
      <GuideReader {config} />
    {/key}
  </div>
</div>

<style>
  .guide-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    container-type: inline-size;
  }
  .level-bar {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    padding: 8px 12px;
    background: var(--theme-panel-bg, oklch(0.15 0.02 270 / 0.6));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .level-switch {
    width: 100%;
    max-width: 320px;
  }
  .reader-host {
    flex: 1;
    min-height: 0;
    width: 100%;
  }
</style>
