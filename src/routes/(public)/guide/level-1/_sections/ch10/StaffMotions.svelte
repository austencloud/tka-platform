<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="staff-motions" title="Staff Motions">
  <p>
    During a shift, a prop can rotate in one of two directions - Prospin or Antispin.
  </p>

  <h3>Prospin</h3>
  <p>
    The prop rotates the same direction as the handpath. A 90 degree isolation is our base unit of a prospin.
  </p>
  <p>
    In a base isolation, the thumb orientation remains the same for the entire motion.
  </p>

  <h3>Antispin</h3>
  <p>
    The prop rotates in the opposite direction of the handpath. A 90 degree antispin is our base unit of antispin.
  </p>
  <p>
    In an antispin, the ends swap orientation. It moves from thumb in to thumb out.
  </p>

  <p>
    Halfway through the motion, the center of the staff is at the grid's center point.
  </p>
  <p>
    In a base dash, the thumb ends also swap orientation.
  </p>

  <GuideDiagram
    src="/guide/level-1/images/staff-motions/prospin-antispin.png"
    alt="Prospin: prop and hand rotate same direction. Antispin: opposite directions."
    caption="Prospin vs antispin"
  />
</GuideSection>
