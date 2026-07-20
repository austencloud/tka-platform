import {
  Letter,
  type Letter as TkaLetter,
} from "$lib/shared/foundation/domain/models/letter";
import {
  PRONUNCIATION_POSITIONS,
  getLetterPronunciation,
  type PronunciationPosition,
} from "$lib/shared/pronunciation/pronunciation-plan";

export type TargetSegment = "only" | "first" | "middle" | "last";

export interface RecordingPromptPart {
  text: string;
  punctuation: "" | "," | ".";
  target: boolean;
}

export interface PronunciationRecordingJob {
  id: string;
  letter: TkaLetter;
  memberName: string;
  spokenName: string;
  assetKey: string;
  position: PronunciationPosition;
  contextLabel: string;
  contourLabel: string;
  direction: string;
  promptParts: RecordingPromptPart[];
  targetSegment: TargetSegment;
  outputPath: string;
}

export interface PronunciationRecordingRow {
  letter: TkaLetter;
  spokenName: string;
  jobs: PronunciationRecordingJob[];
}

interface ContextDefinition {
  label: string;
  contour: string;
  direction: string;
  targetSegment: TargetSegment;
  makePrompt: (spokenName: string) => RecordingPromptPart[];
}

const target = (
  text: string,
  punctuation: RecordingPromptPart["punctuation"]
): RecordingPromptPart => ({ text, punctuation, target: true });

const carrier = (
  text: string,
  punctuation: RecordingPromptPart["punctuation"]
): RecordingPromptPart => ({ text, punctuation, target: false });

export const RECORDING_CONTEXTS: Record<
  PronunciationPosition,
  ContextDefinition
> = {
  isolated: {
    label: "By itself",
    contour: "Neutral finish",
    direction:
      "Say the complete name calmly. Let it finish without sounding clipped or unfinished.",
    targetSegment: "only",
    makePrompt: (spokenName) => [target(spokenName, ".")],
  },
  initial: {
    label: "First in a word",
    contour: "Light continuation",
    direction:
      "Open the list and leave a little room for the next item. Keep it subtle, not question-shaped.",
    targetSegment: "first",
    makePrompt: (spokenName) => [
      target(spokenName, ","),
      carrier("Beta", ","),
      carrier("Gamma", "."),
    ],
  },
  medial: {
    label: "Middle of a word",
    contour: "Connected and level",
    direction:
      "Stay near level and connected on both sides. Leave a clear beat at each comma for the crop.",
    targetSegment: "middle",
    makePrompt: (spokenName) => [
      carrier("Alpha", ","),
      target(spokenName, ","),
      carrier("Gamma", "."),
    ],
  },
  final: {
    label: "End of a word",
    contour: "Natural settle",
    direction:
      "Let the full name settle as the phrase ends. For a dash name, spread the fall across the name instead of punching “dash.”",
    targetSegment: "last",
    makePrompt: (spokenName) => [
      carrier("Alpha", ","),
      carrier("Beta", ","),
      target(spokenName, "."),
    ],
  },
};

/**
 * Build one production slot per letter and phrase position. Jobs are ordered
 * by contour sweep so the reader can hold one delivery pattern at a time.
 */
export function buildPronunciationRecordingJobs(): PronunciationRecordingJob[] {
  const letters = Object.entries(Letter) as Array<[string, TkaLetter]>;

  return PRONUNCIATION_POSITIONS.flatMap((position) => {
    const context = RECORDING_CONTEXTS[position];
    return letters.map(([memberName, letter]) => {
      const pronunciation = getLetterPronunciation(letter);
      if (!pronunciation) {
        throw new Error(`Missing pronunciation metadata for ${memberName}`);
      }

      return {
        id: `${pronunciation.assetKey}/${position}`,
        letter,
        memberName,
        spokenName: pronunciation.spokenName,
        assetKey: pronunciation.assetKey,
        position,
        contextLabel: context.label,
        contourLabel: context.contour,
        direction: context.direction,
        promptParts: context.makePrompt(pronunciation.spokenName),
        targetSegment: context.targetSegment,
        outputPath: `${pronunciation.assetKey}/${position}.wav`,
      };
    });
  });
}

export function groupPronunciationRecordingJobs(
  jobs: readonly PronunciationRecordingJob[]
): PronunciationRecordingRow[] {
  const rows = new Map<TkaLetter, PronunciationRecordingRow>();

  for (const job of jobs) {
    const row = rows.get(job.letter);
    if (row) {
      row.jobs.push(job);
    } else {
      rows.set(job.letter, {
        letter: job.letter,
        spokenName: job.spokenName,
        jobs: [job],
      });
    }
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    jobs: PRONUNCIATION_POSITIONS.map(
      (position) => row.jobs.find((job) => job.position === position)!
    ),
  }));
}
