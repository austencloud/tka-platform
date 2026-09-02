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
 * enter from. Scene 7 opens performer 3 eight meters out, past the edge of a
 * medium shot — legal all along, because nothing clamps a position and the ground
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
 *
 * Gap 8b, the felt direction of an orbit. The compiler has carried `orbit`
 * with a `cw`/`ccw` direction since gap 8a, but nobody has watched the two
 * signs side by side to check which one an audience would actually call
 * clockwise. Scenes 9 and 10 stage the same three characters in the same
 * line, the same wide front shot, the same 90-degree orbit. Direction is
 * the only thing that differs between them.
 *
 * Round 2, wave A adds three.
 *
 * Gap 10, two camera gestures at once. Every move had its own disjoint window,
 * so the most recognisable camera move in cinema was unsayable. Scene 11 puts a
 * zoom inside a push-in's `with` and lets it state `match: "subject-size"`
 * instead of a number: the compiler solves the fov so the performer's size on
 * screen never changes while the rig travels toward her.
 *
 * Gap 11, off the tripod. Scene 12 says `handheld: "steady"` on an otherwise
 * ordinary wide front shot. The drift is seeded from the film and the scene,
 * so it is the same shake every run, and it costs the shot none of its
 * framing vocabulary.
 *
 * Gap 28, a pan that names its destination. `pan` took degrees, so aiming at a
 * performer meant doing the trigonometry by hand. Scene 13 whips between two
 * marks five meters apart with two pans that state only `to`.
 *
 * Round 2, wave B adds three more.
 *
 * Gaps 13 and 14, the callback. A variation on an earlier scene meant retyping
 * the whole scene and letting the copy drift. Scene 14 states `extends` and
 * `seedAs` on scene 1 and one word of camera, and comes back to the same
 * moment from behind, down to the six planes the original drew.
 *
 * Gap 21, nobody. A cast of zero was a schema rejection, so an establishing
 * shot of an empty place had to be faked with a performer hiding off frame.
 * Scene 15 casts no one for three seconds.
 *
 * Gap 22, bars. A director counts bars and the film only understood beats.
 * Scene 16 is a waltz: meter three, four bars long, with a two-bar push.
 *
 * Round 2, wave C adds four.
 *
 * Gap 16, one phrase across a tempo change. A new scene restarted the count,
 * so cutting to a faster take threw the prop back to step zero. Scenes 17 and
 * 18 are the same two performers at 60 then 120 bpm, and the second says
 * `phrase: "continue"`, so the count crosses the cut unbroken.
 *
 * Gaps 15, 17 and 19. Scene 19 names two moments and spends them everywhere:
 * a staff that grows from 100 cm to 250 between them, a camera hold that runs
 * until the second one, and a freeze that opens on the first. The freeze also
 * says where inside its step the pose sits.
 *
 * Gap 18, staging as a timeline. Cast blocking was one instruction for the
 * whole scene. Scene 20 states three phases, the last opening on a cue.
 */
