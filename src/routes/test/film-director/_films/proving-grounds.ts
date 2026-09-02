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
 *
 * Gap 8a, camera edges. Before this wave the camera vocabulary stopped at
 * push/pull/orbit/crane/pan — no way to slide sideways without turning, no
 * way to tighten the lens without moving the rig, no way to tilt the
 * horizon. Scene 3 states all three in one breath: a truck, a zoom, and a
 * roll, each proven by an invariant the old moves couldn't produce.
 *
 * Gap 3, the camera tracks a walker. Before this wave the camera framed the
 * cast where it stood when the scene opened and stayed aimed there, so a
 * performer who walked out of that framing walked out of the film. Scene 4
 * says `track: "follow"` on its subject: camera and target both travel with
 * the walker, so the framing holds while the forest slides past behind them.
 *
 * Gap 4, mid-scene cuts. Before this wave a scene held one framing for its
 * whole length: to cut, a director had to split the shot into separate scenes
 * and rebuild the cast in each. Scene 5 states three framings inside one scene
 * under `camera.shots`. The frame jumps at each boundary — a step keyframe
 * holds the outgoing framing until the incoming one starts at the same
 * instant, and the spline is forbidden from bending across it.
 *
 * Gap 5, sequences a performer did not generate. Before this wave a performer
 * spun the film's demo, a generated sequence, or a mirror of a neighbour's.
 * Scene 6 spends all three of the new spellings: one performer plays a saved
 * public-library sequence by its id, and two more derive from it through
 * `transformOf` chains the Create module's Actions panel already owns.
 */
export const provingGroundsFilm: FilmDirectorInput = {
  version: 5,
  id: "proving-grounds-r1",
  title: "Proving Grounds",
  brief:
    "One scene per closed gap. Three performers draw distinct left and right planes with the wall ruled out, then a counted scene states its whole clock in beats — sixteen of them at 120 bpm, an eight-beat push, and an eight-beat crossing. A third scene tests the frame's edges: a one-meter truck, a fifteen-degree zoom, and a ten-degree clockwise roll. A fourth scene follows a walker with a medium shot that never loses them. A fifth scene cuts between three framings without a single glide. A sixth scene spins a saved library sequence beside two transforms of it, a 90-degree rotation with swapped hands and a retrograde.",
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  // The grammar only guarantees distinctness PER axis; three blues and three
  // reds may still overlap each other. This red-stream seed lands a draw with
  // zero cross-axis repeats, so the proving frame shows six visibly different
  // planes — film-library.test.ts asserts the union size to keep it honest.
  seed: { axes: { rightPlane: 5 } },
  scenes: [
    {
      id: "combined-draw",
      title: "Combined Draw",
      intent:
        "Gap 9: three performers draw DISTINCT left planes and DISTINCT right planes, and none of the six is ever the wall plane.",
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
            leftPlane: { pick: "distinct", not: "wall" },
            rightPlane: { pick: "distinct", not: "wall" },
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
    {
      id: "camera-edges",
      title: "Camera Edges",
      intent:
        "Gap 8a: the frame slides one meter sideways without turning (truck), the lens tightens fifteen degrees while the camera stands still (zoom), and the horizon tilts ten degrees clockwise and holds (roll). One meter, not two: with the zoom stacked on top, two meters pushed the blue performer out of frame.",
      durationBeats: 24,
      transition: { kind: "fade-through-black", durationBeats: 2 },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: { count: 2, defaults: { effect: "none" } },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "truck", direction: "right", amount: { meters: 1 }, durationBeats: 8 },
          { move: "zoom", direction: "in", amount: { degrees: 15 }, durationBeats: 8 },
          { move: "roll", direction: "cw", amount: { degrees: 10 }, durationBeats: 4 },
          { move: "hold", durationBeats: 4 },
        ],
      },
    },
    {
      id: "tracking-shot",
      title: "Tracking Shot",
      intent:
        "Gap 3: the camera follows a walking performer. A medium shot on the walker holds the same framing for the whole crossing — the walker stays put in frame while the forest slides past behind them — then the frame stops when they do.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: {
          count: 2,
          defaults: { effect: "none" },
          performers: [
            {
              id: "performer-2",
              // Side-by-side puts performer-2 at (0.9, 0). A 3 m crossing in
              // the four seconds eight beats buy is 0.75 m/s, a walk. The
              // path runs downstage of the partner's mark at (-0.9, 0); a
              // straight walk along z = 0 passed through their body.
              blocking: [
                {
                  move: "walk",
                  to: { x: -1.5, z: -1.8 },
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
        subject: {
          kind: "performer",
          performerId: "performer-2",
          track: "follow",
        },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "three-shots",
      title: "Three Shots",
      intent:
        "Gap 4: one scene, three framings, two hard cuts. A wide front two-shot for six beats, then a cut to a low close-up on performer 1 (the pink one, screen right from the front) that pushes in for six beats, then a cut to a high medium shot from behind for the last four. The frame jumps at each cut; nothing glides between framings.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: { count: 2, defaults: { effect: "none" } },
      },
      camera: {
        shots: [
          {
            subject: { kind: "group" },
            shotSize: "wide",
            angle: "eye",
            position: "front",
            durationBeats: 6,
          },
          {
            subject: { kind: "performer", performerId: "performer-1" },
            shotSize: "close-up",
            angle: "low",
            position: "front",
            moves: [{ move: "push-in", amount: { meters: 0.4 } }],
            durationBeats: 6,
          },
          {
            subject: { kind: "group" },
            shotSize: "medium",
            angle: "high",
            position: "behind",
          },
        ],
      },
    },
    {
      id: "derived-sequences",
      title: "Derived Sequences",
      intent:
        "Gap 5: three ways to spin something other than the film's demo. Performer 1 plays a saved public-library sequence (FLFLFLFL). Performer 2 plays performer 1's sequence rotated 90 degrees clockwise with hands swapped, so the same phrase reads turned and crossed. Performer 3 plays performer 1's sequence run backwards. Watch the three props: same material, three different pictures.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 120,
        formation: "line",
        cast: {
          count: 3,
          defaults: { effect: "none" },
          performers: [
            {
              id: "performer-1",
              // A real publicSequences document id, world-readable
              // (firestore.rules -> publicSequences). Word FLFLFLFL as of
              // 2026-09-02. If it is ever unpublished the library falls back
              // to the demo and names the miss in `failures`.
              sequence: { library: "0c7e6529-1dca-4254-903e-7068e38c030c" },
            },
            {
              id: "performer-2",
              sequence: {
                transformOf: "performer-1",
                transforms: [
                  { op: "rotate", degrees: 90, direction: "cw" },
                  { op: "swap-hands" },
                ],
              },
            },
            {
              id: "performer-3",
              sequence: {
                transformOf: "performer-1",
                transforms: [{ op: "rewind" }],
              },
            },
          ],
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
  ],
};
