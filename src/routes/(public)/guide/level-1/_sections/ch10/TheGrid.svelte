<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="the-grid" title="The Grid">
  <p>
    TKA uses a grid of reference points around the body. Your hands move between
    these points to create letters. The grid has two modes — <strong>diamond</strong> and
    <strong>box</strong> — which together form the full 8-point grid.
  </p>

  <GuideDiagram
    src="/guide/level-1/images/the-grid/grid-diamond.png"
    alt="Diamond grid showing cardinal points: north, south, east, west"
    caption="Diamond mode — 4 cardinal points"
  />

  <GuideDiagram
    src="/guide/level-1/images/the-grid/grid-box.png"
    alt="Box grid showing intercardinal points: northeast, southeast, southwest, northwest"
    caption="Box mode — 4 intercardinal points"
  />

  <p>
    Combined, diamond and box modes create the 8-point grid. Every hand position
    in TKA maps to a point on this grid.
  </p>
</GuideSection>
