<script lang="ts">
  /**
   * Learn-module Guide tab — hosts the faithful GuideReader (manifest nav +
   * one-page-fit printable sheet + slide-open live-animation companion). The old
   * animated `_sections` view lived here; that taxonomy now stays with the legacy
   * /guide/level-1/* routes. See docs/superpowers/specs/2026-07-07-guide-reader-design.md.
   *
   * `container-type: inline-size` makes GuideReader's mobile `@container` rule
   * fire on narrow app panes.
   */
  import GuideReader from "../../../../routes/(public)/guide/level-1/_components/GuideReader.svelte";
</script>

<div class="guide-tab">
  <GuideReader />
</div>

<style>
  .guide-tab {
    height: 100%;
    width: 100%;
    overflow: hidden;
    container-type: inline-size;
  }
</style>
