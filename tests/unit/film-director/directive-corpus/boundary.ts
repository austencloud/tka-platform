import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";

// Numeric/array bounds here are plain zod `.min()`/`.max()` checks with no
// custom `error` callback, so the thrown ZodError's default message has no
// internal quotes to worry about JSON-escaping — "Too small: expected
// number to be >=20" and friends match verbatim inside String(error).

export const entries: CorpusEntry[] = [
  {
    id: "bpm-valid-at-lower-bound-20",
    utterance: "Set the tempo to 20 BPM — as slow as this is allowed to go.",
    film: corpusFilm("bpm-valid-at-lower-bound-20", {
      performance: { bpm: 20, cast: { count: 1 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.bpm !== 20) throw new Error("expected bpm 20 to pass through");
      },
    },
  },
  {
    id: "bpm-invalid-below-lower-bound-19",
    utterance: "Set the tempo to 19 BPM.",
    film: corpusFilm("bpm-invalid-below-lower-bound-19", {
      performance: { bpm: 19, cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=20" },
  },
  {
    id: "bpm-invalid-above-upper-bound-301",
    utterance: "Set the tempo to 301 BPM — blazing fast.",
    film: corpusFilm("bpm-invalid-above-upper-bound-301", {
      performance: { bpm: 301, cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=300" },
  },
  {
    id: "staff-length-valid-at-upper-bound-300",
    utterance: "Give this performer a 300 centimeter staff — the longest we stock.",
    film: corpusFilm("staff-length-valid-at-upper-bound-300", {
      performance: { cast: { count: 1, performers: [{ staffLengthCm: 300 }] } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers[0]!.staffLengthCm !== 300)
          throw new Error("expected staffLengthCm 300 to pass through");
      },
    },
  },
  {
    id: "staff-length-invalid-below-lower-bound-39",
    utterance: "Give this performer a 39 centimeter staff.",
    film: corpusFilm("staff-length-invalid-below-lower-bound-39", {
      performance: { cast: { count: 1, performers: [{ staffLengthCm: 39 }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=40" },
  },
  {
    id: "staff-length-invalid-above-upper-bound-301",
    utterance: "Give this performer a 301 centimeter staff.",
    film: corpusFilm("staff-length-invalid-above-upper-bound-301", {
      performance: { cast: { count: 1, performers: [{ staffLengthCm: 301 }] } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=300" },
  },
  {
    id: "cast-count-valid-at-upper-bound-8",
    utterance: "Cast eight performers — the biggest ensemble we run.",
    film: corpusFilm("cast-count-valid-at-upper-bound-8", {
      performance: { formation: "circle", cast: { count: 8 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers.length !== 8)
          throw new Error("expected 8 performers to resolve");
      },
    },
  },
  {
    id: "cast-count-zero",
    utterance: "Nobody in this one. Hold on the empty stage.",
    film: corpusFilm("cast-count-zero", {
      performance: { cast: { count: 0 } },
    }),
    // Gap 21. Zero was a rejection until round 2, when an empty stage became
    // a shot a director can actually ask for.
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers.length !== 0)
          throw new Error("expected an empty cast to resolve");
      },
    },
  },
  {
    id: "cast-count-invalid-nine-via-schema",
    utterance: "Cast nine performers for this scene.",
    film: corpusFilm("cast-count-invalid-nine-via-schema", {
      performance: { cast: { count: 9 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=8" },
  },
  {
    id: "performers-array-valid-at-upper-bound-8",
    utterance: "Name eight performers explicitly for this scene.",
    film: corpusFilm("performers-array-valid-at-upper-bound-8", {
      performance: {
        formation: "circle",
        performers: Array.from({ length: 8 }, (_, i) => ({ id: `performer-${i + 1}` })),
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.performance.performers.length !== 8)
          throw new Error("expected 8 named performers to resolve");
      },
    },
  },
  {
    id: "performers-array-invalid-nine",
    utterance: "Name nine performers explicitly for this scene.",
    film: corpusFilm("performers-array-invalid-nine", {
      performance: {
        performers: Array.from({ length: 9 }, (_, i) => ({ id: `performer-${i + 1}` })),
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected array to have <=8 items" },
  },
  {
    id: "format-width-valid-at-lower-bound-640",
    utterance: "Render this at 640 pixels wide — as small as we go.",
    film: corpusFilm(
      "format-width-valid-at-lower-bound-640",
      { performance: { cast: { count: 1 } } },
      { format: { width: 640 } }
    ),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.format.width !== 640) throw new Error("expected format.width 640 to pass through");
      },
    },
  },
  {
    id: "format-width-invalid-below-639",
    utterance: "Render this at 639 pixels wide.",
    film: corpusFilm(
      "format-width-invalid-below-639",
      { performance: { cast: { count: 1 } } },
      { format: { width: 639 } }
    ),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=640" },
  },
  {
    id: "format-width-invalid-above-7681",
    utterance: "Render this at 7681 pixels wide.",
    film: corpusFilm(
      "format-width-invalid-above-7681",
      { performance: { cast: { count: 1 } } },
      { format: { width: 7681 } }
    ),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=7680" },
  },
  {
    id: "format-height-valid-at-upper-bound-4320",
    utterance: "Render this at 4320 pixels tall — full 8K height.",
    film: corpusFilm(
      "format-height-valid-at-upper-bound-4320",
      { performance: { cast: { count: 1 } } },
      { format: { height: 4320 } }
    ),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.format.height !== 4320) throw new Error("expected format.height 4320 to pass through");
      },
    },
  },
  {
    id: "format-height-invalid-below-359",
    utterance: "Render this at 359 pixels tall.",
    film: corpusFilm(
      "format-height-invalid-below-359",
      { performance: { cast: { count: 1 } } },
      { format: { height: 359 } }
    ),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=360" },
  },
  {
    id: "format-height-invalid-above-4321",
    utterance: "Render this at 4321 pixels tall.",
    film: corpusFilm(
      "format-height-invalid-above-4321",
      { performance: { cast: { count: 1 } } },
      { format: { height: 4321 } }
    ),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=4320" },
  },
  {
    id: "format-fps-valid-at-lower-bound-24",
    utterance: "Render this at 24 frames per second — cinema standard.",
    film: corpusFilm(
      "format-fps-valid-at-lower-bound-24",
      { performance: { cast: { count: 1 } } },
      { format: { fps: 24 } }
    ),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.format.fps !== 24) throw new Error("expected format.fps 24 to pass through");
      },
    },
  },
  {
    id: "format-fps-invalid-below-23",
    utterance: "Render this at 23 frames per second.",
    film: corpusFilm(
      "format-fps-invalid-below-23",
      { performance: { cast: { count: 1 } } },
      { format: { fps: 23 } }
    ),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=24" },
  },
  {
    id: "format-fps-invalid-above-121",
    utterance: "Render this at 121 frames per second.",
    film: corpusFilm(
      "format-fps-invalid-above-121",
      { performance: { cast: { count: 1 } } },
      { format: { fps: 121 } }
    ),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=120" },
  },
  {
    id: "camera-moves-valid-at-upper-bound-16",
    utterance: "Chain sixteen holds together for this scene — the most moves we allow.",
    film: corpusFilm("camera-moves-valid-at-upper-bound-16", {
      performance: { cast: { count: 1 } },
      camera: { moves: Array.from({ length: 16 }, () => ({ move: "hold" as const })) },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.camera.keyframes.length < 16)
          throw new Error("expected at least one keyframe per chained hold");
      },
    },
  },
  {
    id: "camera-moves-invalid-empty-array",
    utterance: "Give this scene an empty list of camera moves.",
    film: corpusFilm("camera-moves-invalid-empty-array", {
      performance: { cast: { count: 1 } },
      camera: { moves: [] },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected array to have >=1 items" },
  },
  {
    id: "camera-moves-invalid-seventeen",
    utterance: "Chain seventeen holds together for this scene.",
    film: corpusFilm("camera-moves-invalid-seventeen", {
      performance: { cast: { count: 1 } },
      camera: { moves: Array.from({ length: 17 }, () => ({ move: "hold" as const })) },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected array to have <=16 items" },
  },
  {
    id: "camera-keyframes-valid-at-upper-bound-32",
    utterance: "Hand-place thirty-two camera keyframes across this scene.",
    film: corpusFilm("camera-keyframes-valid-at-upper-bound-32", {
      durationSeconds: 60,
      performance: { cast: { count: 1 } },
      camera: {
        keyframes: Array.from({ length: 32 }, (_, i) => ({
          atSeconds: i * 1.8,
          position: [0, 1.6, -3 - i * 0.1] as [number, number, number],
        })),
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.camera.keyframes.length !== 32)
          throw new Error("expected all 32 supplied keyframes to pass through");
      },
    },
  },
  {
    id: "camera-keyframes-invalid-empty-array",
    utterance: "Give this scene an empty list of camera keyframes.",
    film: corpusFilm("camera-keyframes-invalid-empty-array", {
      performance: { cast: { count: 1 } },
      camera: { keyframes: [] },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected array to have >=1 items" },
  },
  {
    id: "camera-keyframes-invalid-thirty-three",
    utterance: "Hand-place thirty-three camera keyframes across this scene.",
    film: corpusFilm("camera-keyframes-invalid-thirty-three", {
      durationSeconds: 60,
      performance: { cast: { count: 1 } },
      camera: {
        keyframes: Array.from({ length: 33 }, (_, i) => ({
          atSeconds: i * 1.8,
          position: [0, 1.6, -3] as [number, number, number],
        })),
      },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected array to have <=32 items" },
  },
  {
    id: "scene-duration-valid-at-upper-bound-60",
    utterance: "Make this scene the full sixty seconds — as long as a single scene goes.",
    film: corpusFilm("scene-duration-valid-at-upper-bound-60", {
      durationSeconds: 60,
      performance: { cast: { count: 1 } },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[0]!.durationSeconds !== 60)
          throw new Error("expected scene durationSeconds 60 to pass through");
      },
    },
  },
  {
    id: "scene-duration-invalid-zero",
    utterance: "Make this scene zero seconds long.",
    film: corpusFilm("scene-duration-invalid-zero", {
      durationSeconds: 0,
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=1" },
  },
  {
    id: "scene-duration-invalid-sixty-one",
    utterance: "Make this scene sixty-one seconds long.",
    film: corpusFilm("scene-duration-invalid-sixty-one", {
      durationSeconds: 61,
      performance: { cast: { count: 1 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=60" },
  },
  {
    id: "orbit-degrees-valid-at-upper-bound-720",
    utterance: "Orbit the group a full two turns — 720 degrees.",
    film: corpusFilm("orbit-degrees-valid-at-upper-bound-720", {
      performance: { cast: { count: 1 } },
      camera: { preset: "group-orbit", orbitDegrees: 720 },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "orbit-degrees-valid-at-lower-bound-negative-720",
    utterance: "Orbit the group a full two turns the other way — negative 720 degrees.",
    film: corpusFilm("orbit-degrees-valid-at-lower-bound-negative-720", {
      performance: { cast: { count: 1 } },
      camera: { preset: "group-orbit", orbitDegrees: -720 },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "orbit-degrees-invalid-above-721",
    utterance: "Orbit the group 721 degrees.",
    film: corpusFilm("orbit-degrees-invalid-above-721", {
      performance: { cast: { count: 1 } },
      camera: { preset: "group-orbit", orbitDegrees: 721 },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=720" },
  },
  {
    id: "vantage-degrees-valid-at-upper-bound-360",
    utterance: "Set the camera at exactly 360 degrees around the group.",
    film: corpusFilm("vantage-degrees-valid-at-upper-bound-360", {
      performance: { cast: { count: 1 } },
      camera: { position: { degrees: 360 } },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "vantage-degrees-invalid-above-361",
    utterance: "Set the camera at 361 degrees around the group.",
    film: corpusFilm("vantage-degrees-invalid-above-361", {
      performance: { cast: { count: 1 } },
      camera: { position: { degrees: 361 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=360" },
  },
  {
    id: "vantage-degrees-invalid-below-negative-361",
    utterance: "Set the camera at negative 361 degrees around the group.",
    film: corpusFilm("vantage-degrees-invalid-below-negative-361", {
      performance: { cast: { count: 1 } },
      camera: { position: { degrees: -361 } },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=-360" },
  },
  {
    id: "keyframe-fov-valid-at-lower-bound-20",
    utterance: "Set the keyframe's field of view to 20 degrees — as tight as it goes.",
    film: corpusFilm("keyframe-fov-valid-at-lower-bound-20", {
      performance: { cast: { count: 1 } },
      camera: { keyframes: [{ atSeconds: 0, position: [0, 1, 2], fovDeg: 20 }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "keyframe-fov-invalid-below-19",
    utterance: "Set the keyframe's field of view to 19 degrees.",
    film: corpusFilm("keyframe-fov-invalid-below-19", {
      performance: { cast: { count: 1 } },
      camera: { keyframes: [{ atSeconds: 0, position: [0, 1, 2], fovDeg: 19 }] },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too small: expected number to be >=20" },
  },
  {
    id: "keyframe-fov-invalid-above-101",
    utterance: "Set the keyframe's field of view to 101 degrees.",
    film: corpusFilm("keyframe-fov-invalid-above-101", {
      performance: { cast: { count: 1 } },
      camera: { keyframes: [{ atSeconds: 0, position: [0, 1, 2], fovDeg: 101 }] },
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=100" },
  },
  {
    id: "transition-duration-valid-at-upper-bound-3",
    utterance: "Fade through black for a full three seconds between scenes.",
    film: corpusFilm("transition-duration-valid-at-upper-bound-3", {}, {
      scenes: [
        { id: "s1", title: "S1", performance: { cast: { count: 1 } } },
        {
          id: "s2",
          title: "S2",
          transition: { kind: "fade-through-black", durationSeconds: 3 },
          performance: { cast: { count: 1 } },
        },
      ],
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes[1]!.transition.durationSeconds !== 3)
          throw new Error("expected transition durationSeconds 3 to pass through");
      },
    },
  },
  {
    id: "transition-duration-invalid-above-4",
    utterance: "Fade through black for four seconds between scenes.",
    film: corpusFilm("transition-duration-invalid-above-4", {}, {
      scenes: [
        { id: "s1", title: "S1", performance: { cast: { count: 1 } } },
        {
          id: "s2",
          title: "S2",
          transition: { kind: "fade-through-black", durationSeconds: 4 },
          performance: { cast: { count: 1 } },
        },
      ],
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected number to be <=3" },
  },
  {
    id: "scenes-array-valid-at-upper-bound-24",
    utterance: "Cut this into twenty-four scenes — as many as a single film allows.",
    film: corpusFilm("scenes-array-valid-at-upper-bound-24", {}, {
      scenes: Array.from({ length: 24 }, (_, i) => ({
        id: `s${i}`,
        title: `S${i}`,
        performance: { cast: { count: 1 } },
      })),
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.scenes.length !== 24) throw new Error("expected all 24 scenes to resolve");
      },
    },
  },
  {
    id: "scenes-array-invalid-twenty-five",
    utterance: "Cut this into twenty-five scenes.",
    film: corpusFilm("scenes-array-invalid-twenty-five", {}, {
      scenes: Array.from({ length: 25 }, (_, i) => ({
        id: `s${i}`,
        title: `S${i}`,
        performance: { cast: { count: 1 } },
      })),
    }),
    expect: { outcome: "rejects", messageIncludes: "Too big: expected array to have <=24 items" },
  },
];
