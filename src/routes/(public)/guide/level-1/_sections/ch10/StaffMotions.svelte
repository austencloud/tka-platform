<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="staff-motions" title="Staff Motions">
  <p>
    When a hand shifts, the prop rotates through 180° (one turn). The direction
    of rotation determines whether the motion is a <strong>prospin</strong> or
    <strong>antispin</strong>.
  </p>

  <h3>Prospin</h3>
  <p>
    The prop rotates in the same direction as the hand's travel around the grid.
    Hand moves clockwise, prop spins clockwise.
  </p>

  <h3>Antispin</h3>
  <p>
    The prop rotates opposite to the hand's travel direction. Hand moves clockwise,
    prop spins counterclockwise.
  </p>

  <GuideDiagram
    src="/guide/level-1/images/staff-motions/prospin-antispin.png"
    alt="Prospin: prop and hand rotate same direction. Antispin: opposite directions."
    caption="Prospin vs antispin — the prop's rotation relative to hand travel"
  />
</GuideSection>
