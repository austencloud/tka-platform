import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";

// A director's typo or a made-up name should get an error that names the
// exact thing they typed, not a generic "invalid input." Schema-level
// rejections here come back as a full ZodError, and `String(error)` is that
// error's JSON-stringified issue list — so a value like `chainsaw` shows up
// JSON-escaped, as `\"chainsaw\"`, inside the larger text. The
// `messageIncludes` strings below intentionally carry that escaping; it is
// the literal substring the real thrown error contains, not a stylistic
// choice.

export const entries: CorpusEntry[] = [
  {
    id: "nonexistent-prop-chainsaw",
    utterance: "Give the performer a chainsaw.",
    film: corpusFilm("nonexistent-prop-chainsaw", {
      performance: { cast: { count: 1, performers: [{ prop: "chainsaw" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown prop \\"chainsaw\\"' },
  },
  {
    id: "nonexistent-prop-hoverboard-in-defaults",
    utterance: "Everyone's default prop is a hoverboard.",
    film: corpusFilm("nonexistent-prop-hoverboard-in-defaults", {
      performance: { cast: { count: 2, defaults: { prop: "hoverboard" } } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown prop \\"hoverboard\\"' },
  },
  {
    id: "nonexistent-prop-inside-pick-from-pool",
    utterance: "Pick freely from staff or chainsaw for this performer.",
    film: corpusFilm("nonexistent-prop-inside-pick-from-pool", {
      performance: {
        cast: { count: 1, performers: [{ prop: { pick: "any", from: ["staff", "chainsaw"] } }] },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown prop \\"chainsaw\\"' },
  },
  {
    id: "nonexistent-prop-inside-oneof",
    utterance: "This performer's prop is either a staff or a chainsaw.",
    film: corpusFilm("nonexistent-prop-inside-oneof", {
      performance: { cast: { count: 1, performers: [{ prop: { oneOf: ["staff", "chainsaw"] } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown prop \\"chainsaw\\"' },
  },
  {
    id: "nonexistent-prop-inside-not",
    utterance: "Just make sure this performer isn't holding a chainsaw.",
    film: corpusFilm("nonexistent-prop-inside-not", {
      performance: { cast: { count: 1, performers: [{ prop: { not: "chainsaw" } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown prop \\"chainsaw\\"' },
  },
  {
    id: "nonexistent-effort-sassy",
    utterance: "Give this performer a sassy effort quality.",
    film: corpusFilm("nonexistent-effort-sassy", {
      performance: { cast: { count: 1, performers: [{ effort: "sassy" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown effort \\"sassy\\"' },
  },
  {
    id: "nonexistent-effort-vibing-in-defaults",
    utterance: "Default everyone's effort to vibing.",
    film: corpusFilm("nonexistent-effort-vibing-in-defaults", {
      performance: { cast: { count: 2, defaults: { effort: "vibing" } } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown effort \\"vibing\\"' },
  },
  {
    id: "nonexistent-formation-spiral-galaxy",
    utterance: "Arrange the cast in a spiral galaxy formation.",
    film: corpusFilm("nonexistent-formation-spiral-galaxy", {
      performance: { formation: "spiral-galaxy", cast: { count: 4 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown formation \\"spiral-galaxy\\"' },
  },
  {
    id: "nonexistent-formation-inside-oneof",
    utterance: "Formation is either a circle or a spiral galaxy — director's choice.",
    film: corpusFilm("nonexistent-formation-inside-oneof", {
      performance: { formation: { oneOf: ["circle", "spiral-galaxy"] }, cast: { count: 4 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown formation \\"spiral-galaxy\\"' },
  },
  {
    id: "nonexistent-effect-rainbow-trail",
    utterance: "Give this performer the rainbow-trail effect.",
    film: corpusFilm("nonexistent-effect-rainbow-trail", {
      performance: { cast: { count: 1, performers: [{ effect: "rainbow-trail" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown effect \\"rainbow-trail\\"' },
  },
  {
    id: "nonexistent-effect-unicorn-sparkle-in-defaults",
    utterance: "Every performer's default effect is unicorn-sparkle.",
    film: corpusFilm("nonexistent-effect-unicorn-sparkle-in-defaults", {
      performance: { cast: { count: 2, defaults: { effect: "unicorn-sparkle" } } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown effect \\"unicorn-sparkle\\"' },
  },
  {
    id: "nonexistent-effect-dormant-frost",
    utterance: "Give this performer the frost effect.",
    film: corpusFilm("nonexistent-effect-dormant-frost", {
      performance: { cast: { count: 1, performers: [{ effect: "frost" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown effect \\"frost\\"' },
  },
  {
    id: "nonexistent-environment-moon",
    utterance: "Set the scene on the moon.",
    film: corpusFilm("nonexistent-environment-moon", {
      location: { environmentId: "moon" },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown 3D environment \\"moon\\"' },
  },
  {
    id: "nonexistent-environment-tundra-oneof",
    utterance: "Set the scene in either the forest or the tundra.",
    film: corpusFilm("nonexistent-environment-tundra-oneof", {
      location: { environmentId: { oneOf: ["forest", "tundra"] } },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown 3D environment \\"tundra\\"' },
  },
  {
    id: "nonexistent-avatar-robo9000",
    utterance: "Cast robo-9000 as the performer.",
    film: corpusFilm("nonexistent-avatar-robo9000", {
      performance: { cast: { count: 1, performers: [{ avatarId: "robo-9000" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Avatar "robo-9000" is not in the deployed 3D catalog' },
  },
  {
    id: "nonexistent-avatar-captain-crunch-in-defaults",
    utterance: "Cast captain-crunch as everyone's default avatar.",
    film: corpusFilm("nonexistent-avatar-captain-crunch-in-defaults", {
      performance: { cast: { count: 2, defaults: { avatarId: "captain-crunch" } } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Avatar "captain-crunch" is not in the deployed 3D catalog' },
  },
  {
    id: "nonexistent-avatar-inside-oneof",
    utterance: "Cast this performer as either x-bot or robo-9000.",
    film: corpusFilm("nonexistent-avatar-inside-oneof", {
      performance: { cast: { count: 1, performers: [{ avatarId: { oneOf: ["x-bot", "robo-9000"] } }] } },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: '"robo-9000" is not in the deployed catalog for this axis',
    },
  },
  {
    id: "nonexistent-effect-preset-references-unknown-effect",
    utterance: "Apply the holo-shimmer preset to this scene.",
    film: corpusFilm("nonexistent-effect-preset-references-unknown-effect", {
      effectPresets: { "holo-shimmer": "some-preset" },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: 'Effect preset references unknown effect "holo-shimmer"',
    },
  },
  {
    id: "nonexistent-preset-name-on-real-effect-fire",
    utterance: "Use the fire-nonexistent-preset preset for the fire effect.",
    film: corpusFilm("nonexistent-preset-name-on-real-effect-fire", {
      effectPresets: { fire: "fire-nonexistent-preset" },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: 'Effect "fire" has no preset named "fire-nonexistent-preset"',
    },
  },
  {
    id: "nonexistent-preset-name-on-real-effect-goo",
    utterance: "Use the goo-radioactive preset for the goo effect.",
    film: corpusFilm("nonexistent-preset-name-on-real-effect-goo", {
      effectPresets: { goo: "goo-radioactive" },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: 'Effect "goo" has no preset named "goo-radioactive"',
    },
  },
  {
    id: "nonexistent-configurable-effect-override-key",
    utterance: "Configure the shimmer-blast effect with extra intensity.",
    film: corpusFilm("nonexistent-configurable-effect-override-key", {
      effectOverrides: { "shimmer-blast": { intensity: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown configurable effect \\"shimmer-blast\\"' },
  },
  {
    id: "nonexistent-configurable-effect-override-key-dormant-frost",
    utterance: "Configure the frost effect's crystallization amount.",
    film: corpusFilm("nonexistent-configurable-effect-override-key-dormant-frost", {
      effectOverrides: { frost: { crystallization: 0.5 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown configurable effect \\"frost\\"' },
  },
  {
    id: "nonexistent-effect-with-no-registered-presets-pick-any",
    utterance: "Pick any preset for the trails effect on this scene.",
    film: corpusFilm("nonexistent-effect-with-no-registered-presets-pick-any", {
      effectPresets: { trails: { pick: "any" } },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "nonexistent-effect-inside-sameas-chain-frost",
    utterance: "Performer 2's effect should match performer 1's — and performer 1 is set to frost.",
    film: corpusFilm("nonexistent-effect-inside-sameas-chain-frost", {
      performance: {
        cast: {
          count: 2,
          performers: [
            { id: "performer-1", effect: "frost" },
            { id: "performer-2", effect: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown effect \\"frost\\"' },
  },
  {
    id: "nonexistent-prop-typo-stafff",
    utterance: "Give the performer a stafff — extra f, my mistake.",
    film: corpusFilm("nonexistent-prop-typo-stafff", {
      performance: { cast: { count: 1, performers: [{ prop: "stafff" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown prop \\"stafff\\"' },
  },
  {
    id: "nonexistent-avatar-phantom-cast-member",
    utterance: "Cast an unnamed avatar for this performer.",
    film: corpusFilm("nonexistent-avatar-blank-string", {
      performance: { cast: { count: 1, performers: [{ avatarId: "phantom-cast-member" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Avatar "phantom-cast-member" is not in the deployed 3D catalog' },
  },
  {
    id: "real-prop-and-effect-sanity-check",
    utterance: "Give the performer a real staff and the real fire effect, to confirm the happy path still resolves.",
    film: corpusFilm("real-prop-and-effect-sanity-check", {
      performance: { cast: { count: 1, performers: [{ prop: "staff", effect: "fire" }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performer = spec.scenes[0]!.performance.performers[0]!;
        if (performer.prop !== "staff" || performer.effect !== "fire")
          throw new Error("expected the real staff/fire values to pass through unchanged");
      },
    },
  },
];
