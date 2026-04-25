<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="the-grid" title="The Grid">
  <p>
    The Kinetic Alphabet is based on a 4-point grid.
  </p>
  <p>
    There are two 4-point grids: box mode and diamond mode.
    This guide is written in diamond, but everything translates to box.
  </p>

  <GuideDiagram
    src="/guide/level-1/images/the-grid/grid-diamond.png"
    alt="Diamond grid showing cardinal points: north, south, east, west"
    caption="Diamond mode"
  />

  <GuideDiagram
    src="/guide/level-1/images/the-grid/grid-box.png"
    alt="Box grid showing intercardinal points: northeast, southeast, southwest, northwest"
    caption="Box mode"
  />

  <p>On this grid, there are three types of points:</p>
  <ul>
    <li><strong>The center point</strong> is the hub that everything revolves around.</li>
    <li><strong>The four hand points</strong> are halfway between the center point and the outer points.</li>
    <li><strong>The outer points</strong> depict the outer edges of the grid.</li>
  </ul>

  <p>
    Together, diamond and box form an 8-point grid.
    We'll use diamond mode to learn each concept.
  </p>
</GuideSection>
