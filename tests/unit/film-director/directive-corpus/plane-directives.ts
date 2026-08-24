import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";

// bluePlane, redPlane, stepPlanes, and scene.visiblePlanes (landed
// 2026-08-24, plan docs/superpowers/plans/2026-08-24-film-director-plane-axes.md).
// bluePlane/redPlane are full performer-scoped directives (literal, pick
// any/distinct, oneOf, not, sameAs) exactly like prop/effort/avatarId.
// stepPlanes entries are shot-scoped directives (literal, pick:any, oneOf,
// not) resolved via resolveShotDirective, same restriction as environmentId
// and formation — hence the two rejection entries proving distinct/sameAs
// don't reach stepPlane scope. scene.visiblePlanes is a plain literal array
// with duplicate rejection. The nine Plane values: wall, wheel, floor,
// right-shield, left-shield, forward-ramp, backward-ramp, right-wing,
// left-wing (default wall).
//
// planeSchema is a string+refine (same pattern as propTypeSchema/
// effortIdSchema — see the comment above effortIdSchema in
// film-director-schema.ts), so an unknown plane literal or an unknown value
// inside oneOf/not/from surfaces as a ZodError whose String(error) is the
// JSON-stringified issue list — embedded quotes come through
// backslash-escaped, same reasoning as nonexistent.ts and unknown-axis.ts.
// The resolver's own thrown Errors (pool-too-small, sameAs-unknown-performer,
// the stepPlane shot-scope rejection) are plain Errors, not ZodErrors, so
// their quotes are NOT escaped — matches unsatisfiable.ts and
// distribution.ts's sameAs/formation-scope entries.

