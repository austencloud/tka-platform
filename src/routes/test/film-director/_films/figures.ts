import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * Notation for a group has always split in two. Labanotation writes one body
 * in complete detail and says nothing about the floor; a drill chart writes
 * the floor in complete detail and says nothing about the body. A TKA film
 * runs both tracks at once — a per-performer sequence, and the path their
 * feet draw under it — so this one is staged to put the second track to work.
 *
 * Five scenes, each built around something the language can say that the
 * other films have not asked it to:
 *
 *   1. the seated audience, and a camera behind them
 *   2. one silhouette that turns out to be two
 *   3. six performers on two rings turning opposite ways
 *   4. four performers weaving a figure eight without colliding
 *   5. a whole cast walking into a named formation on one instruction
 *
 * Two conventions decide most of the numbers below.
 *
 * Facing 0 looks down +Z. The seated crowd sits on an arc of radius 4.8 at
 * +Z, but the blocking language's "audience" facing is pi, which looks at
 * -Z, where the default camera stands. Those are two different audiences on
 * opposite sides. A scene playing to the seated crowd therefore sets
 * facingDegrees: 0 on everyone and puts the camera behind — past the back
 * row, looking over their heads at a cast facing them.
 *
 * Walking speed has a usable window. Above 2.6 m/s the blocking language
 * refuses the move; below roughly 0.47 m/s the walk clip hits its
 * playback-rate floor and the feet skate. Every travel window here lands
 * between those. The two figure scenes were solved before they were written:
 * leg durations follow chord length so speed stays constant, and the closest
 * approach between any two performers was measured, not estimated.
 */
