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
        bpm: 90,
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
              // Side-by-side puts this one on the mark at (0.9, 0), so the
              // crossing covers 2.33 m in the four seconds eight beats buy —
              // 0.58 m/s, a walk, well inside the 2.6 m/s travel ceiling.
              blocking: [
                {
                  move: "walk",
                  to: { x: 3, z: -1 },
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
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [
          { move: "push-in", amount: { meters: 1.5 }, durationBeats: 8 },
          { move: "hold", durationBeats: 8 },
        ],
      },
    },
  ],
};
