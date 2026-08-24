import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Letter } from "../../../src/lib/shared/foundation/domain/models/letter";
import { LetterType } from "../../../src/lib/shared/foundation/domain/models/letter-type";
import { LETTER_TYPE_COLORS } from "../../../src/lib/shared/pictograph/shared/domain/constants/pictograph-constants";
import {
  HAND_MOTION_LESSON,
  HAND_MOTION_QUESTIONS,
  TYPE1_ACCENTS,
  TYPE1_LESSON_LETTERS,
  TYPE1_QUESTIONS,
} from "../../../src/lib/features/learn/components/interactive/shared/canonical-lesson-content";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("canonical concept lesson content", () => {
  it("teaches the three hand paths with canonical representative letters and colors", () => {
    expect(HAND_MOTION_LESSON.map((item) => item.id)).toEqual([
      "shift",
      "dash",
      "static",
    ]);
    expect(HAND_MOTION_LESSON.map((item) => item.letter)).toEqual([
      Letter.W,
      Letter.PHI,
      Letter.ALPHA,
    ]);
    expect(HAND_MOTION_LESSON.map((item) => item.accent)).toEqual([
      LETTER_TYPE_COLORS[LetterType.TYPE2][0],
      LETTER_TYPE_COLORS[LetterType.TYPE4][0],
      LETTER_TYPE_COLORS[LetterType.TYPE6][0],
    ]);
    expect(
      HAND_MOTION_QUESTIONS.every((question) =>
        HAND_MOTION_LESSON.some((item) => item.id === question.answer)
      )
    ).toBe(true);
  });

  it("keeps the published Type 1 lesson scoped to A/B/C and G/H/I", () => {
    expect(TYPE1_LESSON_LETTERS.map((item) => item.letter)).toEqual([
      Letter.A,
      Letter.B,
      Letter.C,
      Letter.G,
      Letter.H,
      Letter.I,
    ]);
    expect(TYPE1_LESSON_LETTERS.map((item) => item.pattern)).toEqual([
      "pro-pro",
      "anti-anti",
      "hybrid",
      "pro-pro",
      "anti-anti",
      "hybrid",
    ]);
    expect(TYPE1_ACCENTS).toBe(LETTER_TYPE_COLORS[LetterType.TYPE1]);
    expect(
      TYPE1_QUESTIONS.every((question) =>
        question.choices.includes(question.answer)
      )
    ).toBe(true);
  });
});

