import type { FilmDirectorInput } from "../_lib/film-director-schema";

/**
 * The gap campaign's witness. Every other film in the library is a piece of
 * filmmaking that happens to use the language; this one is the language
 * proving itself, one scene per gap the campaign closes. Later waves append
 * scenes rather than rewriting these — the film grows a scene each time the
 * grammar grows a word.
 *
 * Wave 1 covers two:
 *
 * Gap 9, the combined draw. Before this wave, `distinct` and `not` were
 * separate spellings and a director could ask for only one of them per axis:
 * "everyone on a different plane" OR "nobody on the wall", never both in one
 * breath. Scene 1 asks for both on two axes at once, and the frame either
 * shows six different non-wall planes or the gap is not closed.
 *
 * Gap 1, beats as a time unit. A director counts music. Scene 2 states every
 * duration it has in beats — the scene, the camera push, the walk — and the
 * resolved seconds are what the conversion produced, not what a default
 * supplied.
 */
export const provingGroundsFilm: FilmDirectorInput = {
  version: 4,
  id: "proving-grounds-r1",
  title: "Proving Grounds",
  brief:
    "One scene per closed gap. Three performers draw distinct blue and red planes with the wall ruled out, then a counted scene states its whole clock in beats — sixteen of them at 120 bpm, an eight-beat push, and an eight-beat crossing.",
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  // The grammar only guarantees distinctness PER axis; three blues and three
  // reds may still overlap each other. This red-stream seed lands a draw with
  // zero cross-axis repeats, so the proving frame shows six visibly different
  // planes — film-library.test.ts asserts the union size to keep it honest.
  seed: { axes: { redPlane: 5 } },
  scenes: [
    {
      id: "combined-draw",
      title: "Combined Draw",
      intent:
        "Gap 9: three performers draw DISTINCT blue planes and DISTINCT red planes, and none of the six is ever the wall plane.",
      durationSeconds: 12,
      location: {
        environmentId: "forest",
        // Every plane the draw can land on, lit as scenery — so the six drawn
        // grids are readable in the frame and the absent wall is visible as an
        // absence. The list is the full nine minus the excluded wall.
        visiblePlanes: [
          "wheel",
          "floor",
          "right-shield",
          "left-shield",
          "forward-ramp",
          "backward-ramp",
          "right-wing",
          "left-wing",
        ],
      },
      performance: {
        formation: "line",
        cast: {
          count: 3,
          defaults: {
            // The wave-1 spelling. Each half of it was already sayable; saying
            // both on one axis is what this scene exists to show.
            bluePlane: { pick: "distinct", not: "wall" },
            redPlane: { pick: "distinct", not: "wall" },
            effect: "none",
          },
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "on-the-beat",
      title: "On the Beat",
      intent:
        "Gap 1: everything here is counted, nothing timed — a 16-beat scene at 120 bpm (8s), the camera pushes in for exactly 8 beats then holds 8, and the walker crosses on an 8-beat phrase.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: {
          count: 2,
          performers: [
            {
              id: "performer-2",
              // Side-by-side puts this one on the mark at (0.9, 0). The
              // crossing runs THROUGH the frame — downstage of the partner to
              // (-1.5, -1) — 2.62 m in the four seconds eight beats buy, or
              // 0.65 m/s, inside the 0.47-2.6 m/s window where a walk reads
              // as a walk. A destination out the side of the frame turned the
              // pushed-in arrival into a wall of close-up geometry.
              blocking: [
                {
                  move: "walk",
                  to: { x: -1.5, z: -1 },
                  durationBeats: 8,
                  facing: "travel",
                },
                { move: "stand" },
              ],
            },
          ],
        },
      },
      camera: {
        // Aim at the performer who HOLDS a mark, not the group: the group's
        // center is vacated the moment the crossing starts, and a camera
        // aimed at vacated space holds an empty frame for the closing four
        // seconds. Wide with a one-meter push keeps both the push-in and the
        // crossing readable; a deeper push ends with the downstage walker
        // half-cropped at the frame edge.
        subject: { kind: "performer", performerId: "performer-1" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "push-in", amount: { meters: 1 }, durationBeats: 8 },
          { move: "hold", durationBeats: 8 },
        ],
      },
    },
  ],
};
