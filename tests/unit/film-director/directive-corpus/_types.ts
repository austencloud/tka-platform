import type { ResolvedFilmDirectorSpec } from "../../../../src/routes/test/film-director/_lib/film-director-schema";

export interface CorpusEntry {
  id: string;
  /** The human sentence, exactly as a director would say it. */
  utterance: string;
  /** The canonical translation of the utterance. */
  film: unknown;
  expect:
    | { outcome: "resolves"; assert?: (spec: ResolvedFilmDirectorSpec) => void }
    | { outcome: "rejects"; messageIncludes: string };
}
