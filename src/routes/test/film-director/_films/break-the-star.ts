import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * The same five-point star as Star of Five, but this one walks: the cast holds
 * the shape, then breaks it and lands together on a single line.
 *
 * Every performer keeps facing the audience for the whole crossing, so the
 * travel has to come out of their bodies rather than their headings — the two
 * fans slide sideways, the back pair walks straight at the lens, and the tip
 * backs up into the row. That is the point of the scene: four different clip
 * directions under one held facing.
 *
 * The three timings are staggered so all five land on the line at ten seconds
 * rather than trickling in. Distances differ by nearly two to one, so a single
 * shared window would either sprint the back pair or leave the fans crawling —
 * and under about 0.47 m/s the walk clip hits its playback-rate floor and the
 * feet start to skate. Each pair instead gets the window its own distance needs
 * at a shared 0.75 m/s.
 *
 * Casting and mirroring are Star of Five's — see that file for why SAILOR and
 * ORBITS are the words and why these five character IDs read the way they do on
 * screen. The lead is directed rather than merely spelled: DJ out of beta at
 * south, one turn on every step, so the featured performer's spin is pinned
 * where the star's tip points instead of wherever the generator started.
 */
export const breakTheStarFilm: FilmDirectorInput = {
  version: 4,
  id: "break-the-star-r1",
  title: "Break the Star",
  brief:
    "Five performers hold a star facing the audience, then break it: the fans slide out sideways, the back pair walks forward, the tip backs up, and all five land on one line.",
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  scenes: [
    {
      id: "star-to-line",
      title: "Star to line",
      intent:
        "Hold the star long enough to read it, then walk everyone onto a line without a single performer turning away from the audience.",
      durationSeconds: 16,
      location: { environmentId: "celestial", showStage: true },
      performance: {
        bpm: 72,
        formation: "custom",
        performers: [
          {
            id: "lead",
            name: "Lead",
            characterId: "ch01",
            prop: PropType.CAPSULE_BATON,
            effect: "led",
            effort: "linear",
            sequence: {
              word: "DJDJDJ",
              startPosition: { group: "beta", location: "south" },
              turns: 1,
            },
            position: { x: 0, z: -2.6 },
            facingDegrees: 180,
            bluePlane: "wall",
            redPlane: "wall",
            blocking: [
              { move: "stand", durationSeconds: 7.6 },
              {
                move: "walk",
                to: { x: 0, z: -0.8 },
                facing: "hold",
                durationSeconds: 2.4,
              },
            ],
          },
          {
            id: "fan-left",
            name: "Fan left",
            characterId: "ch07",
            prop: PropType.FAN,
            effect: "silk",
            effort: "glide",
            sequence: { word: "SAILOR" },
            position: { x: -2.47, z: -0.8 },
            facingDegrees: 180,
            bluePlane: "wall",
            redPlane: "wall",
            blocking: [
              { move: "stand", durationSeconds: 7.95 },
              // Straight out along x with the facing held: a pure strafe, and
              // the last of the three departures so the line closes outward.
              {
                move: "walk",
                to: { x: -4, z: -0.8 },
                facing: "hold",
                durationSeconds: 2.05,
              },
            ],
          },
          {
            id: "fan-right",
            name: "Fan right",
            characterId: "ch22",
            prop: PropType.FAN,
            effect: "silk",
            effort: "glide",
            sequence: { mirrorOf: "fan-left" },
            position: { x: 2.47, z: -0.8 },
            facingDegrees: 180,
            bluePlane: "wall",
            redPlane: "wall",
            blocking: [
              { move: "stand", durationSeconds: 7.95 },
              {
                move: "walk",
                to: { x: 4, z: -0.8 },
                facing: "hold",
                durationSeconds: 2.05,
              },
            ],
          },
          {
            id: "back-left",
            name: "Buugeng left",
            characterId: "ch10",
            prop: PropType.BUUGENG,
            effect: "bubbles",
            effort: "linear",
            sequence: { word: "ORBITS" },
            position: { x: -1.53, z: 2.1 },
            facingDegrees: 180,
            bluePlane: "wall",
            redPlane: "wall",
            blocking: [
              { move: "stand", durationSeconds: 6.1 },
              // Nearly three metres, the longest crossing in the scene, so this
              // pair leaves first and everyone still arrives together.
              {
                move: "walk",
                to: { x: -2, z: -0.8 },
                facing: "hold",
                durationSeconds: 3.9,
              },
            ],
          },
          {
            id: "back-right",
            name: "Buugeng right",
            characterId: "ch24",
            prop: PropType.BUUGENG,
            effect: "bubbles",
            effort: "linear",
            sequence: { mirrorOf: "back-left" },
            position: { x: 1.53, z: 2.1 },
            facingDegrees: 180,
            bluePlane: "wall",
            redPlane: "wall",
            blocking: [
              { move: "stand", durationSeconds: 6.1 },
              {
                move: "walk",
                to: { x: 2, z: -0.8 },
                facing: "hold",
                durationSeconds: 3.9,
              },
            ],
          },
        ],
      },
      effectPresets: {
        led: "led-capsule-classic",
        silk: "silk-royal",
        bubbles: "bubbles-iridescent",
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 5.5 },
          // A wide on the opening marks already stands seven metres out, and
          // the eight-metre line needs about six. So the move stays small on
          // purpose: enough to make room for the spread, not enough to shrink
          // five people into the middle of a tan stage. It runs a beat past
          // the arrival so the line settles inside a frame still moving.
          {
            move: "pull-back",
            amount: { meters: 1.5 },
            durationSeconds: 5.5,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 5 },
        ],
      },
    },
  ],
};
