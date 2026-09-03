import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

import type { FilmDirectorInput } from "../_lib/film-director-schema";

/**
 * The gap campaign's witness. Every other film in the library is a piece of
 * filmmaking that happens to use the language; this one is the language
 * proving itself, one scene per gap the campaign closed.
 *
 * It is a catalog, not a watch. Read end to end it runs about three and a half
 * minutes, but nobody should have to sit through it to see one thing: open a
 * scene directly with `?film=proving&scene=<id>` and it boots soloed and
 * looping, or open the Scenes index in the transport and pick from the cards.
 * Every scene carries a `category` and an `intent`, and the index groups by the
 * former and prints the latter.
 *
 * This comment is the same index, keyed by scene id, so a reader in the source
 * can find the scene that owns a behavior without counting down the array.
 * Scene ids are the stable address — the array order is not, and nothing should
 * refer to a scene by its position.
 *
 * CAMERA — what the frame does.
 *   camera-edges     Gap 8a. Truck, zoom, roll: sliding sideways without
 *                    turning, tightening without moving, tilting the horizon.
 *   tracking-shot    Gap 3. `track: "follow"`, so a performer who walks does
 *                    not walk out of the film.
 *   three-shots      Gap 4. Three framings and two hard cuts inside one scene,
 *                    where a cut used to mean a new scene and a rebuilt cast.
 *   orbit-clockwise  Gap 8b. A 90-degree orbit whose direction reads at a
 *                    glance. Clockwise decreases azimuth; that is settled.
 *   dolly-zoom       Gap 10. Two gestures in one window: a zoom inside a push's
 *                    `with`, matching subject size instead of stating a number.
 *   handheld         Gap 11. Off the tripod, seeded so it shakes the same way
 *                    every run, costing the shot none of its framing grammar.
 *   whip-pans        Gap 28. A pan spoken as a destination rather than an
 *                    angle, so aiming at a performer needs no trigonometry.
 *   hand-cam         Gap 12. A hand or a prop tip as the camera's subject.
 *                    Compile-time framing only; live re-aim is a rejection.
 *
 * TIMING — how the film counts.
 *   on-the-beat      Gap 1. Every duration stated in beats, nothing in seconds.
 *   waltz            Gap 22. Bars: meter three, four bars, a two-bar push.
 *   tempo-slow       Gap 16, first half. Exists to give the next scene a phrase
 *                    to continue and a real count to hand it.
 *   tempo-double     Gap 16. `phrase: "continue"` carries the count across a
 *                    tempo cut instead of resetting the prop to step zero.
 *   growing-staff    Gaps 15, 17, 19. Named cues spent three ways: a staff that
 *                    grows between them, a hold that runs until one, a freeze
 *                    that opens on the other and says where inside its step.
 *
 * STAGING — where the bodies are.
 *   edges-of-the-stage  Gap 7. An entrance from eight meters outside the frame
 *                       along a bowed path, and a performer with no sequence.
 *   empty-stage         Gap 21. A cast of zero, which used to be a rejection.
 *   two-lines-one-circle Gap 18. Blocking as a timeline: three phases in one
 *                       scene, the last opening on a cue.
 *
 * PERFORMERS — who they are and what they carry.
 *   combined-draw    Gap 9. `distinct` and `not` on one axis in one breath, on
 *                    two axes at once: six different non-wall planes.
 *   derived-sequences Gap 5. A saved library sequence and two transforms of it.
 *   per-step-changes Gap 2. Effect, effort, and a hold changing partway through
 *                    a scene, where changing either used to mean a cut.
 *   canon-ramp       Gap 20. Two spreads the cast states once and divides among
 *                    itself: a canon offset and a level ramp.
 *
 * PROPS — what is in their hands.
 *   prop-builds      Gap 23. The build of a prop, not just its type, with
 *                    finish overridden per performer.
 *   split-hands      Gap 26. One effect per hand, resolved as a tip map keyed
 *                    0 (left, blue) and 1 (right, red).
 *
 * STRUCTURE — how scenes refer to each other.
 *   callback         Gaps 13, 14. `extends` and `seedAs`: a variation that
 *                    inherits a scene's staging and its draw instead of
 *                    retyping both and letting the copy drift.
 *
 * Deleted rather than kept: an `orbit-counterclockwise` twin of the orbit
 * scene, staged identically so the two signs could be judged side by side while
 * the convention was open. The convention closed, so the second scene was
 * costing sixteen beats to ask a question that has an answer. Its mirror
 * invariant moved into film-library.test.ts, which builds the twin inline.
 */
