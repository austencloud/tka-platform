<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
</script>

<GuideSection id="hand-motions" title="Hand Motions">
  <p>
    Each hand performs one of three basic motions per beat: <strong>shift</strong>,
    <strong>dash</strong>, or <strong>static</strong>.
  </p>

  <h3>Shift</h3>
  <p>The hand moves to an adjacent grid point while the prop rotates continuously.</p>

  <h3>Dash</h3>
  <p>The hand moves to an adjacent grid point with no prop rotation — the prop translates without spinning.</p>

  <h3>Static</h3>
  <p>The hand stays at its current grid point. The prop may or may not rotate in place.</p>

  <h3>Six Combinations</h3>
  <p>
    With two hands and three motion types, six combinations define the six letter types:
  </p>
  <ol>
    <li><span class="type-dual-shift"><strong>Type 1 — Dual-Shift:</strong></span> Both hands shift</li>
    <li><span class="type-shift"><strong>Type 2 — Shift:</strong></span> One hand shifts, one is static</li>
    <li><span class="type-cross-shift"><strong>Type 3 — Cross-Shift:</strong></span> One hand shifts, one dashes</li>
    <li><span class="type-dash"><strong>Type 4 — Dash:</strong></span> One hand dashes, one is static</li>
    <li><span class="type-dual-dash"><strong>Type 5 — Dual-Dash:</strong></span> Both hands dash</li>
    <li><span class="type-static"><strong>Type 6 — Static:</strong></span> Both hands are static</li>
  </ol>
</GuideSection>
