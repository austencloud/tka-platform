<script lang="ts">
  import { setGuideData } from "../../level-1/_data/guide-data-context";
  import chapterData from "../_data/double-turns.json";
  import type { GuideChapterData } from "../../level-1/_data/guide-types";

  import DoubleTurnShifts from "../_sections/ch21/DoubleTurnShifts.svelte";
  import DoubleTurnDashes from "../_sections/ch21/DoubleTurnDashes.svelte";
  import DoubleTurnStatic from "../_sections/ch21/DoubleTurnStatic.svelte";
  import CodexPages from "../_sections/ch21/CodexPages.svelte";

  import GuideSeo from "../../level-1/_components/GuideSeo.svelte";
  import GuideCompanionHost from "../../_components/GuideCompanionHost.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<GuideSeo
  title="2.1 2-Turns · Level 2 Guide · The Kinetic Alphabet"
  description="Level 2 chapter on 2-turns: 360° prop rotations on shifts, dashes, and static motions, plus the codex reference pages for double-turning letters."
  path="/guide/level-2/double-turns"
  partOf={{ name: "Level 2 Guide: Turns", path: "/guide/level-2" }}
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Level 2", path: "/guide/level-2" },
    { name: "2-Turns", path: "/guide/level-2/double-turns" },
  ]}
/>

<GuideCompanionHost pageTitle="2-Turns" levelLabel="Level 2">
  <h1>2-Turns</h1>

  <DoubleTurnShifts />
  <DoubleTurnDashes />
  <DoubleTurnStatic />
  <CodexPages />
</GuideCompanionHost>

<style>
  /* Ink contract for this dark host - see turns/+page.svelte for the full
     rationale (P2, guide-shell parity spec). No light-mode override: the
     `.guide-layout` shell paints an unconditional dark background
     (guide.css:72-79), so this only declares the dark values the shell
     actually renders. */
  :global(.guide-content) {
    --ink: #ececf2;
    --ink-dim: #a8a8b4;
    --glyph-invert: 1;
  }
</style>
