<script lang="ts">
  import GuideSection from "../../../level-1/_components/GuideSection.svelte";
</script>

<GuideSection id="opening-closing" title="Opening / Closing">
  <p>
    Because of Gamma's asymmetry, Λ (Lam) presents an extra variation when adding a turn. We can't use rotational relationship to tell them apart, because there isn't one to describe. Instead, we can disambiguate them with opening and closing. This refers to the appearance of the 90° angle if we continue the rotation into a pro-shift.
  </p>

  <!-- TODO: add diagram — Lam-High-One opening (◌) -->
  <!-- TODO: add diagram — Lam-High-One closing (◍) -->

  <p>
    Now let's add 1 turn to the static hand, leaving the dash in its base form. Since the dashing prop is not rotating, there is no rotational relationship to describe. However the rotating static prop can still be identified as opening or closing.
  </p>

  <!-- TODO: add diagram — Lam-Low-One opening (◌) -->
  <!-- TODO: add diagram — Lam-Low-One closing (◍) -->

  <p>
    It's not necessary to speak all of the glyph modifications when talking about a letter. It would be cumbersome if you were required to say "Lam-Low-One-Closing". In the context of a word or sequence, you can just refer to the base letter "Lam" instead.
  </p>

  <p>
    To shorten this for code, include "op" or "cl" as a final parameter. E.g. "(0,1,op)" or "(0,1,cl)"
  </p>
</GuideSection>
