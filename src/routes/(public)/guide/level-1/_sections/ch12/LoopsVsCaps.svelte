<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
</script>

<GuideSection id="loops-vs-caps" title="LOOPs vs CAPs">
  <p>
    If you come from the poi community, you may know the term CAP (Continuous Assembly Pattern),
    coined by Damien (Zaltymbunk) on the Home of Poi forums and popularized by Alien Jon, Nick
    Woolsey, DrexFactor, and Charlie Cushing. CAPs and LOOPs are parallel concepts that describe
    cyclic patterns, but they approach composition differently.
  </p>

  <h3>How they differ</h3>
  <p>
    <strong>CAPs</strong> compose per-hand trajectories. You overlay a left-hand path with a
    right-hand path to produce the combined pattern. The most well-known CAP (the "C-CAP") is the
    kidney-bean shape created by alternating extensions and antispin petals.
  </p>
  <p>
    <strong>LOOPs</strong> compose per-beat snapshots. Each letter captures both hands simultaneously
    for one beat. A LOOP is a word that, when repeated with one or more transformations, returns to
    its starting position.
  </p>

  <h3>Neither is a subset of the other</h3>
  <p>
    Some patterns can be described as both a CAP and a LOOP. Others exist in one framework but not the
    other. CAPs describe trajectory shapes; LOOPs describe beat-by-beat letter sequences with
    transformation rules. Different lenses on the same physical motion.
  </p>
</GuideSection>