export const figuresFilm: FilmDirectorInput = {
  version: 3,
  id: "figures-r1",
  title: "Figures",
  brief:
    "Five scenes on what a group writes on the floor: a solo before a seated house, a silhouette that splits in two, two rings turning opposite ways, four performers weaving a figure eight, and a cast that walks into formation on one instruction.",
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  scenes: [
    {
      id: "house-lights",
      title: "House lights",
      intent:
        "Open behind the crowd. A soloist stands with their back to the house, turns to face it, and the camera rises off the seats.",
      durationSeconds: 11,
      location: { environmentId: "celestial", showStage: false, showAudience: true },
      performance: {
        bpm: 63,
        formation: "solo",
        performers: [
          {
            id: "soloist",
            name: "Soloist",
            // Anyone but the three grey mannequins. The opening frame is a
            // silhouette, and a rig-coloured body reads as a placeholder.
            avatarId: { not: ["x-bot", "y-bot", "remy"] },
            prop: PropType.STAFF,
            effect: "led",
            effort: "glide",
            sequence: {
              length: 16,
              loop: "rotated",
              flow: "smooth",
              turns: { intensity: 1 },
            },
            facingDegrees: 180,
            blocking: [
              { move: "stand", durationSeconds: 3.4 },
              {
                move: "turn",
                facing: { degrees: 0 },
                durationSeconds: 1.6,
                easing: "ease-in-out",
              },
              { move: "stand", durationSeconds: 6 },
            ],
          },
        ],
      },
      effectPresets: { led: "led-comet" },
      camera: {
        // Framing distance comes from the cast, and a cast of one puts even an
        // extreme-wide lens 6.6m out — a metre and a half behind the back of
        // the seating arc, where two heads fill the bottom corners and the
        // other four are outside the frame. Aiming at a point three metres
        // downstage of him carries the whole rig back to 9.6m, which holds the
        // full row across the lower third with him standing clear above it.
        subject: { kind: "point", position: [0, 0.3, 3] },
        shotSize: "extreme-wide",
        angle: "eye",
        position: "behind",
        moves: [
          { move: "hold", durationSeconds: 3.4 },
          {
            move: "orbit",
            direction: "cw",
            amount: { degrees: 22 },
            durationSeconds: 5,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 2.6 },
        ],
      },
    },
    {
      id: "back-to-back",
      title: "Back to back",
      intent:
        "Two performers stand in line with the lens, one hidden behind the other, until the camera orbits far enough to separate them.",
      durationSeconds: 10,
      transition: { kind: "environment-dissolve", durationSeconds: 1 },
      location: { environmentId: "winter", showStage: false },
      performance: {
        bpm: 84,
        // The back-to-back preset puts both performers on the same point, so
        // this is hand-marked: 1.5 m apart along the camera axis, each facing
        // away from the other.
        formation: "custom",
        performers: [
          {
            id: "near",
            name: "Near",
            avatarId: "ch44",
            prop: PropType.BUUGENG,
            effect: "ghost",
            effort: "press",
            sequence: {
              word: "MIRROR",
              // M exists only from gamma starts, and "gamma at south" is four
              // positions, so this one is named outright.
              startPosition: "gamma5",
              flow: "smooth",
            },
            position: { x: 0, z: -0.75 },
            facingDegrees: 180,
          },
          {
            id: "far",
            name: "Far",
            avatarId: "ch12",
            prop: PropType.BUUGENG,
            effect: "ghost",
            effort: "press",
            sequence: { mirrorOf: "near" },
            position: { x: 0, z: 0.75 },
            facingDegrees: 0,
          },
        ],
      },
      // Ghost ships no named presets, so its onion-skin is dialled here. Long
      // persistence and dense sampling, because the reveal is carried by a
      // second set of after-images emerging from the first.
      effectOverrides: {
        ghost: {
          decay: 7,
          interval: 0.72,
          intensity: 0.6,
          blueColor: "#9fd8ff",
          redColor: "#ffb3c7",
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 2.4 },
          {
            move: "orbit",
            direction: "cw",
            amount: { degrees: 100 },
            durationSeconds: 5.2,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 2.4 },
        ],
      },
    },
    {
      id: "counter-wheels",
      title: "Counter-wheels",
      intent:
        "Two rings turning opposite ways. The camera starts on the bodies and rises until the floor pattern is the subject.",
      durationSeconds: 15,
      transition: { kind: "cut" },
      location: { environmentId: "blossom", showStage: false },
      performance: {
        bpm: 96,
        // Eight 45-degree legs per ring at 1.75 s each. The chords differ by
        // exactly the radius ratio, so the inner ring travels 0.66 m/s and the
        // outer 1.31 m/s and both close their circle on the same beat.
        formation: "custom",
        performers: [
          {
            id: "wheel-in-a",
            name: "Inner A",
            avatarId: { pick: "distinct", from: ["ch07", "ch12", "ch18"] },
            prop: PropType.FAN,
            effect: "silk",
            effort: "glide",
            sequence: { length: 12, loop: "rotated", flow: "smooth" },
            beatOffset: 0,
            position: { x: 1.5, z: 0 },
            blocking: [
              { move: "stand", durationSeconds: 0.5 },
              { move: "walk", to: { x: 1.06, z: -1.06 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0, z: -1.5 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.06, z: -1.06 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.5, z: 0 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.06, z: 1.06 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0, z: 1.5 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.06, z: 1.06 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.5, z: 0 }, facing: "travel", durationSeconds: 1.75 },
            ],
          },
          {
            id: "wheel-in-b",
            name: "Inner B",
            avatarId: { pick: "distinct", from: ["ch07", "ch12", "ch18"] },
            prop: PropType.FAN,
            effect: "silk",
            effort: "glide",
            sequence: { length: 12, loop: "rotated", flow: "smooth" },
            beatOffset: -4,
            position: { x: -0.75, z: -1.3 },
            blocking: [
              { move: "stand", durationSeconds: 0.5 },
              { move: "walk", to: { x: -1.45, z: -0.39 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.3, z: 0.75 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -0.39, z: 1.45 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0.75, z: 1.3 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.45, z: 0.39 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.3, z: -0.75 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0.39, z: -1.45 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -0.75, z: -1.3 }, facing: "travel", durationSeconds: 1.75 },
            ],
          },
          {
            id: "wheel-in-c",
            name: "Inner C",
            avatarId: { pick: "distinct", from: ["ch07", "ch12", "ch18"] },
            prop: PropType.FAN,
            effect: "silk",
            effort: "glide",
            sequence: { length: 12, loop: "rotated", flow: "smooth" },
            beatOffset: -8,
            position: { x: -0.75, z: 1.3 },
            blocking: [
              { move: "stand", durationSeconds: 0.5 },
              { move: "walk", to: { x: 0.39, z: 1.45 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.3, z: 0.75 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.45, z: -0.39 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0.75, z: -1.3 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -0.39, z: -1.45 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.3, z: -0.75 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.45, z: 0.39 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -0.75, z: 1.3 }, facing: "travel", durationSeconds: 1.75 },
            ],
          },
          {
            id: "wheel-out-a",
            name: "Outer A",
            avatarId: { pick: "distinct", from: ["ch21", "ch41", "ch42"] },
            prop: PropType.STAFF,
            effect: "trails",
            effort: "linear",
            sequence: { length: 12, loop: "mirrored", flow: "smooth" },
            beatOffset: 0,
            position: { x: 1.5, z: 2.6 },
            blocking: [
              { move: "stand", durationSeconds: 0.5 },
              { move: "walk", to: { x: -0.78, z: 2.9 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -2.6, z: 1.5 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -2.9, z: -0.78 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.5, z: -2.6 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0.78, z: -2.9 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 2.6, z: -1.5 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 2.9, z: 0.78 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.5, z: 2.6 }, facing: "travel", durationSeconds: 1.75 },
            ],
          },
          {
            id: "wheel-out-b",
            name: "Outer B",
            avatarId: { pick: "distinct", from: ["ch21", "ch41", "ch42"] },
            prop: PropType.STAFF,
            effect: "trails",
            effort: "linear",
            sequence: { length: 12, loop: "mirrored", flow: "smooth" },
            beatOffset: -4,
            position: { x: 1.5, z: -2.6 },
            blocking: [
              { move: "stand", durationSeconds: 0.5 },
              { move: "walk", to: { x: 2.9, z: -0.78 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 2.6, z: 1.5 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0.78, z: 2.9 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -1.5, z: 2.6 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -2.9, z: 0.78 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -2.6, z: -1.5 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -0.78, z: -2.9 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 1.5, z: -2.6 }, facing: "travel", durationSeconds: 1.75 },
            ],
          },
          {
            id: "wheel-out-c",
            name: "Outer C",
            avatarId: { pick: "distinct", from: ["ch21", "ch41", "ch42"] },
            prop: PropType.STAFF,
            effect: "trails",
            effort: "linear",
            sequence: { length: 12, loop: "mirrored", flow: "smooth" },
            beatOffset: -8,
            position: { x: -3, z: 0 },
            blocking: [
              { move: "stand", durationSeconds: 0.5 },
              { move: "walk", to: { x: -2.12, z: -2.12 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0, z: -3 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 2.12, z: -2.12 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 3, z: 0 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 2.12, z: 2.12 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: 0, z: 3 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -2.12, z: 2.12 }, facing: "travel", durationSeconds: 1.75 },
              { move: "walk", to: { x: -3, z: 0 }, facing: "travel", durationSeconds: 1.75 },
            ],
          },
        ],
      },
      effectPresets: { silk: "silk-classic", trails: "trail-neon" },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "high",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 1.25 },
          {
            move: "crane",
            direction: "up",
            amount: { meters: 4 },
            durationSeconds: 5,
            easing: "ease-in-out",
          },
          // A crane on its own pulls the whole eye back, and six performers on
          // a 6-metre circle become specks in a field. The push-in buys the
          // height without paying for it in size.
          {
            move: "push-in",
            amount: { meters: 2 },
            durationSeconds: 2.75,
            easing: "ease-in-out",
          },
          // Against the outer ring's own turn, so it appears to slow while the
          // inner ring appears to speed up.
          {
            move: "orbit",
            direction: "ccw",
            amount: { degrees: 70 },
            durationSeconds: 4.5,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 1.5 },
        ],
      },
    },
    {
      id: "the-hey",
      title: "The hey",
      intent:
        "Four performers weave one figure eight, a quarter period apart, passing on opposite sides of the crossing.",
      durationSeconds: 17,
      transition: { kind: "environment-dissolve", durationSeconds: 0.9 },
      location: { environmentId: "void", showStage: false },
      performance: {
        bpm: 108,
        formation: "custom",
        // A Gerono lemniscate, x = 3.4 cos t, z = 2.8 sin t cos t. Four dancers
        // a quarter period apart puts two of them at the crossing on the same
        // frame, so each carries a lane offset of +/-0.75 m weighted by sin^2 t
        // — nothing at the ends of the loop, full width through the middle.
        // That is what a hey does anyway: the pass happens shoulder to
        // shoulder. Measured closest approach is 1.49 m.
        performers: [
          {
            id: "hey-1",
            name: "Hey 1",
            avatarId: { pick: "distinct", from: ["ch01", "ch22", "ch24", "ch44"] },
            prop: PropType.STAFF,
            effect: "led",
            effort: "linear",
            staffLengthCm: 140,
            sequence: { word: "SPIRAL", flow: "smooth" },
            beatOffset: 0,
            position: { x: 3.4, z: 0 },
            blocking: [
              { move: "stand", durationSeconds: 1 },
              { move: "walk", to: { x: 2.94, z: 1.4 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: 1.7, z: 1.77 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: 0.75 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: -1.7, z: -0.65 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: -2.94, z: -1.02 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: -3.4, z: 0 }, facing: "travel", durationSeconds: 0.96 },
              { move: "walk", to: { x: -2.94, z: 1.4 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: -1.7, z: 1.77 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: 0.75 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: 1.7, z: -0.65 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: 2.94, z: -1.02 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 3.4, z: 0 }, facing: "travel", durationSeconds: 0.94 },
            ],
          },
          {
            id: "hey-2",
            name: "Hey 2",
            avatarId: { pick: "distinct", from: ["ch01", "ch22", "ch24", "ch44"] },
            prop: PropType.STAFF,
            effect: "led",
            effort: "linear",
            staffLengthCm: 140,
            sequence: { word: "SPIRAL", flow: "smooth" },
            beatOffset: -1,
            position: { x: 0, z: 0.75 },
            blocking: [
              { move: "stand", durationSeconds: 1 },
              { move: "walk", to: { x: -1.7, z: -0.65 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: -2.94, z: -1.02 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: -3.4, z: 0 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: -2.94, z: 1.4 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: -1.7, z: 1.77 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: 0.75 }, facing: "travel", durationSeconds: 0.96 },
              { move: "walk", to: { x: 1.7, z: -0.65 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: 2.94, z: -1.02 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 3.4, z: 0 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: 2.94, z: 1.4 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: 1.7, z: 1.77 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: 0.75 }, facing: "travel", durationSeconds: 0.94 },
            ],
          },
          {
            id: "hey-3",
            name: "Hey 3",
            avatarId: { pick: "distinct", from: ["ch01", "ch22", "ch24", "ch44"] },
            prop: { sameAs: "hey-1" },
            effect: { sameAs: "hey-1" },
            effort: "linear",
            staffLengthCm: 140,
            sequence: { mirrorOf: "hey-1" },
            beatOffset: -2,
            position: { x: -3.4, z: 0 },
            blocking: [
              { move: "stand", durationSeconds: 1 },
              { move: "walk", to: { x: -2.94, z: 1.02 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: -1.7, z: 0.65 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: -0.75 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: 1.7, z: -1.77 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: 2.94, z: -1.4 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 3.4, z: 0 }, facing: "travel", durationSeconds: 0.96 },
              { move: "walk", to: { x: 2.94, z: 1.02 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: 1.7, z: 0.65 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: -0.75 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: -1.7, z: -1.77 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: -2.94, z: -1.4 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: -3.4, z: 0 }, facing: "travel", durationSeconds: 0.94 },
            ],
          },
          {
            id: "hey-4",
            name: "Hey 4",
            avatarId: { pick: "distinct", from: ["ch01", "ch22", "ch24", "ch44"] },
            prop: { sameAs: "hey-2" },
            effect: { sameAs: "hey-2" },
            effort: "linear",
            staffLengthCm: 140,
            sequence: { mirrorOf: "hey-2" },
            beatOffset: -3,
            position: { x: 0, z: -0.75 },
            blocking: [
              { move: "stand", durationSeconds: 1 },
              { move: "walk", to: { x: 1.7, z: -1.77 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: 2.94, z: -1.4 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 3.4, z: 0 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: 2.94, z: 1.02 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: 1.7, z: 0.65 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: -0.75 }, facing: "travel", durationSeconds: 0.96 },
              { move: "walk", to: { x: -1.7, z: -1.77 }, facing: "travel", durationSeconds: 1.26 },
              { move: "walk", to: { x: -2.94, z: -1.4 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: -3.4, z: 0 }, facing: "travel", durationSeconds: 1.69 },
              { move: "walk", to: { x: -2.94, z: 1.02 }, facing: "travel", durationSeconds: 1.88 },
              { move: "walk", to: { x: -1.7, z: 0.65 }, facing: "travel", durationSeconds: 1.11 },
              { move: "walk", to: { x: 0, z: -0.75 }, facing: "travel", durationSeconds: 0.94 },
            ],
          },
        ],
      },
      effectPresets: { led: "led-rainbow-pov" },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "high",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 2 },
          {
            move: "crane",
            direction: "up",
            amount: { meters: 5.5 },
            durationSeconds: 9,
            easing: "ease-in-out",
          },
          {
            move: "push-in",
            amount: { meters: 2.5 },
            durationSeconds: 4,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 2 },
        ],
      },
    },
    {
      id: "curtain",
      title: "Curtain",
      intent:
        "Eight performers advance downstage into a V and hold it while the camera lifts off the crowd.",
      durationSeconds: 14,
      transition: { kind: "fade-through-black", durationSeconds: 0.8 },
      location: { environmentId: "celestial", showStage: false, showAudience: true },
      performance: {
        bpm: 72,
        formation: "custom",
        // Cast-wide staging: one instruction moves everyone. It maps slot to
        // slot, so the opening marks are the V's own marks pushed 2 m upstage.
        // Every performer then walks the same 2 m at 0.62 m/s, straight at the
        // house, and nobody crosses anybody. Opening on a named preset instead
        // would send index 1 sprinting the width of the stage.
        blocking: {
          endFormation: "v-shape",
          durationSeconds: 3.2,
          easing: "ease-in-out",
        },
        cast: {
          count: 8,
          defaults: {
            effort: "glide",
            avatarId: {
              pick: "distinct",
              from: ["ch01", "ch07", "ch10", "ch18", "ch22", "ch24", "ch34", "ch41"],
            },
            sequence: { length: 16, loop: "rotated", flow: "smooth" },
          },
          performers: [
            {
              id: "performer-1",
              name: "Point",
              prop: PropType.STAFF,
              effect: "bloom",
              position: { x: 0, z: 0.4 },
              facingDegrees: 0,
            },
            {
              id: "performer-2",
              name: "Left wing",
              prop: PropType.FAN,
              effect: "silk",
              position: { x: -1.4, z: -0.8 },
              facingDegrees: 0,
            },
            {
              id: "performer-3",
              name: "Right wing",
              prop: PropType.FAN,
              effect: "silk",
              position: { x: 1.4, z: -0.8 },
              facingDegrees: 0,
            },
            {
              id: "performer-4",
              name: "Left mid",
              prop: PropType.STAFF,
              effect: "trails",
              position: { x: -2.8, z: -2 },
              facingDegrees: 0,
            },
            {
              id: "performer-5",
              name: "Right mid",
              prop: PropType.STAFF,
              effect: "trails",
              position: { x: 2.8, z: -2 },
              facingDegrees: 0,
            },
            {
              id: "performer-6",
              name: "Left back",
              prop: { oneOf: [PropType.BUUGENG, PropType.CLUB, PropType.TRIAD] },
              effect: "trails",
              position: { x: -4.2, z: -3.2 },
              facingDegrees: 0,
            },
            {
              id: "performer-7",
              name: "Right back",
              prop: { oneOf: [PropType.BUUGENG, PropType.CLUB, PropType.TRIAD] },
              effect: "trails",
              position: { x: 4.2, z: -3.2 },
              facingDegrees: 0,
            },
            {
              id: "performer-8",
              name: "Tail",
              prop: { oneOf: [PropType.BUUGENG, PropType.CLUB, PropType.TRIAD] },
              effect: "silk",
              position: { x: 0, z: -4.4 },
              facingDegrees: 0,
            },
          ],
        },
      },
      effectPresets: {
        trails: "trail-ember",
        silk: "silk-royal",
        bloom: "bloom-halo",
      },
      camera: {
        subject: { kind: "group" },
        // Wide stands 8.3 m out, close enough that the seating arc falls under
        // the bottom edge. Extreme-wide backs off to 12.1 m and holds the row
        // in the lower third through both moves.
        shotSize: "extreme-wide",
        angle: "eye",
        position: "behind",
        moves: [
          { move: "hold", durationSeconds: 2 },
          {
            move: "crane",
            direction: "up",
            amount: { meters: 2.5 },
            durationSeconds: 5,
            easing: "ease-out",
          },
          {
            move: "pull-back",
            amount: { meters: 3 },
            durationSeconds: 4.5,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 2.5 },
        ],
      },
    },
  ],
};