export const provingGroundsFilm: FilmDirectorInput = {
  version: 5,
  id: "proving-grounds-r1",
  title: "Proving Grounds",
  brief:
    "A catalog of everything the directive language can say, one scene per closed gap, grouped by what is happening on screen: eight camera scenes, five that count time, three that stage bodies, four about who the performers are, two about what is in their hands, and one about how a scene refers to another. Watching it front to back is the least useful way to use it. Open a scene by id and it plays alone on a loop, or open the Scenes index and pick from the cards, each of which prints what its scene is proving.",
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
      category: "performers",
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
      category: "timing",
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
      category: "camera",
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
      category: "camera",
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
      category: "camera",
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
      category: "performers",
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
      category: "staging",
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
      category: "performers",
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
      category: "camera",
      intent:
        "Gap 8b: the camera orbits the line 90 degrees, direction cw. Three different characters stand left to right so the direction of travel reads at a glance. This scene had a counterclockwise twin while the sign was still open; clockwise decreases azimuth is settled now, so what is left is the picture rather than the question.",
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
      id: "dolly-zoom",
      title: "Dolly Zoom",
      category: "camera",
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
      category: "camera",
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
      category: "camera",
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
      category: "structure",
      intent:
        'Gaps 13 and 14: the opening scene again, from the other side. `extends` brings the cast, the forest, the lit planes, and the wide front framing across, and the only thing stated here is `position: "behind"`, which lands on the inherited camera without disturbing the rest of it. `seedAs` is the second half: without it the same distinct-and-not draw would run under a new scene name and deal six different planes, and the callback would be a different moment rather than the same one seen from the back.',
      durationSeconds: 6,
      transition: { kind: "cut" },
      camera: { position: "behind" },
    },
    {
      id: "empty-stage",
      title: "Empty Stage",
      category: "staging",
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
      category: "timing",
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
      category: "timing",
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
      category: "timing",
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
      category: "timing",
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
      category: "staging",
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
    {
      id: "hand-cam",
      title: "Hand Cam",
      category: "camera",
      intent:
        'Gap 12. The camera can name a hand or a prop tip as its subject, not just a whole performer. The aim sits on the opening mark of that performer at hand height (1.1 m) and prop-tip height (1.4 m), so the framing is tight on the working hand rather than the face. The aim does not follow the hand through the phrase: no hand world position reaches the viewer state, which is recorded as a rejection in the capability matrix.',
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: { count: 2, defaults: { effect: "trails" } },
      },
      camera: {
        subject: { kind: "hand", performerId: "performer-1", hand: "right" },
        shotSize: "close-up",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "canon-ramp",
      title: "Canon Ramp",
      category: "performers",
      intent:
        'Gap 20. Two spreads the cast speaks once and every performer takes their own share of. "beatOffset: { canon: 2 }" walks the cast two counts apart each, so performer 4 enters six counts behind performer 1. "level: { ramp: { from: 1, to: 3 } }" walks the same cast from level 1 to level 3, so the line reads as a difficulty gradient without naming a level per performer.',
      durationBeats: 32,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "line",
        cast: {
          count: 4,
          defaults: {
            effect: "led",
            beatOffset: { canon: 2 },
            sequence: { length: 8, level: { ramp: { from: 1, to: 3 } } },
          },
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "high",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "prop-builds",
      title: "Prop Builds",
      category: "props",
      intent:
        'Gap 23. A performer states the build of the prop in their hands, not just its type. Performer 1 spins fire fans on a black frame, performer 2 the lotus build with a day finish. Finish is per performer here: it is a part of the build the performer overrides, so the two differ on stage at the same time.',
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: {
          count: 2,
          defaults: { prop: PropType.FAN, effect: "trails" },
          performers: [
            {
              id: "performer-1",
              propBuild: {
                fanBuild: "fire",
                fanFrameColor: "black",
                finish: "fire",
              },
            },
            {
              id: "performer-2",
              propBuild: { fanBuild: "lotus", finish: "day" },
            },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
    {
      id: "split-hands",
      title: "Split Hands",
      category: "props",
      intent:
        'Gap 26. One effect per hand. Performer 1 runs fire on the left and led on the right for the whole scene; performer 2 starts matched and splits on the "split" cue. The renderer already resolves an effect per prop, so the pair reaches it as a tip map keyed 0 (left, blue) and 1 (right, red) rather than the wildcard.',
      durationBeats: 16,
      transition: { kind: "cut" },
      location: { environmentId: "forest" },
      cues: { split: { atBeats: 8 } },
      performance: {
        bpm: 120,
        formation: "side-by-side",
        cast: {
          count: 2,
          performers: [
            {
              id: "performer-1",
              effect: { left: "fire", right: "led" },
            },
            {
              id: "performer-2",
              effect: "trails",
              stepEffects: [
                { step: "split", effect: { left: "sparkles", right: "ghost" } },
              ],
            },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [{ move: "hold" }],
      },
    },
  ],
};
