import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";

export const entries: CorpusEntry[] = [
  {
    id: "distinct-effect-8-performers-pool-of-5",
    utterance: "Eight performers, each a different effect — but only fire, led, zap, sparkles, or bloom are allowed.",
    film: corpusFilm("distinct-effect-8-performers-pool-of-5", {
      performance: {
        formation: "circle",
        cast: { count: 8, defaults: { effect: { pick: "distinct", from: ["fire", "led", "zap", "sparkles", "bloom"] } } },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "only 5" },
  },
  {
    id: "distinct-prop-6-performers-pool-of-3",
    utterance: "Six performers, a different prop each, choosing only between staff, club, and fan.",
    film: corpusFilm("distinct-prop-6-performers-pool-of-3", {
      performance: { cast: { count: 6, defaults: { prop: { pick: "distinct", from: ["staff", "club", "fan"] } } } },
    }),
    expect: { outcome: "rejects", messageIncludes: "only 3" },
  },
  {
    id: "distinct-effort-8-performers-pool-of-4",
    utterance: "Eight performers, every effort different, but stick to linear, glide, dab, and press only.",
    film: corpusFilm("distinct-effort-8-performers-pool-of-4", {
      performance: {
        formation: "circle",
        cast: { count: 8, defaults: { effort: { pick: "distinct", from: ["linear", "glide", "dab", "press"] } } },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "only 4" },
  },
  {
    id: "distinct-character-6-performers-pool-of-4",
    utterance: "Six performers, all different characters, but only casting from x-bot, y-bot, remy, and ch26.",
    film: corpusFilm("distinct-character-6-performers-pool-of-4", {
      performance: {
        cast: { count: 6, defaults: { characterId: { pick: "distinct", from: ["x-bot", "y-bot", "remy", "ch26"] } } },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "only 4" },
  },
  {
    id: "distinct-staff-length-4-performers-pool-of-2",
    utterance: "Four performers with different staff lengths, but only 80cm or 100cm are available.",
    film: corpusFilm("distinct-staff-length-4-performers-pool-of-2", {
      performance: { cast: { count: 4, defaults: { staffLengthCm: { pick: "distinct", from: [80, 100] } } } },
    }),
    expect: { outcome: "rejects", messageIncludes: "only 2" },
  },
  {
    id: "not-excludes-entire-effect-pool",
    utterance: "Performer 1 must not have fire or LED — and those are the only two effects on the table tonight.",
    film: corpusFilm("not-excludes-entire-effect-pool", {
      performance: { cast: { count: 1, performers: [{ effect: { not: ["fire", "led"], from: ["fire", "led"] } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "excludes every allowed value" },
  },
  {
    id: "not-excludes-entire-prop-pool",
    utterance: "Performer 1's prop can't be a staff, and staff is the only prop we brought.",
    film: corpusFilm("not-excludes-entire-prop-pool", {
      performance: { cast: { count: 1, performers: [{ prop: { not: "staff", from: ["staff"] } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "excludes every allowed value" },
  },
  {
    id: "not-excludes-entire-character-pool",
    utterance: "Performer 1 can't be x-bot or y-bot, and those are the only two characters we're allowed to use.",
    film: corpusFilm("not-excludes-entire-character-pool", {
      performance: {
        cast: { count: 1, performers: [{ characterId: { not: ["x-bot", "y-bot"], from: ["x-bot", "y-bot"] } }] },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "excludes every allowed value" },
  },
  {
    id: "not-excludes-entire-effort-pool",
    utterance: "Performer 1's effort can't be linear or glide, and those are the only two efforts allowed here.",
    film: corpusFilm("not-excludes-entire-effort-pool", {
      performance: {
        cast: { count: 1, performers: [{ effort: { not: ["linear", "glide"], from: ["linear", "glide"] } }] },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "excludes every allowed value" },
  },
  {
    id: "sameas-two-cycle-effect",
    utterance: "Performer 1 copies performer 2's effect, and performer 2 copies performer 1's — good luck with that.",
    film: corpusFilm("sameas-two-cycle-effect", {
      performance: {
        cast: {
          count: 2,
          performers: [
            { id: "performer-1", effect: { sameAs: "performer-2" } },
            { id: "performer-2", effect: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "forms a cycle involving" },
  },
  {
    id: "sameas-self-reference-effect",
    utterance: "Performer 1's effect should match... performer 1's effect.",
    film: corpusFilm("sameas-self-reference-effect", {
      performance: { cast: { count: 1, performers: [{ effect: { sameAs: "performer-1" } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "forms a cycle involving performer-1" },
  },
  {
    id: "sameas-three-cycle-effect",
    utterance: "Performer 1 copies performer 2, performer 2 copies performer 3, and performer 3 copies performer 1.",
    film: corpusFilm("sameas-three-cycle-effect", {
      performance: {
        cast: {
          count: 3,
          performers: [
            { id: "performer-1", effect: { sameAs: "performer-2" } },
            { id: "performer-2", effect: { sameAs: "performer-3" } },
            { id: "performer-3", effect: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "forms a cycle involving" },
  },
  {
    id: "sameas-two-cycle-character",
    utterance: "Give performer 1 and performer 2 each other's character — literally, copy each other.",
    film: corpusFilm("sameas-two-cycle-character", {
      performance: {
        cast: {
          count: 2,
          performers: [
            { id: "performer-1", characterId: { sameAs: "performer-2" } },
            { id: "performer-2", characterId: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "forms a cycle involving" },
  },
  {
    id: "sameas-unknown-performer-id",
    utterance: "Performer 1 should match performer 99's effect.",
    film: corpusFilm("sameas-unknown-performer-id", {
      performance: { cast: { count: 2, performers: [{ id: "performer-1", effect: { sameAs: "performer-99" } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "performer-99" },
  },
  {
    id: "sameas-unknown-performer-id-prop",
    utterance: "Performer 2's prop should match performer 12's — there is no performer 12.",
    film: corpusFilm("sameas-unknown-performer-id-prop", {
      performance: { cast: { count: 3, performers: [{ id: "performer-2", prop: { sameAs: "performer-12" } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "performer-12" },
  },
  {
    id: "staff-length-sameas-performer-with-no-staff-length",
    utterance: "Performer 2's staff should match performer 1's staff length — but performer 1 never got one assigned.",
    film: corpusFilm("staff-length-sameas-performer-with-no-staff-length", {
      performance: {
        cast: { count: 2, performers: [{ id: "performer-2", staffLengthCm: { sameAs: "performer-1" } }] },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "has no staff length to copy" },
  },
  {
    id: "cast-override-id-out-of-range",
    utterance: "Give performer 7 fire — even though we only have 3 performers.",
    film: corpusFilm("cast-override-id-out-of-range", {
      performance: { cast: { count: 3, performers: [{ id: "performer-7", effect: "fire" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "does not match any of the 3 performers" },
  },
  {
    id: "cast-override-id-not-numeric-pattern",
    utterance: "Give \"dancer-1\" a sword.",
    film: corpusFilm("cast-override-id-not-numeric-pattern", {
      performance: { cast: { count: 2, performers: [{ id: "dancer-1", prop: "sword" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "does not match any of the 2 performers" },
  },
  {
    id: "cast-override-id-zero-out-of-range",
    utterance: "Performer 0 gets LED.",
    film: corpusFilm("cast-override-id-zero-out-of-range", {
      performance: { cast: { count: 3, performers: [{ id: "performer-0", effect: "led" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "does not match any of the 3 performers" },
  },
  {
    id: "nine-performers-no-formation-specified",
    utterance: "Nine dancers on stage, formation doesn't matter.",
    film: corpusFilm("nine-performers-no-formation-specified", {
      performance: { cast: { count: 9 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "8" },
  },
  {
    id: "formation-solo-mismatch-three-performers",
    utterance: "Three performers, but keep it a solo scene.",
    film: corpusFilm("formation-solo-mismatch-three-performers", {
      performance: { formation: "solo", cast: { count: 3 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Formation "solo" does not support 3 performers' },
  },
  {
    id: "formation-back-to-back-mismatch-five-performers",
    utterance: "Back to back, but with five performers.",
    film: corpusFilm("formation-back-to-back-mismatch-five-performers", {
      performance: { formation: "back-to-back", cast: { count: 5 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Formation "back-to-back" does not support 5 performers' },
  },
  {
    id: "formation-facing-each-other-mismatch-solo",
    utterance: "Just one performer, facing each other.",
    film: corpusFilm("formation-facing-each-other-mismatch-solo", {
      performance: { formation: "facing-each-other", cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Formation "facing-each-other" does not support 1 performers' },
  },
  {
    id: "formation-stage-lr-mismatch-four-performers",
    utterance: "Stage left and right, with four performers.",
    film: corpusFilm("formation-stage-lr-mismatch-four-performers", {
      performance: { formation: "stage-lr", cast: { count: 4 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Formation "stage-lr" does not support 4 performers' },
  },
  {
    id: "formation-grid-mismatch-five-performers",
    utterance: "Grid formation with five performers.",
    film: corpusFilm("formation-grid-mismatch-five-performers", {
      performance: { formation: "grid-2x2", cast: { count: 5 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Formation "grid-2x2" does not support 5 performers' },
  },
  {
    id: "custom-formation-missing-positions",
    utterance: "Use a fully custom formation for three performers — I'll place them later.",
    film: corpusFilm("custom-formation-missing-positions", {
      performance: { formation: "custom", cast: { count: 3 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Every performer in a custom formation needs a position" },
  },
  {
    id: "not-excludes-whole-staff-length-pool",
    utterance: "Performer 1's staff can't be 100 or 120 centimeters — and those are the only two lengths on the truck.",
    film: corpusFilm("not-excludes-whole-staff-length-pool", {
      performance: {
        cast: { count: 1, performers: [{ staffLengthCm: { not: [100, 120], from: [100, 120] } }] },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "excludes every allowed value" },
  },
  {
    id: "distinct-formation-open-pick-impossible-count",
    utterance: "One performer, but make sure the formation is different from... itself, somehow.",
    film: corpusFilm("distinct-formation-open-pick-impossible-count", {
      performance: { formation: { pick: "distinct" }, cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "distinct/sameAs are performer-scoped" },
  },
];
