<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="reversals" title="Reversals">
  <p>Reversals open up a huge number of possibilities! There are three types of reversals:</p>

  <h3>Hand-reversal</h3>
  <p>
    With a hand reversal, the hand returns to the point it came from previously, without changing the
    prop's direction of spin. Relative to the center point, this changes a prospin to an antispin and
    vice-versa. This is the simplest and least disruptive reversal. We've already used it in the
    previous examples.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/reversals/pro_to_anti_hand_rev.png"
    alt="Pro to anti hand reversal"
    caption="Hand-reversal: pro to anti"
  />
  <GuideDiagram
    src="/guide/level-1/images/reversals/anti_to_pro_hand_rev.png"
    alt="Anti to pro hand reversal"
    caption="Hand-reversal: anti to pro"
  />

  <h3>Prop-reversal</h3>
  <p>
    With a prop reversal, the hand continues to the next point while the prop reverses direction.
    This reversal also changes a prospin into an antispin and vice-versa. Since a prop reversal is
    less intuitive, an "R/R" is added in the corresponding color in between the pictographs to
    indicate it.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/reversals/pro_to_anti_prop_rev.png"
    alt="Pro to anti prop reversal"
    caption="Prop-reversal: pro to anti"
  />
  <GuideDiagram
    src="/guide/level-1/images/reversals/anti_to_pro_prop_rev.png"
    alt="Anti to pro prop reversal"
    caption="Prop-reversal: anti to pro"
  />

  <h3>Full-reversal</h3>
  <p>
    With a full-reversal, the prop and hand retrace their paths and return to their previous
    position, as if going backwards in time. Because this contains a prop reversal, the "R/R" draws
    attention to it. This succinctly indicates to the performer that something unusual is happening.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/reversals/pro_to_pro_full_rev.png"
    alt="Pro to pro full reversal"
    caption="Full-reversal: pro to pro"
  />
  <GuideDiagram
    src="/guide/level-1/images/reversals/anti_to_anti_full_rev.png"
    alt="Anti to anti full reversal"
    caption="Full-reversal: anti to anti"
  />
</GuideSection>
