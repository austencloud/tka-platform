import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";

export const entries: CorpusEntry[] = [
  {
    id: "pin-led-exclude-others",
    utterance:
      "Eight performers. Everyone gets fire except performer 3, who gets LED no matter what — and nobody else is allowed LED.",
    film: corpusFilm("pin-led-exclude-others", {
      performance: {
        formation: "circle",
        cast: {
          count: 8,
          defaults: { effect: "fire" },
          performers: [{ id: "performer-3", effect: "led" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[2]!.effect !== "led") throw new Error("performer-3 must be led");
        if (performers.filter((p) => p.effect === "led").length !== 1)
          throw new Error("only performer-3 may be led");
      },
    },
  },
  {
    id: "anything-but-led",
    utterance: "Give performer 1 anything except LED.",
    film: corpusFilm("anything-but-led", {
      performance: { cast: { count: 1, performers: [{ effect: { not: "led" } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers[0]!.effect === "led")
          throw new Error("led was excluded");
      },
    },
  },
  {
    id: "nine-performers",
    utterance: "Nine performers in a circle.",
    film: corpusFilm("nine-performers", {
      performance: { formation: "circle", cast: { count: 9 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "8" },
  },
  {
    id: "pin-fire-elsewhere-in-cast",
    utterance:
      "Everyone's on LED tonight, except performer 5 — put her on fire no matter what.",
    film: corpusFilm("pin-fire-elsewhere-in-cast", {
      performance: {
        cast: {
          count: 6,
          defaults: { effect: "led" },
          performers: [{ id: "performer-5", effect: "fire" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[4]!.effect !== "fire") throw new Error("performer-5 must be fire");
        if (performers.filter((p) => p.effect === "fire").length !== 1)
          throw new Error("only performer-5 may be fire");
      },
    },
  },
  {
    id: "exclude-two-named-performers-from-default",
    utterance:
      "Everybody dances with sparkles tonight, except performers 2 and 4 — keep them off sparkles.",
    film: corpusFilm("exclude-two-named-performers-from-default", {
      performance: {
        cast: {
          count: 5,
          defaults: { effect: "sparkles" },
          performers: [
            { id: "performer-2", effect: { not: "sparkles" } },
            { id: "performer-4", effect: { not: "sparkles" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[1]!.effect === "sparkles" || performers[3]!.effect === "sparkles")
          throw new Error("performers 2 and 4 must not be sparkles");
        if (performers[0]!.effect !== "sparkles" || performers[2]!.effect !== "sparkles")
          throw new Error("the rest of the cast keeps the default");
      },
    },
  },
  {
    id: "defaults-override-single-prop-swap",
    utterance: "Everyone's on a staff, except performer 3 — hand her a fan.",
    film: corpusFilm("defaults-override-single-prop-swap", {
      performance: {
        cast: {
          count: 4,
          defaults: { prop: "staff" },
          performers: [{ id: "performer-3", prop: "fan" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[2]!.prop !== "fan") throw new Error("performer-3 must be on fan");
        for (const [index, performer] of performers.entries()) {
          if (index === 2) continue;
          if (performer.prop !== "staff") throw new Error(`performer ${index + 1} must stay on staff`);
        }
      },
    },
  },
  {
    id: "nobody-gets-led-via-not-default",
    utterance: "Nobody gets LED tonight — anything else is fine.",
    film: corpusFilm("nobody-gets-led-via-not-default", {
      performance: { cast: { count: 6, defaults: { effect: { not: "led" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers.some((p) => p.effect === "led"))
          throw new Error("nobody may be led");
      },
    },
  },
  {
    id: "pin-staff-length-exclude-exact-match",
    utterance:
      "Performer 1's staff is exactly 100 centimeters. Nobody else in the cast may match that length exactly — pick from 80, 90, 100, or 110.",
    film: corpusFilm("pin-staff-length-exclude-exact-match", {
      performance: {
        cast: {
          count: 3,
          performers: [
            { id: "performer-1", staffLengthCm: 100 },
            { id: "performer-2", staffLengthCm: { not: 100, from: [80, 90, 100, 110] } },
            { id: "performer-3", staffLengthCm: { not: 100, from: [80, 90, 100, 110] } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[0]!.staffLengthCm !== 100) throw new Error("performer-1 must be 100cm");
        if (performers[1]!.staffLengthCm === 100 || performers[2]!.staffLengthCm === 100)
          throw new Error("nobody else may be exactly 100cm");
      },
    },
  },
  {
    id: "exclude-two-props-at-once",
    utterance: "Give performer 2 anything but a staff or a fan.",
    film: corpusFilm("exclude-two-props-at-once", {
      performance: { cast: { count: 2, performers: [{ id: "performer-2", prop: { not: ["staff", "fan"] } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const prop = spec.scenes[0]!.performance.performers[1]!.prop;
        if (prop === "staff" || prop === "fan")
          throw new Error("performer-2 must not be staff or fan");
      },
    },
  },
  {
    id: "pin-effort-inside-random-cast",
    utterance: "Everyone gets a random effort tonight, but performer 1 has to be punch.",
    film: corpusFilm("pin-effort-inside-random-cast", {
      performance: {
        cast: {
          count: 3,
          defaults: { effort: { pick: "any" } },
          performers: [{ id: "performer-1", effort: "punch" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers[0]!.effort !== "punch")
          throw new Error("performer-1 must be punch");
      },
    },
  },
  {
    id: "oneof-pin-two-choices",
    utterance: "Performer 1 gets either fire or LED — your call.",
    film: corpusFilm("oneof-pin-two-choices", {
      performance: { cast: { count: 1, performers: [{ effect: { oneOf: ["fire", "led"] } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const effect = spec.scenes[0]!.performance.performers[0]!.effect;
        if (effect !== "fire" && effect !== "led")
          throw new Error("effect must be fire or led");
      },
    },
  },
  {
    id: "sameas-prop-mirrors-partner",
    utterance: "Whatever prop performer 1 draws, give performer 2 the exact same one.",
    film: corpusFilm("sameas-prop-mirrors-partner", {
      performance: {
        cast: {
          count: 2,
          performers: [{ id: "performer-1", prop: { pick: "any" } }, { id: "performer-2", prop: { sameAs: "performer-1" } }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[0]!.prop !== performers[1]!.prop)
          throw new Error("performer-2 must copy performer-1's prop");
      },
    },
  },
  {
    id: "sameas-chain-of-three-matches-leader",
    utterance: "Everyone matches performer 1's effect — no exceptions.",
    film: corpusFilm("sameas-chain-of-three-matches-leader", {
      performance: {
        cast: {
          count: 4,
          performers: [
            { id: "performer-1", effect: "zap" },
            { id: "performer-2", effect: { sameAs: "performer-1" } },
            { id: "performer-3", effect: { sameAs: "performer-1" } },
            { id: "performer-4", effect: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers.some((p) => p.effect !== "zap"))
          throw new Error("every performer must end up on zap");
      },
    },
  },
  {
    id: "pin-formation-to-circle",
    utterance: "Lock the formation to a circle, whatever else changes.",
    film: corpusFilm("pin-formation-to-circle", {
      performance: { formation: "circle", cast: { count: 5 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.formation !== "circle")
          throw new Error("formation must be circle");
      },
    },
  },
  {
    id: "pin-environment-exclude-effect",
    utterance: "Set this one in the ocean, and make sure nobody's doing LED.",
    film: corpusFilm("pin-environment-exclude-effect", {
      location: { environmentId: "ocean" },
      performance: { cast: { count: 3, defaults: { effect: { not: "led" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const scene = spec.scenes[0]!;
        if (scene.location.environmentId !== "ocean") throw new Error("environment must be ocean");
        if (scene.performance.performers.some((p) => p.effect === "led"))
          throw new Error("nobody may be led");
      },
    },
  },
  {
    id: "pin-character-no-substitutes",
    utterance: "Performer 1 has to be Y-Bot — no substitutes.",
    film: corpusFilm("pin-character-no-substitutes", {
      performance: { cast: { count: 1, performers: [{ characterId: "y-bot" }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers[0]!.characterId !== "y-bot")
          throw new Error("performer-1 must be y-bot");
      },
    },
  },
  {
    id: "sameas-character-look-identical",
    utterance: "Make performer 2 look identical to performer 1.",
    film: corpusFilm("sameas-character-look-identical", {
      performance: {
        cast: {
          count: 2,
          performers: [{ id: "performer-1", characterId: { pick: "any" } }, { id: "performer-2", characterId: { sameAs: "performer-1" } }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[0]!.characterId !== performers[1]!.characterId)
          throw new Error("performer-2 must match performer-1's character");
      },
    },
  },
  {
    id: "anything-but-two-effects",
    utterance: "Performer 1 can wear anything except fire or led.",
    film: corpusFilm("anything-but-two-effects", {
      performance: { cast: { count: 1, performers: [{ effect: { not: ["fire", "led"] } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const effect = spec.scenes[0]!.performance.performers[0]!.effect;
        if (effect === "fire" || effect === "led")
          throw new Error("fire and led were both excluded");
      },
    },
  },
  {
    id: "pin-two-performers-different-props",
    utterance: "Performer 1 gets a sword, performer 2 gets a fan — everyone else, whatever.",
    film: corpusFilm("pin-two-performers-different-props", {
      performance: {
        cast: {
          count: 4,
          performers: [{ id: "performer-1", prop: "sword" }, { id: "performer-2", prop: "fan" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[0]!.prop !== "sword") throw new Error("performer-1 must be sword");
        if (performers[1]!.prop !== "fan") throw new Error("performer-2 must be fan");
      },
    },
  },
  {
    id: "exclude-not-from-explicit-pool",
    utterance: "Performer 3's effort is anything from linear, glide, or dab — but not glide.",
    film: corpusFilm("exclude-not-from-explicit-pool", {
      performance: {
        cast: {
          count: 3,
          performers: [{ id: "performer-3", effort: { not: "glide", from: ["linear", "glide", "dab"] } }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const effort = spec.scenes[0]!.performance.performers[2]!.effort;
        if (effort !== "linear" && effort !== "dab")
          throw new Error("performer-3's effort must be linear or dab");
      },
    },
  },
  {
    id: "sameas-effort-two-hop-chain",
    utterance: "Performer 2 matches performer 1's effort, and performer 3 matches performer 2's.",
    film: corpusFilm("sameas-effort-two-hop-chain", {
      performance: {
        cast: {
          count: 3,
          performers: [
            { id: "performer-1", effort: "bounce" },
            { id: "performer-2", effort: { sameAs: "performer-1" } },
            { id: "performer-3", effort: { sameAs: "performer-2" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers.some((p) => p.effort !== "bounce"))
          throw new Error("the chain must resolve to bounce");
      },
    },
  },
  {
    id: "pin-count-one-with-exclusion",
    utterance: "Solo performer, any prop except a staff.",
    film: corpusFilm("pin-count-one-with-exclusion", {
      performance: { formation: "solo", cast: { count: 1, performers: [{ prop: { not: "staff" } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers[0]!.prop === "staff")
          throw new Error("staff was excluded");
      },
    },
  },
  {
    id: "pin-formation-literal-with-pinned-cast",
    utterance: "Two performers facing each other — performer 1 on fire, performer 2 on LED.",
    film: corpusFilm("pin-formation-literal-with-pinned-cast", {
      performance: {
        formation: "facing-each-other",
        cast: {
          count: 2,
          performers: [{ id: "performer-1", effect: "fire" }, { id: "performer-2", effect: "led" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[0]!.effect !== "fire" || performers[1]!.effect !== "led")
          throw new Error("pinned effects must hold under the facing-each-other formation");
      },
    },
  },
  {
    id: "default-pick-any-with-two-pins",
    utterance:
      "Effect is a free pick for everyone, except performer 2 stays on sparkles and performer 5 stays on smoke.",
    film: corpusFilm("default-pick-any-with-two-pins", {
      performance: {
        cast: {
          count: 6,
          defaults: { effect: { pick: "any" } },
          performers: [{ id: "performer-2", effect: "sparkles" }, { id: "performer-5", effect: "smoke" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[1]!.effect !== "sparkles") throw new Error("performer-2 must stay sparkles");
        if (performers[4]!.effect !== "smoke") throw new Error("performer-5 must stay smoke");
      },
    },
  },
  {
    id: "exclude-effect-and-pin-prop-together",
    utterance: "Performer 4 is never allowed bloom, and always carries a club.",
    film: corpusFilm("exclude-effect-and-pin-prop-together", {
      performance: {
        cast: {
          count: 4,
          performers: [{ id: "performer-4", effect: { not: "bloom" }, prop: "club" }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performer = spec.scenes[0]!.performance.performers[3]!;
        if (performer.effect === "bloom") throw new Error("bloom was excluded");
        if (performer.prop !== "club") throw new Error("performer-4 must carry a club");
      },
    },
  },
  {
    id: "sameas-staff-length-copies-pinned-value",
    utterance: "Performer 2's staff must match performer 1's — performer 1 is set to 220cm.",
    film: corpusFilm("sameas-staff-length-copies-pinned-value", {
      performance: {
        cast: {
          count: 2,
          performers: [
            { id: "performer-1", staffLengthCm: 220 },
            { id: "performer-2", staffLengthCm: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.scenes[0]!.performance.performers;
        if (performers[1]!.staffLengthCm !== 220)
          throw new Error("performer-2's staff must copy performer-1's 220cm");
      },
    },
  },
  {
    id: "exclude-character-from-defaults",
    utterance: "Nobody in this cast can be X-Bot.",
    film: corpusFilm("exclude-character-from-defaults", {
      performance: { cast: { count: 5, defaults: { characterId: { not: "x-bot" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers.some((p) => p.characterId === "x-bot"))
          throw new Error("x-bot was excluded from the whole cast");
      },
    },
  },
];
