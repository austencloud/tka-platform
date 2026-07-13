<!--
  ComposerConstructDemo

  The Construct section's live strip: real pictographs from the CΨΩX fixture
  in the guide's own sequence player (play/scrub/speed, cells ring as the
  beat passes). Reuses GuideSequencePlayer + GuidePictograph — the same
  zero-context components already proven across the prerendered guide pages.
-->
<script lang="ts">
  import GuideSequencePlayer from "../../guide/level-1/_components/GuideSequencePlayer.svelte";
  import { DEMO_BEATS } from "../_data/demo-beats";
</script>

<div class="construct-demo">
  <GuideSequencePlayer beats={DEMO_BEATS} label="CΨΩX, two cycles — press play" />
</div>

<style>
  .construct-demo {
    margin-top: 1.6rem;
  }
</style>