export const provingGroundsFilm: FilmDirectorInput = {
  version: 5,
  id: "proving-grounds-r1",
  title: "Proving Grounds",
  brief:
    "One scene per closed gap. Three performers draw distinct left and right planes with the wall ruled out, then a counted scene states its whole clock in beats — sixteen of them at 120 bpm, an eight-beat push, and an eight-beat crossing. A third scene tests the frame's edges: a one-meter truck, a fifteen-degree zoom, and a ten-degree clockwise roll. A fourth scene follows a walker with a medium shot that never loses them. A fifth scene cuts between three framings without a single glide. A sixth scene spins a saved library sequence beside two transforms of it, a 90-degree rotation with swapped hands and a retrograde. A seventh scene walks a performer in from off camera along a bowed path, while a third stands and watches with no sequence at all. An eighth scene changes one performer's effect and effort partway through while another's prop stops for four counts. A ninth and tenth scene repeat one staging twice, an orbit clockwise then the same orbit counterclockwise, so the two can be judged side by side. Then an eleventh scene pushes in and widens the lens in the same breath, holding the performer's size while the world stretches behind her; a twelfth takes the same wide shot off the tripod; and a thirteenth whips between two performers with pans that name where to aim instead of how far to turn. A fourteenth scene calls the first one back from behind, inheriting its staging and its draw rather than restating either. A fifteenth holds three seconds on a stage with nobody on it. A sixteenth counts itself in bars: four bars of three at 90. A seventeenth and eighteenth play the same phrase at 60 then 120 with the count crossing the cut instead of restarting. A nineteenth names the moments it cares about, \"grow\" and \"settle\", and hangs a staff growing from 100 cm to 250, a camera hold, and a half-step freeze off those two names. A twentieth walks its cast through three staging phases, the last one opening on the drop.",
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
    {
      id: "orbit-clockwise",
      title: "Orbit Clockwise",
      intent:
        "Gap 8b, first half: the camera orbits the line 90 degrees with direction cw. Three different characters stand left to right so the direction of travel reads at a glance. Watch which way the line turns in the frame.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "line",
        cast: {
          count: 3,
          defaults: { effect: "none" },
          performers: [
            { id: "performer-1", characterId: "x-bot" },
            { id: "performer-2", characterId: "remy" },
            { id: "performer-3", characterId: "ch01" },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [{ move: "orbit", amount: { degrees: 90 }, direction: "cw" }],
      },
    },
    {
      id: "orbit-counterclockwise",
      title: "Orbit Counterclockwise",
      intent:
        "Gap 8b, second half: the same staging and the same 90 degree orbit, direction ccw. The line should turn the opposite way from the previous scene. Whichever of the two you would call clockwise decides whether the sign in camera-language.ts stays.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "line",
        cast: {
          count: 3,
          defaults: { effect: "none" },
          performers: [
            { id: "performer-1", characterId: "x-bot" },
            { id: "performer-2", characterId: "remy" },
            { id: "performer-3", characterId: "ch01" },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [{ move: "orbit", amount: { degrees: 90 }, direction: "ccw" }],
      },
    },
    {
      id: "dolly-zoom",
      title: "Dolly Zoom",
      intent:
        "Gap 10: two camera gestures in one window. The rig pushes 1.2 meters in over six seconds while the lens widens by exactly as much as the travel took away, so the performer holds her size in frame and the forest behind her stretches. One statement, not two moves: the zoom lives in the push's `with` and states `match: \"subject-size\"` instead of a number, so the compiler solves the fov rather than the director doing the trigonometry. Then two seconds to sit in it.",
      durationSeconds: 8,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        formation: "solo",
        cast: { count: 1, defaults: { effect: "none" } },
      },
      camera: {
        subject: { kind: "performer", performerId: "performer-1" },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [
          {
            move: "push-in",
            // 1.2 meters, not 2: a medium shot on one performer sits about
            // 2.9 m out, and closing all but 0.9 m of that needs a 114-degree
            // lens to hold her size, past the 100-degree ceiling. 1.2 lands
            // the solve near 77 degrees, wide enough to stretch the forest.
            amount: { meters: 1.2 },
            durationSeconds: 6,
            with: [{ move: "zoom", amount: { match: "subject-size" } }],
          },
          { move: "hold", durationSeconds: 2 },
        ],
      },
    },
    {
      id: "handheld",
      title: "Handheld",
      intent:
        "Gap 11: the same wide front shot every other scene here uses, off the tripod. `handheld: \"steady\"` adds five centimeters of body sway and a degree of aim drift, smooth and never repeating, seeded from the film and this scene so it shakes the same way every run. Nothing else about the shot changes: handheld is a modifier on the sampled frame, so the framing grammar still says everything it said before.",
      durationSeconds: 7,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        formation: "line",
        cast: { count: 3, defaults: { effect: "none" } },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        handheld: "steady",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "whip-pans",
      title: "Whip Pans",
      intent:
        "Gap 28: a pan spoken as a destination. Two performers stand five meters apart. The camera opens on the one at screen right, then snaps to the other in three tenths of a second, sits, and snaps back. Neither pan states an angle: each says `to` that performer, and the compiler reads the shortest way round from where the camera currently aims to their mark.",
      durationSeconds: 8,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        formation: "custom",
        performers: [
          {
            id: "him",
            position: { x: -2.5, z: 0 },
            facingDegrees: 180,
            effect: "none",
          },
          {
            id: "her",
            position: { x: 2.5, z: 0 },
            facingDegrees: 180,
            effect: "none",
          },
        ],
      },
      camera: {
        subject: { kind: "performer", performerId: "him" },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 2.5 },
          {
            move: "pan",
            to: { kind: "performer", performerId: "her" },
            durationSeconds: 0.3,
            easing: "linear",
          },
          { move: "hold", durationSeconds: 2.4 },
          {
            move: "pan",
            to: { kind: "performer", performerId: "him" },
            durationSeconds: 0.3,
            easing: "linear",
          },
          { move: "hold", durationSeconds: 2.5 },
        ],
      },
    },
    {
      id: "callback",
      // Gaps 13 and 14. No cast, no location, no plane list, no framing: the
      // only thing this scene says about its staging is which scene it is a
      // variation of and which side the camera is on.
      extends: "combined-draw",
      seedAs: "combined-draw",
      title: "Callback",
      intent:
        'Gaps 13 and 14: the opening scene again, from the other side. `extends` brings the cast, the forest, the lit planes, and the wide front framing across, and the only thing stated here is `position: "behind"`, which lands on the inherited camera without disturbing the rest of it. `seedAs` is the second half: without it the same distinct-and-not draw would run under a new scene name and deal six different planes, and the callback would be a different moment rather than the same one seen from the back.',
      durationSeconds: 6,
      transition: { kind: "cut" },
      camera: { position: "behind" },
    },
    {
      id: "empty-stage",
      title: "Empty Stage",
      intent:
        "Gap 21: nobody. A cast of zero used to be a schema rejection, so holding on a place before anyone walked into it meant casting someone and hoping they stayed out of frame. The shot frames the stage origin at head height, the ground is still under the camera, and every rig in the pool stands empty handed.",
      durationSeconds: 3,
      transition: { kind: "fade-through-black" },
      location: { environmentId: "forest" },
      performance: { cast: { count: 0 } },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "waltz",
      title: "Waltz",
      intent:
        'Gap 22: counted in bars. The meter is three, the tempo is 90, and the scene states its length as four bars rather than the twelve beats or the eight seconds those work out to. The push-in is two bars of the same clock. A director counting a waltz says "four bars", never "twelve beats", and now the film can hear it.',
      durationBars: 4,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 90,
        meter: { beatsPerBar: 3 },
        formation: "solo",
        cast: { count: 1, defaults: { effect: "none" } },
      },
      camera: {
        subject: { kind: "performer", performerId: "performer-1" },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [
          { move: "push-in", amount: { meters: 0.6 }, durationBars: 2 },
          { move: "hold" },
        ],
      },
    },
    {
      id: "tempo-slow",
      title: "Tempo, Slow Half",
      intent:
        "Gap 16, first half. Sixteen counts at 60 bpm. Nothing here is new on its own; it exists so the scene after it has a phrase to continue, and so the count the film hands that scene is a real number rather than zero.",
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 60,
        formation: "side-by-side",
        cast: { count: 2, defaults: { effect: "trails" } },
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
      id: "tempo-double",
      title: "Tempo, Double Time",
      intent:
        'Gap 16: the same phrase, twice the tempo. A tempo change used to mean cutting to a new scene, and a new scene restarted the count, so the prop jumped back to step zero at the cut. `phrase: "continue"` hands this scene the count the last one ended on: step 16 arrives at 120 bpm on the first frame after the cut, and the phrase reads as one gesture speeding up rather than two takes.',
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "cosmic" },
      performance: {
        bpm: 120,
        phrase: "continue",
        formation: "side-by-side",
        cast: { count: 2, defaults: { effect: "trails" } },
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
      id: "growing-staff",
      title: "Growing Staff",
      intent:
        'Gaps 15, 17 and 19. The scene names two moments, "grow" and "settle", and then never states a number again: the prop ramp, the camera hold, and the second performer\'s freeze all hang off those names, so moving a cue moves every one of them together. Performer 1\'s staff starts at 100 cm and slides to 250 by the settle. Performer 2 freezes at the grow for four counts, and states `progress: 0.5` so the frozen pose sits halfway through its step rather than at the top of it.',
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      cues: { grow: { atBeats: 4 }, settle: { atBeats: 12 } },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: {
          count: 2,
          defaults: { effect: "trails" },
          performers: [
            {
              id: "performer-1",
              staffLengthCm: 100,
              stepStaffLengths: [
                { step: "grow", staffLengthCm: 100, ease: "cut" },
                { step: "settle", staffLengthCm: 250 },
              ],
            },
            {
              id: "performer-2",
              holds: [{ fromStep: "grow", steps: 4, progress: 0.5 }],
            },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", until: "settle" },
          { move: "push-in", amount: { meters: 0.5 } },
        ],
      },
    },
    {
      id: "two-lines-one-circle",
      title: "Two Lines, One Circle",
      intent:
        'Gap 18: staging as a timeline. Cast blocking used to be one instruction for the whole scene, so "line up, hold, then break into a circle on the drop" needed three scenes and a rebuilt cast in each. Here it is three phases in one scene: the cast walks into a line, stands, and then opens into a circle starting on the "drop" cue. The phases run in the order written and may not overlap, because two formations cannot own the cast at once.',
      durationBeats: 32,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      cues: { drop: { atBeats: 16 } },
      performance: {
        bpm: 120,
        formation: "grid-2x2",
        cast: { count: 4, defaults: { effect: "led" } },
        blocking: [
          { endFormation: "line", durationBeats: 8, facing: "hold" },
          { endFormation: "line", durationBeats: 4 },
          {
            endFormation: "circle",
            startCue: "drop",
            durationBeats: 8,
            facing: "travel",
          },
        ],
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "high",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
  ],
};
