import {
  Letter,
  normalizeLetter,
  type Letter as TkaLetter,
} from "$lib/shared/foundation/domain/models/letter";
import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";

export const PRONUNCIATION_POSITIONS = [
  "isolated",
  "initial",
  "medial",
  "final",
] as const;

export type PronunciationPosition = (typeof PRONUNCIATION_POSITIONS)[number];

export interface PronunciationCue {
  letter: TkaLetter;
  spokenName: string;
  assetKey: string;
  position: PronunciationPosition;
  pauseAfterMs: number;
}

export interface PronunciationPlan {
  cues: PronunciationCue[];
  spokenText: string;
}

export type PronunciationRecordingSet = Partial<
  Record<PronunciationPosition, string>
>;

export interface PronunciationManifest {
  version: 1;
  recordings: Record<string, PronunciationRecordingSet>;
}

export interface LetterPronunciation {
  readonly spokenName: string;
  readonly assetKey: string;
}

const LETTER_PRONUNCIATIONS = new Map<TkaLetter, LetterPronunciation>(
  (Object.entries(Letter) as Array<[string, TkaLetter]>).map(
    ([memberName, letter]) => [
      letter,
      {
        spokenName: memberName
          .split("_")
          .map((part, index) =>
            part.length === 1
              ? part
              : index === 0
                ? `${part[0]}${part.slice(1).toLowerCase()}`
                : part.toLowerCase()
          )
          .join(" "),
        assetKey: memberName.toLowerCase().replaceAll("_", "-"),
      },
    ]
  )
);

const WITHIN_GROUP_PAUSE_MS = 80;
const BETWEEN_GROUP_PAUSE_MS = 260;

export function getLetterPronunciation(
  letter: TkaLetter
): LetterPronunciation | null {
  return LETTER_PRONUNCIATIONS.get(letter) ?? null;
}

function positionFor(
  index: number,
  groupLength: number
): PronunciationPosition {
  if (groupLength === 1) return "isolated";
  if (index === 0) return "initial";
  if (index === groupLength - 1) return "final";
  return "medial";
}

/**
 * Turn the exact workspace label into a pronunciation plan.
 *
 * A middle dot separates compressed LOOP runs. Every other character must
 * resolve to a canonical TKA letter; an unknown token rejects the whole plan
 * so read-aloud never silently changes the word.
 */
export function createPronunciationPlan(
  workspaceLabel: string
): PronunciationPlan | null {
  const rawGroups = workspaceLabel
    .split(/\s*·\s*/u)
    .map((group) => group.trim())
    .filter(Boolean);

  if (rawGroups.length === 0) return null;

  const groups: TkaLetter[][] = [];
  for (const rawGroup of rawGroups) {
    const group: TkaLetter[] = [];
    for (const rawToken of tokenizeWord(rawGroup)) {
      const letter = normalizeLetter(rawToken);
      if (!letter) return null;
      group.push(letter);
    }
    if (group.length === 0) return null;
    groups.push(group);
  }

  const cues: PronunciationCue[] = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex]!;
    for (let letterIndex = 0; letterIndex < group.length; letterIndex++) {
      const letter = group[letterIndex]!;
      const pronunciation = getLetterPronunciation(letter);
      if (!pronunciation) return null;

      const isLastInGroup = letterIndex === group.length - 1;
      const isLastGroup = groupIndex === groups.length - 1;
      cues.push({
        letter,
        ...pronunciation,
        position: positionFor(letterIndex, group.length),
        pauseAfterMs: isLastInGroup
          ? isLastGroup
            ? 0
            : BETWEEN_GROUP_PAUSE_MS
          : WITHIN_GROUP_PAUSE_MS,
      });
    }
  }

  if (cues.length === 0) return null;

  const spokenText = groups
    .map((group) =>
      group
        .map((letter) => getLetterPronunciation(letter)!.spokenName)
        .join(", ")
    )
    .join(". ");

  return {
    cues,
    spokenText: `${spokenText}.`,
  };
}

/**
 * Resolve one file per cue. Missing a single contextual take rejects the
 * entire recorded phrase, keeping human and synthetic voices out of the same
 * word.
 */
export function resolveRecordedCuePaths(
  cues: readonly PronunciationCue[],
  manifest: PronunciationManifest
): string[] | null {
  const paths = cues.map(
    (cue) => manifest.recordings[cue.assetKey]?.[cue.position]
  );
  return paths.every((path): path is string => Boolean(path)) ? paths : null;
}
