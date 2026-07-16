<script lang="ts">
  import { setGuideData } from "../../level-1/_data/guide-data-context";
  import chapterData from "../_data/turns.json";
  import type { GuideChapterData } from "../../level-1/_data/guide-types";

  import TurnShifts from "../_sections/ch20/TurnShifts.svelte";
  import TurnDashes from "../_sections/ch20/TurnDashes.svelte";
  import TurnStatic from "../_sections/ch20/TurnStatic.svelte";
  import GlyphsPADS from "../_sections/ch20/GlyphsPADS.svelte";
  import Type1Turns from "../_sections/ch20/Type1Turns.svelte";
  import SandT from "../_sections/ch20/SandT.svelte";
  import Type2Turns from "../_sections/ch20/Type2Turns.svelte";
  import Type3Turns from "../_sections/ch20/Type3Turns.svelte";
  import Type4Turns from "../_sections/ch20/Type4Turns.svelte";
  import OpeningClosing from "../_sections/ch20/OpeningClosing.svelte";
  import Type5Turns from "../_sections/ch20/Type5Turns.svelte";
  import Type6Turns from "../_sections/ch20/Type6Turns.svelte";
  import OneOneTurns from "../_sections/ch20/OneOneTurns.svelte";

  import GuideSeo from "../../level-1/_components/GuideSeo.svelte";
  import GuideCompanionHost from "../../_components/GuideCompanionHost.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<GuideSeo
  title="2.0 1-Turns · Level 2 Guide · The Kinetic Alphabet"
  description="Level 2 chapter on 1-turns: 180° prop rotations layered onto shifts, dashes, and static motions, with glyphs, PADS ordering, and Types 1–6 with turns."
  path="/guide/level-2/turns"
  partOf={{ name: "Level 2 Guide: Turns", path: "/guide/level-2" }}
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Level 2", path: "/guide/level-2" },
    { name: "1-Turns", path: "/guide/level-2/turns" },
  ]}
/>

<GuideCompanionHost pageTitle="1-Turns" levelLabel="Level 2">
  <h1>1-Turns</h1>

  <TurnShifts />
  <TurnDashes />
  <TurnStatic />
  <GlyphsPADS />
  <Type1Turns />
  <SandT />
  <Type2Turns />
  <Type3Turns />
  <Type4Turns />
  <OpeningClosing />
  <Type5Turns />
  <Type6Turns />
  <OneOneTurns />
</GuideCompanionHost>

<style>
  /* Ink contract for this dark host (P2, guide-shell parity spec): declares
     --ink/--ink-dim/--glyph-invert on the ambient `.guide-content` grid
     (painted by GuideShell/`.guide-layout` in level-1/_styles/guide.css) so
     TurnStrip and SequenceShowcase read authoritative values instead of
     falling back to their own hardcoded dark-host guesses (see TurnStrip.svelte's
     top-of-file comment). NO background/light-mode override here: `.guide-layout`
     paints an UNCONDITIONAL dark background (oklch(0.13 0.015 270), no
     prefers-color-scheme/data-theme branch - guide.css:72-79) - level-2's shell
     has no light variant to switch to, unlike level-1's GuidePageHost route
     (which owns its own light/dark background and toggles both). Adding a
     light-ink override without a matching light background would make text
     invisible, so this only declares the one value the shell actually renders. */
  :global(.guide-content) {
    --ink: #ececf2;
    --ink-dim: #a8a8b4;
    --glyph-invert: 1;
  }
</style>