describe("canonical concept lesson composition", () => {
  it("renders motion and Type 1 examples through the production pictograph path", () => {
    const stage = readSource(
      "src/lib/features/learn/components/interactive/shared/LessonPictographStage.svelte"
    );
    const motions = readSource(
      "src/lib/features/learn/components/interactive/motions/MotionsConceptExperience.svelte"
    );
    const type1 = readSource(
      "src/lib/features/learn/components/interactive/letters/type1/Type1ConceptExperience.svelte"
    );

    expect(stage).toContain("PictographContainer");
    expect(stage).toContain("startPositionDeriver");
    expect(stage).toContain("PropType.STAFF");
    expect(motions).toContain("letterQueryHandler");
    expect(motions).toContain("LessonPictographStage");
    expect(type1).toContain("letterQueryHandler");
    expect(type1).toContain("LessonPictographStage");

    expect(motions).not.toContain("MotionVisualizer");
    expect(motions).not.toContain("MOTIONS_INFO");
    expect(motions).not.toContain("MotionTypePage");
    expect(type1).not.toContain("TYPE1_ALPHABET");
    expect(type1).not.toContain("Type1ProspinPage");
  });

  it("walks the guide's six words step by step before the deck capstone", () => {
    const words = readSource(
      "src/lib/features/learn/components/interactive/words/WordsConceptExperience.svelte"
    );
    const progress = readSource(
      "src/lib/features/learn/components/interactive/words/learning-letters-progress.ts"
    );

    // Step machinery: hand-held one-word-at-a-time flow (grid-lesson pattern),
    // in the guide's Alpha/Beta Words order.
    expect(words).toContain("ExperienceProgressIndicator");
    expect(words).toContain("LEARNING_LETTERS_TOTAL_STEPS");
    expect(words).toContain("capstoneStepIndex");
    expect(progress).toContain(
      '"AAAA",\n  "BBBB",\n  "CCCC",\n  "GGGG",\n  "HHHH",\n  "IIII",'
    );

    // Connective copy is the guide's own prose, verbatim (lt1-abc-ghi) —
    // approved via docs/learn/copy-reviews/words-alpha-beta.md.
    expect(words).toContain(
      "The first words we will learn correspond to VTG’s 1:1 motions."
    );
    expect(words).toContain(
      "you’ll need to use body turns and/or negative space"
    );
    expect(words).toContain(
      "Practice each word once in both directions, then again starting\n              with thumbs out."
    );
  });

  it("loads the founding Learning Letters deck and keeps every card inspectable", () => {
    const stage = readSource(
      "src/lib/features/learn/components/interactive/words/WordSequencePair.svelte"
    );
    const words = readSource(
      "src/lib/features/learn/components/interactive/words/WordsConceptExperience.svelte"
    );

    expect(words).toContain("loadFoundingCollectionSequences");
    expect(words).toContain("ChoreoCardThumbnail");
    expect(words).toContain("SegmentedControl");
    expect(words).toContain("TKAWordGlyph");
    expect(words).toContain("word-choices");
    expect(words).toContain("selected-workspace");
    expect(words).toContain("visitedSequenceIds");
    expect(stage).toContain("InlineAnimationPlayer");
    expect(stage).toContain("ChoreoCard");
    expect(stage).toContain(
      "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)"
    );

    // Composition guards: track count follows the active family (no phantom
    // 4th column), and big-screen tiers use the 1680/2600 seams — a 2200
    // seam is dead on 4K@200% (4k-native-layout.md).
    expect(words).toContain("--family-cols");
    expect(words).not.toContain("min-width: 2200px");
    expect(stage).not.toContain("min-width: 2200px");

    expect(words).not.toContain("getWordSequenceGenerator");
    expect(words).not.toContain("WORD_LESSON_EXAMPLES");
    expect(words).not.toContain("WORD_QUESTIONS");
    expect(words).not.toContain('"AABB"');
    expect(words).not.toContain("CanonicalWordStage");
    expect(words).not.toContain("answer-grid");
    expect(words).not.toContain("challengeFamilyIndex");
    expect(words).not.toContain("summary-families");
    expect(words).not.toContain("letter-train");
    expect(words).not.toContain('.split("")');
    expect(words).not.toContain("<strong>{word}</strong>");
    expect(words).not.toMatch(/box-shadow:\s*inset\s+0\s+-?\d+px/);
    expect(words).not.toMatch(/border-(left|right|top|bottom):\s*[2-9]\d*px/);
    expect(words).not.toContain("WordVisualizer");
    expect(words).not.toContain("AABBDemoPage");
    expect(words).not.toContain("MorePatternsPage");
  });

  it("keeps rejected concept copy out of the live lesson", () => {
    const words = readSource(
      "src/lib/features/learn/components/interactive/words/WordsConceptExperience.svelte"
    );
    const review = readSource("docs/learn/copy-reviews/words-alpha-beta.md");
    const rejectedSection = review
      .split("## Rejected Copy")[1]
      ?.split("## Grounded Evidence Collected")[0];
    const rejectedCopy = [
      ...(rejectedSection ?? "").matchAll(/^> (.+)$/gm),
    ].map(([, copy]) => copy);

    expect(rejectedCopy.length).toBeGreaterThan(0);
    for (const copy of rejectedCopy) {
      expect(words).not.toContain(copy);
    }
  });
});

describe("concept visual grounding workflow", () => {
  it("requires component ownership evidence before lesson UI changes", () => {
    const skill = readSource(".claude/skills/concepts/SKILL.md");
    const gate = readSource(".claude/skills/concepts/visual-grounding-gate.md");

    expect(skill).toContain("visual-grounding-gate.md");
    expect(gate).toContain("| Capability");
    expect(gate).toContain("no-left-edge-accent-bar.md");
    expect(gate).toContain("TKAWordGlyph");
    expect(gate).toContain("inspectable before selection");
    expect(gate).toContain("simultaneous split/stack contract");
  });
});
