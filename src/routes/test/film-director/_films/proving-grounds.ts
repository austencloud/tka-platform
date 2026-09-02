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
 *
 * Gap 7, the edges of the stage. Before this wave a walk was a straight line
 * between two marks, and a performer who was meant to enter had nowhere to
 * enter from. Scene 7 opens performer 3 five meters off the right of the
 * frame — legal all along, because nothing clamps a position and the ground
 * grows to include it — and walks them in along an arc that bows to their
 * left, compiled into chords whose speed is measured along the curve rather
 * than across the chord. A third performer stands and watches with no
 * sequence at all.
 *
 * Gap 2, changes partway through a scene. Before this wave a performer carried
 * one effect and one effort for a whole scene, and every performer counted the
 * same clock: to change either, a director had to cut to a new scene. Scene 8
 * states `stepEffects` and `stepEfforts` on one performer and `holds` on
 * another. Nothing about the scene changes at those counts except what that
 * one performer carries, and what the held performer's prop is doing.
 */
export const provingGroundsFilm: FilmDirectorInput = {
  version: 5,
  id: "proving-grounds-r1",
  title: "Proving Grounds",
  brief:
    "One scene per closed gap. Three performers draw distinct left and right planes with the wall ruled out, then a counted scene states its whole clock in beats — sixteen of them at 120 bpm, an eight-beat push, and an eight-beat crossing. A third scene tests the frame's edges: a one-meter truck, a fifteen-degree zoom, and a ten-degree clockwise roll. A fourth scene follows a walker with a medium shot that never loses them. A fifth scene cuts between three framings without a single glide. A sixth scene spins a saved library sequence beside two transforms of it, a 90-degree rotation with swapped hands and a retrograde. A seventh scene walks a performer in from off camera along a bowed path, while a third stands and watches with no sequence at all. An eighth scene changes one performer's effect and effort partway through while another's prop stops for four counts.",
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
    {
      id: "edges-of-the-stage",
      title: "Edges of the Stage",
      intent:
        "Gap 7: performer 3 opens off camera at (8, -1), eight meters out past the edge of a three-wide line and outside a medium shot aimed at its centre, and walks in along a left-bending arc to their mark at (1.8, -0.3) over twelve beats — about 6.5 meters of curve in six seconds, a 1.1 m/s walk. Nothing clamps a position to the stage, so the ground grows to include the opening mark and the entrance is simply a walk from outside the frame. Watch the path bow: a straight walk would cut the corner. Performer 1 stands and watches: `{source: \"none\"}`, no prop phrase, body idling while the other two spin.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        // side-by-side, not custom: a per-performer `position` overrides its
        // formation slot under any preset (resolve-film-director-spec.ts,
        // `buildResolvedPerformers`), and "custom" would demand a position
        // from all three when only one of them starts somewhere unusual.
        formation: "side-by-side",
        cast: {
          count: 3,
          defaults: { effect: "none" },
          performers: [
            { id: "performer-1", sequence: { source: "none" } },
            { id: "performer-2" },
            {
              id: "performer-3",
              // Off camera at the top of the scene, past the edge of the
              // medium shot below. side-by-side puts the third slot at
              // (1.8, -0.3), which is where the arc lands.
              position: { x: 8, z: -1 },
              blocking: [
                {
                  move: "walk",
                  to: { x: 1.8, z: -0.3 },
                  along: { arc: "left", bulge: 0.25 },
                  facing: "travel",
                  durationBeats: 12,
                },
                { move: "stand" },
              ],
            },
          ],
        },
      },
      camera: {
        // A medium shot aimed at the centre of the line, not a wide on the
        // group: a group framing widens to include every opening mark, and
        // even a wide on one performer sees about 11 m either side of centre
        // at this depth (measured 2026-09-02), so both put the entrance inside
        // the frame from the first beat and make "off camera" a lie.
        subject: { kind: "performer", performerId: "performer-2" },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "per-step-changes",
      title: "Per-Step Changes",
      intent:
        "Gap 2: two things change partway through one scene. Performer 1 starts bare, picks up trails at step 4, and catches fire at step 8, switching to a punched effort at the same count. Performer 2 states no changes at all, but holds: at step 4 their prop stops for four counts while performer 1 keeps going, and afterwards they carry on from where they froze, four steps behind the clock.",
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
              id: "performer-1",
              stepEffects: [
                { step: 0, effect: "none" },
                { step: 4, effect: "trails" },
                { step: 8, effect: "fire" },
              ],
              stepEfforts: [{ step: 8, effort: "punch" }],
            },
            {
              id: "performer-2",
              holds: [{ fromStep: 4, steps: 4 }],
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
