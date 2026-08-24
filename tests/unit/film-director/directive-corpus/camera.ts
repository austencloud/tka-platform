import type { CorpusEntry } from "./_types";
import { corpusFilm } from "./_helpers";

// Schema-level `.refine()` rejections (exclusivity checks in
// film-director-schema.ts) throw as a ZodError, so `String(error)` is that
// error's JSON-stringified issue list. Where the refine's own message
// contains a literal `"` (e.g. the subject/target message quotes the field
// names), that quote shows up JSON-escaped as `\"` in the thrown text — the
// same reason nonexistent.ts escapes its messageIncludes strings. Runtime
// `throw new Error(...)` messages (camera-language.ts, director-camera-
// track.ts) are plain text and need no escaping.

export const entries: CorpusEntry[] = [
  {
    id: "camera-hold-full-shot",
    utterance: "Just hold the camera steady for the whole shot.",
    film: corpusFilm("camera-hold-full-shot", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "hold" }] },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const frames = spec.shots[0]!.camera.keyframes;
        if (frames.length !== 2) throw new Error("expected a two-frame hold spanning the shot");
        if (JSON.stringify(frames[0]!.position) !== JSON.stringify(frames[1]!.position))
          throw new Error("a hold must not move the camera");
      },
    },
  },
  {
    id: "camera-push-in-explicit-meters",
    utterance: "Push in two meters on the group.",
    film: corpusFilm("camera-push-in-explicit-meters", {
      performance: { cast: { count: 2 } },
      camera: { moves: [{ move: "push-in", amount: { meters: 2 } }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-pull-back-explicit-meters",
    utterance: "Pull back a meter and a half to open up the frame.",
    film: corpusFilm("camera-pull-back-explicit-meters", {
      performance: { cast: { count: 2 } },
      camera: { moves: [{ move: "pull-back", amount: { meters: 1.5 } }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-orbit-clockwise-180",
    utterance: "Orbit clockwise 180 degrees around the group.",
    film: corpusFilm("camera-orbit-clockwise-180", {
      performance: { cast: { count: 3 } },
      camera: { moves: [{ move: "orbit", direction: "cw", amount: { degrees: 180 } }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-orbit-counterclockwise-default-amount",
    utterance: "Orbit counterclockwise around the group.",
    film: corpusFilm("camera-orbit-counterclockwise-default-amount", {
      performance: { cast: { count: 3 } },
      camera: { moves: [{ move: "orbit", direction: "ccw" }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-crane-up-one-meter",
    utterance: "Crane up one meter over the course of the shot.",
    film: corpusFilm("camera-crane-up-one-meter", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "crane", direction: "up", amount: { meters: 1 } }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-crane-down-default-amount",
    utterance: "Crane down to ground level.",
    film: corpusFilm("camera-crane-down-default-amount", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "crane", direction: "down" }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-pan-left-45",
    utterance: "Pan left 45 degrees to reveal the rest of the stage.",
    film: corpusFilm("camera-pan-left-45", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "pan", direction: "left", amount: { degrees: 45 } }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-pan-right-default-amount",
    utterance: "Pan right to follow the exit.",
    film: corpusFilm("camera-pan-right-default-amount", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "pan", direction: "right" }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-chained-push-in-then-orbit",
    utterance: "Push in for two seconds, then orbit clockwise 90 degrees for three seconds.",
    film: corpusFilm("camera-chained-push-in-then-orbit", {
      durationSeconds: 8,
      performance: { cast: { count: 2 } },
      camera: {
        moves: [
          { move: "push-in", amount: { meters: 1 }, durationSeconds: 2 },
          { move: "orbit", direction: "cw", amount: { degrees: 90 }, durationSeconds: 3 },
        ],
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        const frames = spec.shots[0]!.camera.keyframes;
        if (frames.length < 3) throw new Error("expected a multi-frame chain from two moves");
      },
    },
  },
  {
    id: "camera-close-up-on-named-performer",
    utterance: "Give me a close-up on performer 1.",
    film: corpusFilm("camera-close-up-on-named-performer", {
      performance: { cast: { count: 1 } },
      camera: { subject: { kind: "performer", performerId: "performer-1" }, shotSize: "close-up" },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-high-angle-wide-shot",
    utterance: "High angle, wide shot of the whole group.",
    film: corpusFilm("camera-high-angle-wide-shot", {
      performance: { cast: { count: 4 } },
      camera: { angle: "high", shotSize: "wide" },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-vantage-from-the-left",
    utterance: "Shoot this from camera left.",
    film: corpusFilm("camera-vantage-from-the-left", {
      performance: { cast: { count: 2 } },
      camera: { position: "left" },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-vantage-135-degrees",
    utterance: "Set the camera at 135 degrees around the group.",
    film: corpusFilm("camera-vantage-135-degrees", {
      performance: { cast: { count: 2 } },
      camera: { position: { degrees: 135 } },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-subject-group-explicit",
    utterance: "Keep the whole group in frame.",
    film: corpusFilm("camera-subject-group-explicit", {
      performance: { cast: { count: 3 } },
      camera: { subject: { kind: "group" }, shotSize: "wide" },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-subject-fixed-point",
    utterance: "Aim the camera at a fixed point downstage center.",
    film: corpusFilm("camera-subject-fixed-point", {
      performance: { cast: { count: 2 } },
      camera: { subject: { kind: "point", position: [0, 1, 2] } },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-preset-front-lockoff",
    utterance: "Lock the camera off, front on.",
    film: corpusFilm("camera-preset-front-lockoff", {
      performance: { cast: { count: 2 } },
      camera: { preset: "front-lockoff" },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.shots[0]!.camera.keyframes.length !== 1)
          throw new Error("front-lockoff should produce a single static keyframe");
      },
    },
  },
  {
    id: "camera-preset-hero-dolly-in",
    utterance: "Give this shot a hero dolly-in.",
    film: corpusFilm("camera-preset-hero-dolly-in", {
      performance: { cast: { count: 1 } },
      camera: { preset: "hero-dolly-in" },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.shots[0]!.camera.keyframes.length !== 2)
          throw new Error("hero-dolly-in should produce two keyframes");
      },
    },
  },
  {
    id: "camera-preset-high-reveal",
    utterance: "Open on a high reveal shot.",
    film: corpusFilm("camera-preset-high-reveal", {
      performance: { cast: { count: 4 } },
      camera: { preset: "high-reveal" },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-preset-group-orbit-custom-degrees",
    utterance: "Orbit the whole group 180 degrees for this shot.",
    film: corpusFilm("camera-preset-group-orbit-custom-degrees", {
      performance: { cast: { count: 6 } },
      camera: { preset: "group-orbit", orbitDegrees: 180 },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-preset-custom-with-one-keyframe",
    utterance: "Custom camera move: start right here.",
    film: corpusFilm("camera-preset-custom-with-one-keyframe", {
      performance: { cast: { count: 1 } },
      camera: { preset: "custom", keyframes: [{ atSeconds: 0, position: [0, 1.6, -3] }] },
    }),
    expect: { outcome: "resolves" },
  },
  {
    id: "camera-target-performer-with-keyframes",
    utterance: "Keep the camera pointed at performer 1 while it holds at this position.",
    film: corpusFilm("camera-target-performer-with-keyframes", {
      performance: { cast: { count: 1 } },
      camera: {
        target: { kind: "performer", performerId: "performer-1" },
        keyframes: [{ atSeconds: 0, position: [0, 1.6, -3] }],
      },
    }),
    expect: {
      outcome: "resolves",
      assert: (spec) => {
        if (spec.shots[0]!.camera.keyframes.length !== 1)
          throw new Error("expected the single supplied keyframe to pass through");
      },
    },
  },
  {
    id: "camera-orbit-invalid-direction-up",
    utterance: "Orbit the camera upward.",
    film: corpusFilm("camera-orbit-invalid-direction-up", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "orbit", direction: "up" }] },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: '"orbit" direction must be one of cw/ccw, got "up"',
    },
  },
  {
    id: "camera-push-in-wrong-unit-degrees",
    utterance: "Push in 10 degrees.",
    film: corpusFilm("camera-push-in-wrong-unit-degrees", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "push-in", amount: { degrees: 10 } }] },
    }),
    expect: { outcome: "rejects", messageIncludes: '"push-in" takes meters, not degrees' },
  },
  {
    id: "camera-hold-rejects-amount",
    utterance: "Hold the camera, moving in three meters.",
    film: corpusFilm("camera-hold-rejects-amount", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "hold", amount: { meters: 3 } }] },
    }),
    expect: { outcome: "rejects", messageIncludes: '"hold" does not take an amount' },
  },
  {
    id: "camera-hold-rejects-direction",
    utterance: "Hold the camera, panning clockwise.",
    film: corpusFilm("camera-hold-rejects-direction", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "hold", direction: "cw" }] },
    }),
    expect: { outcome: "rejects", messageIncludes: '"hold" does not take a direction' },
  },
  {
    id: "camera-pan-wrong-direction-up",
    utterance: "Pan the camera up.",
    film: corpusFilm("camera-pan-wrong-direction-up", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "pan", direction: "up" }] },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: '"pan" direction must be one of left/right, got "up"',
    },
  },
  {
    id: "camera-crane-wrong-direction-cw",
    utterance: "Crane the camera clockwise.",
    film: corpusFilm("camera-crane-wrong-direction-cw", {
      performance: { cast: { count: 1 } },
      camera: { moves: [{ move: "crane", direction: "cw" }] },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: '"crane" direction must be one of up/down, got "cw"',
    },
  },
  {
    id: "camera-moves-exceed-shot-duration",
    utterance: "Hold for three seconds, then push in for three more — on a four-second shot.",
    film: corpusFilm("camera-moves-exceed-shot-duration", {
      durationSeconds: 4,
      performance: { cast: { count: 1 } },
      camera: {
        moves: [
          { move: "hold", durationSeconds: 3 },
          { move: "push-in", amount: { meters: 1 }, durationSeconds: 3 },
        ],
      },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "Camera moves total 6s but the shot's duration is 4s",
    },
  },
  {
    id: "camera-keyframes-and-shotsize-exclusive",
    utterance: "Use raw keyframes, but also make it a wide shot.",
    film: corpusFilm("camera-keyframes-and-shotsize-exclusive", {
      performance: { cast: { count: 1 } },
      camera: { shotSize: "wide", keyframes: [{ atSeconds: 0, position: [0, 1, 2] }] },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "Raw keyframes and framing grammar are exclusive — use one.",
    },
  },
  {
    id: "camera-preset-and-shotsize-exclusive",
    utterance: "Use the hero dolly-in preset, but also make it a wide shot.",
    film: corpusFilm("camera-preset-and-shotsize-exclusive", {
      performance: { cast: { count: 1 } },
      camera: { preset: "hero-dolly-in", shotSize: "wide" },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "A preset and framing grammar are exclusive — use one.",
    },
  },
  {
    id: "camera-subject-and-target-exclusive",
    utterance: "Frame on the group as the subject, but also set the group as the target.",
    film: corpusFilm("camera-subject-and-target-exclusive", {
      performance: { cast: { count: 1 } },
      camera: { subject: { kind: "group" }, target: { kind: "group" } },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: 'Use \\"subject\\" with framing grammar, \\"target\\" with presets/keyframes.',
    },
  },
  {
    id: "camera-custom-preset-without-keyframes",
    utterance: "Use a fully custom camera move — I'll add the keyframes later.",
    film: corpusFilm("camera-custom-preset-without-keyframes", {
      performance: { cast: { count: 1 } },
      camera: { preset: "custom" },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "A custom camera needs at least one keyframe",
    },
  },
  {
    id: "camera-subject-references-missing-performer",
    utterance: "Frame on performer 99.",
    film: corpusFilm("camera-subject-references-missing-performer", {
      performance: { cast: { count: 2 } },
      camera: { subject: { kind: "performer", performerId: "performer-99" }, shotSize: "medium" },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: 'Camera subject references missing performer "performer-99"',
    },
  },
  {
    id: "camera-target-references-missing-performer",
    utterance: "Point the camera at performer 42 for these keyframes.",
    film: corpusFilm("camera-target-references-missing-performer", {
      performance: { cast: { count: 2 } },
      camera: {
        target: { kind: "performer", performerId: "performer-42" },
        keyframes: [{ atSeconds: 0, position: [0, 1, 2] }],
      },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: 'Camera target references missing performer "performer-42"',
    },
  },
  {
    id: "camera-keyframes-must-start-at-zero",
    utterance: "Start the camera keyframes one second in.",
    film: corpusFilm("camera-keyframes-must-start-at-zero", {
      performance: { cast: { count: 1 } },
      camera: { keyframes: [{ atSeconds: 1, position: [0, 1, 2] }] },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "The first camera keyframe must start at 0 seconds.",
    },
  },
  {
    id: "camera-keyframe-past-shot-end",
    utterance: "Add a keyframe at nine seconds on a five-second shot.",
    film: corpusFilm("camera-keyframe-past-shot-end", {
      durationSeconds: 5,
      performance: { cast: { count: 1 } },
      camera: {
        keyframes: [
          { atSeconds: 0, position: [0, 1, 2] },
          { atSeconds: 9, position: [1, 1, 1] },
        ],
      },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "A camera keyframe falls after the shot has ended.",
    },
  },
  {
    id: "camera-keyframes-duplicate-times",
    utterance: "Two keyframes, both landing at the three-second mark.",
    film: corpusFilm("camera-keyframes-duplicate-times", {
      performance: { cast: { count: 1 } },
      camera: {
        keyframes: [
          { atSeconds: 0, position: [0, 1, 2] },
          { atSeconds: 3, position: [1, 1, 1] },
          { atSeconds: 3, position: [2, 2, 2] },
        ],
      },
    }),
    expect: {
      outcome: "rejects",
      messageIncludes: "Camera keyframes cannot share the same time.",
    },
  },
];
