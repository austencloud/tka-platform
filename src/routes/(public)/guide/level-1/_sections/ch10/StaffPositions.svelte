<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="staff-positions" title="Staff Positions">
  <p>
    Staff position describes the orientation of each prop — which direction the
    thumb end and pinky end point. Each staff has two visible ends, and proper
    technique keeps the thumb reference consistent.
  </p>

  <p>
    At any grid point, a staff can be oriented <strong>radially</strong> (pointing
    toward/away from center) or <strong>nonradially</strong> (perpendicular to
    the radial line). These two orientations — combined with which end the thumb
    grips — create the full set of staff positions.
  </p>

  <GuideDiagram
    src="/guide/level-1/images/staff-positions/radial-nonradial.png"
    alt="Staff oriented radially vs nonradially at a grid point"
    caption="Radial (pointing toward center) vs nonradial (perpendicular)"
  />
</GuideSection>
