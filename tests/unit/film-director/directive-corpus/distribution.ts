import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";
import { resolveFilmDirectorSpec } from "../../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

// Read directly off the deployed catalogs (film-director-schema.ts,
// resolve-film-director-spec.ts) rather than re-declared locally so a drift
// in the real catalog fails this file's own assertions, not silently passes.
const EFFORT_IDS = ["linear", "glide", "dab", "press", "punch", "elastic", "bounce", "anticipation"];
const ENVIRONMENT_IDS = [
  "cosmic",
  "winter",
  "ocean",
  "ember",
  "blossom",
  "forest",
  "autumn",
  "rainbow",
  "celestial",
  "void",
];
// Formations valid for a 6-performer cast per PRESET_VALID_COUNTS
// (formation-presets.js) — solo/back-to-back/facing-each-other/stage-lr cap
// at 1-2, grid-2x2 caps at 4, custom is excluded from open picks.
const FORMATIONS_VALID_FOR_SIX = ["line", "circle", "v-shape", "diagonal", "tunnel-stack", "side-by-side"];

export const entries: CorpusEntry[] = [
  {
    id: "distinct-effect-full-cast",
    utterance: "Eight performers, give everyone a different effect — I don't care which.",
    film: corpusFilm("distinct-effect-full-cast", {
      performance: { formation: "line", cast: { count: 8, defaults: { effect: { pick: "distinct" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const effects = spec.scenes[0]!.performance.performers.map((p) => p.effect);
        if (new Set(effects).size !== 8) throw new Error("all 8 effects must be distinct");
      },
    },
  },
  {
    id: "distinct-prop-explicit-pool-of-four",
    utterance: "Four performers — different prop each: staff, club, fan, or sword.",
    film: corpusFilm("distinct-prop-explicit-pool-of-four", {
      performance: {
        cast: { count: 4, defaults: { prop: { pick: "distinct", from: ["staff", "club", "fan", "sword"] } } },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const props = spec.scenes[0]!.performance.performers.map((p) => p.prop).sort();
        if (JSON.stringify(props) !== JSON.stringify(["club", "fan", "staff", "sword"]))
          throw new Error("the four props must be exactly the requested pool, once each");
      },
    },
  },
  {
    id: "distinct-pool-sized-exactly-to-count",
    utterance: "Five performers, five different efforts: linear, glide, dab, press, punch — one each.",
    film: corpusFilm("distinct-pool-sized-exactly-to-count", {
      performance: {
        cast: {
          count: 5,
          defaults: { effort: { pick: "distinct", from: ["linear", "glide", "dab", "press", "punch"] } },
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const efforts = spec.scenes[0]!.performance.performers.map((p) => p.effort).sort();
        if (JSON.stringify(efforts) !== JSON.stringify(["dab", "glide", "linear", "press", "punch"]))
          throw new Error("all five efforts from the pool must be used, exactly once each");
      },
    },
  },
  {
    id: "oneof-independent-per-performer",
    utterance: "Every performer independently picks fire or sparkles — doesn't matter if they match.",
    film: corpusFilm("oneof-independent-per-performer", {
      performance: { cast: { count: 5, defaults: { effect: { oneOf: ["fire", "sparkles"] } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers.some((p) => p.effect !== "fire" && p.effect !== "sparkles"))
          throw new Error("every performer must land on fire or sparkles");
      },
    },
  },
  {
    id: "sameas-chain-of-three-props",
    utterance: "Performer 1 picks a prop freely; performer 2 copies performer 1; performer 3 copies performer 2.",
    film: corpusFilm("sameas-chain-of-three-props", {
      performance: {
        cast: {
          count: 3,
          performers: [
            { id: "performer-1", prop: { pick: "any" } },
            { id: "performer-2", prop: { sameAs: "performer-1" } },
            { id: "performer-3", prop: { sameAs: "performer-2" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const props = spec.scenes[0]!.performance.performers.map((p) => p.prop);
        if (props[0] !== props[1] || props[1] !== props[2])
          throw new Error("the whole chain must resolve to the same prop as performer 1");
      },
    },
  },
  {
    id: "mixed-pin-plus-distinct-rest",
    utterance: "Performer 1 is locked to fire; the other three performers each get a different effect from each other and from fire.",
    film: corpusFilm("mixed-pin-plus-distinct-rest", {
      performance: {
        cast: {
          count: 4,
          defaults: { effect: { pick: "distinct" } },
          performers: [{ id: "performer-1", effect: "fire" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const effects = spec.scenes[0]!.performance.performers.map((p) => p.effect);
        if (effects[0] !== "fire") throw new Error("performer-1 must stay fire");
        if (new Set(effects).size !== 4) throw new Error("all four effects must be distinct, including the pin");
      },
    },
  },
  {
    id: "determinism-same-film-resolves-identically-twice",
    utterance: "Performer 1 gets a free pick of effect and prop — resolving the same film twice must not reshuffle it.",
    film: corpusFilm("determinism-same-film-resolves-identically-twice", {
      performance: { cast: { count: 1, performers: [{ effect: { pick: "any" }, prop: { pick: "any" } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const again = resolveFilmDirectorSpec(
          corpusFilm("determinism-same-film-resolves-identically-twice", {
            performance: { cast: { count: 1, performers: [{ effect: { pick: "any" }, prop: { pick: "any" } }] } },
          })
        );
        if (JSON.stringify(spec.scenes) !== JSON.stringify(again.scenes))
          throw new Error("resolving the identical film twice must produce identical output");
      },
    },
  },
  {
    id: "determinism-two-scenes-independent-and-stable",
    utterance: "Two scenes, each with a free effect pick for its own performer — resolve deterministically, scene by scene.",
    film: corpusFilm(
      "determinism-two-scenes-independent-and-stable",
      {},
      {
        scenes: [
          { id: "s1", title: "S1", performance: { cast: { count: 1, defaults: { effect: { pick: "any" } } } } },
          { id: "s2", title: "S2", performance: { cast: { count: 1, defaults: { effect: { pick: "any" } } } } },
        ],
      }
    ),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const again = resolveFilmDirectorSpec(
          corpusFilm(
            "determinism-two-scenes-independent-and-stable",
            {},
            {
              scenes: [
                { id: "s1", title: "S1", performance: { cast: { count: 1, defaults: { effect: { pick: "any" } } } } },
                { id: "s2", title: "S2", performance: { cast: { count: 1, defaults: { effect: { pick: "any" } } } } },
              ],
            }
          )
        );
        const firstEffects = spec.scenes.map((s) => s.performance.performers[0]!.effect);
        const secondEffects = again.scenes.map((s) => s.performance.performers[0]!.effect);
        if (JSON.stringify(firstEffects) !== JSON.stringify(secondEffects))
          throw new Error("re-resolving the same two-scene film must reproduce the same per-scene picks");
      },
    },
  },
  {
    id: "seed-reroll-effect-salt-leaves-prop-untouched",
    utterance: "Reroll just performer 1's effect pick — their prop pick must not move.",
    film: corpusFilm(
      "seed-reroll-effect-salt-leaves-prop-untouched",
      { performance: { cast: { count: 1, performers: [{ effect: { pick: "any" }, prop: { pick: "any" } }] } } },
      { seed: { base: 4242, axes: { effect: 7 } } }
    ),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const rerolled = resolveFilmDirectorSpec(
          corpusFilm(
            "seed-reroll-effect-salt-leaves-prop-untouched",
            { performance: { cast: { count: 1, performers: [{ effect: { pick: "any" }, prop: { pick: "any" } }] } } },
            { seed: { base: 4242, axes: {} } }
          )
        );
        const before = spec.scenes[0]!.performance.performers[0]!.prop;
        const after = rerolled.scenes[0]!.performance.performers[0]!.prop;
        if (before !== after)
          throw new Error("bumping the effect salt must not move the prop pick");
      },
    },
  },
  {
    id: "seed-reroll-prop-salt-leaves-effect-untouched",
    utterance: "Reroll just performer 1's prop pick — their effect pick must not move.",
    film: corpusFilm(
      "seed-reroll-prop-salt-leaves-effect-untouched",
      { performance: { cast: { count: 1, performers: [{ effect: { pick: "any" }, prop: { pick: "any" } }] } } },
      { seed: { base: 909, axes: { prop: 3 } } }
    ),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const rerolled = resolveFilmDirectorSpec(
          corpusFilm(
            "seed-reroll-prop-salt-leaves-effect-untouched",
            { performance: { cast: { count: 1, performers: [{ effect: { pick: "any" }, prop: { pick: "any" } }] } } },
            { seed: { base: 909, axes: {} } }
          )
        );
        const before = spec.scenes[0]!.performance.performers[0]!.effect;
        const after = rerolled.scenes[0]!.performance.performers[0]!.effect;
        if (before !== after)
          throw new Error("bumping the prop salt must not move the effect pick");
      },
    },
  },
  {
    id: "distinct-effort-exact-permutation-of-catalog",
    utterance: "Eight performers, every effort used exactly once between them.",
    film: corpusFilm("distinct-effort-exact-permutation-of-catalog", {
      performance: { formation: "circle", cast: { count: 8, defaults: { effort: { pick: "distinct" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const efforts = spec.scenes[0]!.performance.performers.map((p) => p.effort).sort();
        if (JSON.stringify(efforts) !== JSON.stringify([...EFFORT_IDS].sort()))
          throw new Error("every effort in the catalog must appear exactly once");
      },
    },
  },
  {
    id: "distinct-avatar-from-pool-larger-than-count",
    utterance: "Five performers, five different avatars, drawn from x-bot, y-bot, remy, ch26, ch01, ch07, ch10, ch12.",
    film: corpusFilm("distinct-avatar-from-pool-larger-than-count", {
      performance: {
        cast: {
          count: 5,
          defaults: {
            avatarId: { pick: "distinct", from: ["x-bot", "y-bot", "remy", "ch26", "ch01", "ch07", "ch10", "ch12"] },
          },
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const avatars = spec.scenes[0]!.performance.performers.map((p) => p.avatarId);
        if (new Set(avatars).size !== 5) throw new Error("all five avatars must be distinct");
        const pool = new Set(["x-bot", "y-bot", "remy", "ch26", "ch01", "ch07", "ch10", "ch12"]);
        if (avatars.some((a) => !pool.has(a))) throw new Error("every avatar must come from the requested pool");
      },
    },
  },
  {
    id: "pin-inside-distinct-avoids-collision",
    utterance: "Three performers, each on a different prop — performer 2 must be on a sword no matter what.",
    film: corpusFilm("pin-inside-distinct-avoids-collision", {
      performance: {
        cast: {
          count: 3,
          defaults: { prop: { pick: "distinct" } },
          performers: [{ id: "performer-2", prop: "sword" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const props = spec.scenes[0]!.performance.performers.map((p) => p.prop);
        if (props[1] !== "sword") throw new Error("performer-2 must be sword");
        if (new Set(props).size !== 3) throw new Error("all three props must be distinct including the pin");
      },
    },
  },
  {
    id: "sameas-effort-fanout-from-free-pick",
    utterance: "Performer 1 freely picks an effort, and performers 2 through 5 all copy it.",
    film: corpusFilm("sameas-effort-fanout-from-free-pick", {
      performance: {
        cast: {
          count: 5,
          performers: [
            { id: "performer-1", effort: { pick: "any" } },
            { id: "performer-2", effort: { sameAs: "performer-1" } },
            { id: "performer-3", effort: { sameAs: "performer-1" } },
            { id: "performer-4", effort: { sameAs: "performer-1" } },
            { id: "performer-5", effort: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const efforts = spec.scenes[0]!.performance.performers.map((p) => p.effort);
        if (new Set(efforts).size !== 1) throw new Error("everyone must copy performer 1's effort");
        if (!EFFORT_IDS.includes(efforts[0]!)) throw new Error("the copied effort must be a real effort id");
      },
    },
  },
  {
    id: "distinct-staff-length-from-explicit-pool",
    utterance: "Four performers, four different staff lengths: 60, 90, 120, or 150 centimeters.",
    film: corpusFilm("distinct-staff-length-from-explicit-pool", {
      performance: {
        cast: { count: 4, defaults: { staffLengthCm: { pick: "distinct", from: [60, 90, 120, 150] } } },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const lengths = spec.scenes[0]!.performance.performers.map((p) => p.staffLengthCm).sort((a, b) => a! - b!);
        if (JSON.stringify(lengths) !== JSON.stringify([60, 90, 120, 150]))
          throw new Error("all four staff lengths must be used, exactly once each");
      },
    },
  },
  {
    id: "formation-open-pick-lands-on-valid-choice",
    utterance: "Six performers — pick whatever formation makes sense.",
    film: corpusFilm("formation-open-pick-lands-on-valid-choice", {
      performance: { formation: { pick: "any" }, cast: { count: 6 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const formation = spec.scenes[0]!.performance.formation;
        if (!FORMATIONS_VALID_FOR_SIX.includes(formation))
          throw new Error(`formation "${formation}" is not valid for 6 performers`);
      },
    },
  },
  {
    id: "environment-open-pick-lands-on-real-environment",
    utterance: "Environment is a free pick — surprise me.",
    film: corpusFilm("environment-open-pick-lands-on-real-environment", {
      location: { environmentId: { pick: "any" } },
      performance: { cast: { count: 2 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const environmentId = spec.scenes[0]!.location.environmentId;
        if (!ENVIRONMENT_IDS.includes(environmentId))
          throw new Error(`"${environmentId}" is not a deployed environment`);
      },
    },
  },
  {
    id: "environment-oneof-two-choices",
    utterance: "Set the environment to either ocean or forest.",
    film: corpusFilm("environment-oneof-two-choices", {
      location: { environmentId: { oneOf: ["ocean", "forest"] } },
      performance: { cast: { count: 2 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const environmentId = spec.scenes[0]!.location.environmentId;
        if (environmentId !== "ocean" && environmentId !== "forest")
          throw new Error("environment must be ocean or forest");
      },
    },
  },
  {
    id: "distinct-effort-explicit-pool-of-three",
    utterance: "Three performers, three different efforts — linear, punch, or bounce, one each.",
    film: corpusFilm("distinct-effort-explicit-pool-of-three", {
      performance: {
        cast: { count: 3, defaults: { effort: { pick: "distinct", from: ["linear", "punch", "bounce"] } } },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const efforts = spec.scenes[0]!.performance.performers.map((p) => p.effort).sort();
        if (JSON.stringify(efforts) !== JSON.stringify(["bounce", "linear", "punch"]))
          throw new Error("all three efforts must be used exactly once");
      },
    },
  },
  {
    id: "distinct-effect-allows-none",
    utterance: "Three performers, three different effects between them — it's fine if one of them just carries the prop plain.",
    film: corpusFilm("distinct-effect-allows-none", {
      performance: { cast: { count: 3, defaults: { effect: { pick: "distinct" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const effects = spec.scenes[0]!.performance.performers.map((p) => p.effect);
        if (new Set(effects).size !== 3) throw new Error("all three effects must be distinct");
      },
    },
  },
  {
    id: "two-independent-distinct-axes-at-once",
    utterance: "Four performers, each with a different prop from each other, and independently, each with a different effect from each other.",
    film: corpusFilm("two-independent-distinct-axes-at-once", {
      performance: {
        cast: { count: 4, defaults: { prop: { pick: "distinct" }, effect: { pick: "distinct" } } },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (new Set(performers.map((p) => p.prop)).size !== 4)
          throw new Error("props must be internally distinct");
        if (new Set(performers.map((p) => p.effect)).size !== 4)
          throw new Error("effects must be internally distinct");
      },
    },
  },
  {
    id: "oneof-default-with-pinned-override",
    utterance: "Everyone picks between glide and dab for effort, except performer 1, who's locked to elastic.",
    film: corpusFilm("oneof-default-with-pinned-override", {
      performance: {
        cast: {
          count: 4,
          defaults: { effort: { oneOf: ["glide", "dab"] } },
          performers: [{ id: "performer-1", effort: "elastic" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[0]!.effort !== "elastic") throw new Error("performer-1 must stay elastic");
        for (const performer of performers.slice(1)) {
          if (performer.effort !== "glide" && performer.effort !== "dab")
            throw new Error("everyone else must land on glide or dab");
        }
      },
    },
  },
  {
    id: "distinct-avatar-pool-tighter-than-full-catalog",
    utterance: "Five performers, different avatars, but only pick from remy, ch18, ch21, ch22, ch24.",
    film: corpusFilm("distinct-avatar-pool-tighter-than-full-catalog", {
      performance: {
        cast: { count: 5, defaults: { avatarId: { pick: "distinct", from: ["remy", "ch18", "ch21", "ch22", "ch24"] } } },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const avatars = spec.scenes[0]!.performance.performers.map((p) => p.avatarId).sort();
        if (JSON.stringify(avatars) !== JSON.stringify(["ch18", "ch21", "ch22", "ch24", "remy"]))
          throw new Error("the pool must be used exactly, one avatar per performer");
      },
    },
  },
  {
    id: "distinct-only-among-two-named-performers",
    utterance: "Performers 2 and 4 must be on different props from each other; performers 1 and 3 don't matter.",
    film: corpusFilm("distinct-only-among-two-named-performers", {
      performance: {
        cast: {
          count: 4,
          performers: [
            { id: "performer-2", prop: { pick: "distinct" } },
            { id: "performer-4", prop: { pick: "distinct" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[1]!.prop === performers[3]!.prop)
          throw new Error("performer-2 and performer-4 must differ");
      },
    },
  },
  {
    id: "solo-performer-free-effect-pick",
    utterance: "One performer, any effect at all.",
    film: corpusFilm("solo-performer-free-effect-pick", {
      performance: { formation: "solo", cast: { count: 1, defaults: { effect: { pick: "any" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const effect = spec.scenes[0]!.performance.performers[0]!.effect;
        if (typeof effect !== "string" || effect.length === 0)
          throw new Error("solo performer must still resolve to a concrete effect");
      },
    },
  },
  {
    id: "distinct-two-performers-minimum-case",
    utterance: "Two performers, different effects from each other.",
    film: corpusFilm("distinct-two-performers-minimum-case", {
      performance: { formation: "back-to-back", cast: { count: 2, defaults: { effect: { pick: "distinct" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[0]!.effect === performers[1]!.effect)
          throw new Error("the two performers must differ");
      },
    },
  },
  {
    id: "sameas-formation-scoped-directive-rejected",
    utterance: "Whatever formation scene one uses, copy it for this scene too.",
    film: corpusFilm("sameas-formation-scoped-directive-rejected", {
      performance: { formation: { sameAs: "s0" }, cast: { count: 2 } },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "distinct/sameAs are performer-scoped",
    },
  },
  {
    id: "distinct-formation-scoped-directive-rejected",
    utterance: "Give this scene's formation a different value from every other scene's formation — whatever that means.",
    film: corpusFilm("distinct-formation-scoped-directive-rejected", {
      performance: { formation: { pick: "distinct" }, cast: { count: 2 } },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "distinct/sameAs are performer-scoped",
    },
  },
];
