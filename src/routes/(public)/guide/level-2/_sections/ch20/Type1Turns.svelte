<script lang="ts">
  import GuideSection from "../../../level-1/_components/GuideSection.svelte";
</script>

<GuideSection id="type-1-turns" title="Type 1: Dual-Shift (1-Turn)">
  <div class="section-body">
    <p>
      When motion types are exactly the same, put left in the high slot and right in the low slot. Here is a breakdown of A¹ (pro|pro) and B¹ (anti|anti).
    </p>

    <!-- TODO: add diagram - A¹ breakdown: "A-One" start thumbs: in → halfway → end mixed -->
    <!-- TODO: add diagram - B¹ breakdown: "B-One" start thumbs: in → halfway → end mixed -->

    <p>
      When motion types are different, high/low indicates how to label them. With hybrids, we can add a turn to either the pro or anti motion.
    </p>

    <p>
      For pro/anti hybrids, high = prospin and low = antispin. This includes C, F, I, L, O, R, U, and V.
    </p>

    <!-- TODO: add diagram - C-High-One (prospin gets the turn) -->
    <!-- TODO: add diagram - C-Low-One (antispin gets the turn) -->

    <p>
      For code or file-naming, indicate turns with parentheses like so: C¹ = C(1,0) and C₁ = C(0,1)
    </p>
  </div>
</GuideSection>

<style>
  /* Prose measure + rhythm mirror level-1's FlowFrame `.flow-p`: capped at a
     comfortable reading width and centred, rather than stretching to the
     host's dark-theme `min(90ch, 100%)` prose track. TurnStrip stays OUTSIDE
     this wrapper (a direct GuideSection child) so its own grid-column
     breakout still applies - nesting it in here would make it a grid-item of
     a plain div instead of the subgrid, losing the breakout. */
  .section-body :global(p) {
    max-width: 34rem;
    margin: 0 auto 1.1rem;
    text-align: center;
    text-wrap: balance;
  }
  .section-body :global(p:last-child) {
    margin-bottom: 0;
  }
</style>