export const entries: CorpusEntry[] = [
  {
    id: "plane-distinct-blueplane-full-cast-eight",
    utterance: "Eight performers, every one of them on a different plane for their blue hand.",
    film: corpusFilm("plane-distinct-blueplane-full-cast-eight", {
      performance: { formation: "circle", cast: { count: 8, defaults: { bluePlane: { pick: "distinct" } } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const bluePlanes = spec.shots[0]!.performance.performers.map((p) => p.bluePlane);
        if (new Set(bluePlanes).size !== 8) throw new Error("all 8 bluePlane values must be distinct");
      },
    },
  },
  {
    id: "plane-redplane-oneof-two-choices",
    utterance: "This performer's red hand is either on the wall or the floor plane.",
    film: corpusFilm("plane-redplane-oneof-two-choices", {
      performance: { cast: { count: 1, performers: [{ redPlane: { oneOf: ["wall", "floor"] } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const redPlane = spec.shots[0]!.performance.performers[0]!.redPlane;
        if (redPlane !== "wall" && redPlane !== "floor")
          throw new Error("redPlane must land on wall or floor");
      },
    },
  },
  {
    id: "plane-redplane-not-array-excludes-two",
    utterance: "This performer's red hand can be anywhere except the wall or the wheel plane.",
    film: corpusFilm("plane-redplane-not-array-excludes-two", {
      performance: { cast: { count: 1, performers: [{ redPlane: { not: ["wall", "wheel"] } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const redPlane = spec.shots[0]!.performance.performers[0]!.redPlane;
        if (redPlane === "wall" || redPlane === "wheel")
          throw new Error("redPlane must not resolve to wall or wheel");
      },
    },
  },
  {
    id: "plane-blueplane-sameas-single-copy",
    utterance: "Performer 2's blue hand plane should match performer 1's.",
    film: corpusFilm("plane-blueplane-sameas-single-copy", {
      performance: {
        cast: {
          count: 2,
          performers: [
            { id: "performer-1", bluePlane: "wheel" },
            { id: "performer-2", bluePlane: { sameAs: "performer-1" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.shots[0]!.performance.performers;
        if (performers[1]!.bluePlane !== "wheel")
          throw new Error("performer-2's bluePlane must copy performer-1's (wheel)");
      },
    },
  },
  {
    id: "plane-blueplane-sameas-chain-of-three",
    utterance: "Performer 1 freely picks a blue-hand plane, performer 2 copies performer 1, performer 3 copies performer 2.",
    film: corpusFilm("plane-blueplane-sameas-chain-of-three", {
      performance: {
        cast: {
          count: 3,
          performers: [
            { id: "performer-1", bluePlane: { pick: "any" } },
            { id: "performer-2", bluePlane: { sameAs: "performer-1" } },
            { id: "performer-3", bluePlane: { sameAs: "performer-2" } },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const planes = spec.shots[0]!.performance.performers.map((p) => p.bluePlane);
        if (planes[0] !== planes[1] || planes[1] !== planes[2])
          throw new Error("the whole chain must resolve to the same bluePlane as performer 1");
      },
    },
  },
  {
    id: "plane-castdefaults-redplane-inherited",
    utterance: "Everyone's red hand defaults to the right-wing plane unless a performer says otherwise.",
    film: corpusFilm("plane-castdefaults-redplane-inherited", {
      performance: { cast: { count: 2, defaults: { redPlane: "right-wing" } } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.shots[0]!.performance.performers;
        if (performers.some((p) => p.redPlane !== "right-wing"))
          throw new Error("both performers must inherit the cast-default redPlane");
      },
    },
  },
  {
    id: "plane-stepplanes-literal-entry",
    utterance: "At step 3, this performer's blue hand moves to the forward-ramp plane.",
    film: corpusFilm("plane-stepplanes-literal-entry", {
      performance: {
        cast: {
          count: 1,
          performers: [{ id: "performer-1", stepPlanes: [{ step: 3, hand: "blue", plane: "forward-ramp" }] }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const stepPlanes = spec.shots[0]!.performance.performers[0]!.stepPlanes;
        if (JSON.stringify(stepPlanes) !== JSON.stringify([{ step: 3, hand: "blue", plane: "forward-ramp" }]))
          throw new Error("the literal stepPlanes entry must resolve unchanged");
      },
    },
  },
  {
    id: "plane-stepplanes-pickany-entry",
    utterance: "At step 5, let the red hand's plane be a free pick.",
    film: corpusFilm("plane-stepplanes-pickany-entry", {
      performance: {
        cast: {
          count: 1,
          performers: [{ id: "performer-1", stepPlanes: [{ step: 5, hand: "red", plane: { pick: "any" } }] }],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const entry = spec.shots[0]!.performance.performers[0]!.stepPlanes[0]!;
        if (entry.step !== 5 || entry.hand !== "red")
          throw new Error("stepPlanes entry must keep its step and hand");
        const catalog = [
          "wall",
          "wheel",
          "floor",
          "right-shield",
          "left-shield",
          "forward-ramp",
          "backward-ramp",
          "right-wing",
          "left-wing",
        ];
        if (!catalog.includes(entry.plane))
          throw new Error("the free-picked plane must be a real catalog member");
      },
    },
  },
  {
    id: "plane-stepplanes-oneof-entry",
    utterance: "At step 1, the blue hand's plane is either the floor or the wheel.",
    film: corpusFilm("plane-stepplanes-oneof-entry", {
      performance: {
        cast: {
          count: 1,
          performers: [
            { id: "performer-1", stepPlanes: [{ step: 1, hand: "blue", plane: { oneOf: ["floor", "wheel"] } }] },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const entry = spec.shots[0]!.performance.performers[0]!.stepPlanes[0]!;
        if (entry.plane !== "floor" && entry.plane !== "wheel")
          throw new Error("the stepPlanes plane must land on floor or wheel");
      },
    },
  },
  {
    id: "plane-stepplanes-multiple-entries-mixed",
    utterance: "This performer has three plane changes across the sequence: step 0 pinned to wall, step 2 a free pick, step 4 either floor or wheel.",
    film: corpusFilm("plane-stepplanes-multiple-entries-mixed", {
      performance: {
        cast: {
          count: 1,
          performers: [
            {
              id: "performer-1",
              stepPlanes: [
                { step: 0, hand: "blue", plane: "wall" },
                { step: 2, hand: "red", plane: { pick: "any" } },
                { step: 4, hand: "blue", plane: { oneOf: ["floor", "wheel"] } },
              ],
            },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const stepPlanes = spec.shots[0]!.performance.performers[0]!.stepPlanes;
        if (stepPlanes.length !== 3) throw new Error("all three stepPlanes entries must resolve");
        if (stepPlanes[0]!.plane !== "wall") throw new Error("step 0 must stay pinned to wall");
        if (stepPlanes[2]!.plane !== "floor" && stepPlanes[2]!.plane !== "wheel")
          throw new Error("step 4 must land on floor or wheel");
      },
    },
  },
  {
    id: "plane-visibleplanes-literal-list",
    utterance: "Show the wall, floor, and wheel planes in this scene.",
    film: corpusFilm("plane-visibleplanes-literal-list", {
      scene: { visiblePlanes: ["wall", "floor", "wheel"] },
      performance: { cast: { count: 1 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const visiblePlanes = spec.shots[0]!.scene.visiblePlanes;
        if (JSON.stringify(visiblePlanes) !== JSON.stringify(["wall", "floor", "wheel"]))
          throw new Error("visiblePlanes must resolve exactly as given");
      },
    },
  },
  {
    id: "plane-visibleplanes-empty-explicit",
    utterance: "No planes should be visible in this scene.",
    film: corpusFilm("plane-visibleplanes-empty-explicit", {
      scene: { visiblePlanes: [] },
      performance: { cast: { count: 1 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.shots[0]!.scene.visiblePlanes.length !== 0)
          throw new Error("an explicit empty visiblePlanes list must resolve empty");
      },
    },
  },
  {
    id: "plane-blueplane-plus-stepplanes-combined",
    utterance: "This performer's blue hand lives on the left-wing plane for the whole shot, except at step 1, where the red hand moves to the backward-ramp plane.",
    film: corpusFilm("plane-blueplane-plus-stepplanes-combined", {
      performance: {
        cast: {
          count: 1,
          performers: [
            {
              id: "performer-1",
              bluePlane: "left-wing",
              stepPlanes: [{ step: 1, hand: "red", plane: "backward-ramp" }],
            },
          ],
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performer = spec.shots[0]!.performance.performers[0]!;
        if (performer.bluePlane !== "left-wing") throw new Error("bluePlane must resolve to left-wing");
        if (JSON.stringify(performer.stepPlanes) !== JSON.stringify([{ step: 1, hand: "red", plane: "backward-ramp" }]))
          throw new Error("stepPlanes must resolve to the single backward-ramp entry");
      },
    },
  },
  {
    id: "plane-redplane-distinct-explicit-pool-sized-exactly",
    utterance: "Three performers, three different red-hand planes: floor, wheel, or forward-ramp — one each.",
    film: corpusFilm("plane-redplane-distinct-explicit-pool-sized-exactly", {
      performance: {
        cast: {
          count: 3,
          defaults: { redPlane: { pick: "distinct", from: ["floor", "wheel", "forward-ramp"] } },
        },
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const planes = spec.shots[0]!.performance.performers.map((p) => p.redPlane).sort();
        if (JSON.stringify(planes) !== JSON.stringify(["floor", "forward-ramp", "wheel"]))
          throw new Error("all three redPlane values from the pool must be used, exactly once each");
      },
    },
  },
  {
    id: "plane-default-wall-when-unspecified",
    utterance: "Two performers, nothing said about planes at all — confirm the defaults still hold.",
    film: corpusFilm("plane-default-wall-when-unspecified", {
      performance: { cast: { count: 2 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const performers = spec.shots[0]!.performance.performers;
        if (performers.some((p) => p.bluePlane !== "wall" || p.redPlane !== "wall"))
          throw new Error("unspecified bluePlane/redPlane must default to wall");
      },
    },
  },
  {
    id: "plane-blueplane-not-single-value",
    utterance: "This performer's blue hand must not be on the wall plane.",
    film: corpusFilm("plane-blueplane-not-single-value", {
      performance: { cast: { count: 1, performers: [{ bluePlane: { not: "wall" } }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const bluePlane = spec.shots[0]!.performance.performers[0]!.bluePlane;
        if (bluePlane === "wall") throw new Error("bluePlane must never resolve to wall");
      },
    },
  },
  {
    id: "plane-unknown-blueplane-literal-chainsaw",
    utterance: "Put this performer's blue hand on the chainsaw plane.",
    film: corpusFilm("plane-unknown-blueplane-literal-chainsaw", {
      performance: { cast: { count: 1, performers: [{ bluePlane: "chainsaw" }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown plane \\"chainsaw\\"' },
  },
  {
    id: "plane-unknown-redplane-inside-oneof",
    utterance: "This performer's red hand is either on the wall or the spiral plane.",
    film: corpusFilm("plane-unknown-redplane-inside-oneof", {
      performance: { cast: { count: 1, performers: [{ redPlane: { oneOf: ["wall", "spiral"] } }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'Unknown plane \\"spiral\\"' },
  },
  {
    id: "plane-distinct-narrowed-pool-too-small",
    utterance: "Four performers, four different red-hand planes, but only floor or wheel are on the table.",
    film: corpusFilm("plane-distinct-narrowed-pool-too-small", {
      performance: {
        cast: { count: 4, defaults: { redPlane: { pick: "distinct", from: ["floor", "wheel"] } } },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "only 2" },
  },
  {
    id: "plane-sameas-unknown-performer",
    utterance: "Performer 1's red hand should match performer 99's — there is no performer 99.",
    film: corpusFilm("plane-sameas-unknown-performer", {
      performance: {
        cast: { count: 2, performers: [{ id: "performer-1", redPlane: { sameAs: "performer-99" } }] },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "performer-99" },
  },
  {
    id: "plane-stepplanes-negative-step",
    utterance: "At step negative one, move the blue hand to the floor plane — that can't be right.",
    film: corpusFilm("plane-stepplanes-negative-step", {
      performance: {
        cast: {
          count: 1,
          performers: [{ id: "performer-1", stepPlanes: [{ step: -1, hand: "blue", plane: "floor" }] }],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=0" },
  },
  {
    id: "plane-stepplanes-bad-hand-value",
    utterance: "At step 2, move the green hand to the floor plane — there is no green hand.",
    film: corpusFilm("plane-stepplanes-bad-hand-value", {
      performance: {
        cast: {
          count: 1,
          performers: [{ id: "performer-1", stepPlanes: [{ step: 2, hand: "green", plane: "floor" }] }],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "Invalid option: expected one of" },
  },
  {
    id: "plane-visibleplanes-duplicate",
    utterance: "Show the floor plane, and also show the floor plane again.",
    film: corpusFilm("plane-visibleplanes-duplicate", {
      scene: { visiblePlanes: ["floor", "wheel", "floor"] },
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: 'scene.visiblePlanes lists \\"floor\\" twice.' },
  },
  {
    id: "plane-stepplanes-distinct-rejected",
    utterance: "At step 0, give the blue hand a plane distinct from everyone else's — that doesn't mean anything for one beat.",
    film: corpusFilm("plane-stepplanes-distinct-rejected", {
      performance: {
        cast: {
          count: 1,
          performers: [{ id: "performer-1", stepPlanes: [{ step: 0, hand: "blue", plane: { pick: "distinct" } }] }],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "distinct/sameAs are performer-scoped" },
  },
  {
    id: "plane-stepplanes-sameas-rejected",
    utterance: "At step 0, make the blue hand's plane copy performer 1's — inside a single step, that has no meaning.",
    film: corpusFilm("plane-stepplanes-sameas-rejected", {
      performance: {
        cast: {
          count: 1,
          performers: [
            { id: "performer-1", stepPlanes: [{ step: 0, hand: "blue", plane: { sameAs: "performer-1" } }] },
          ],
        },
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "distinct/sameAs are performer-scoped" },
  },
];
