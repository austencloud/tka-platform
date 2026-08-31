import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * One phrase, owned four ways. The whole film is a single ten-step figure —
 * EMBER from beta3 — and the story is who holds its difficulty. The master
 * opens with the full figure: level 3, a repeating turn shape of
 * [1, "fl", 0, 0.5]. The apprentice first shadows it marked flat (level 1,
 * no turns, one beat behind), then takes it to level 2 alone, and in the
 * last scene performs the master's exact directive — same word, same level,
 * same turn figure — on fire, while the master marks it flat a beat behind
 * her. The two sequence directives literally swap owners between scene two
 * and scene four; the handoff is in the JSON, not just on the screen.
 *
 * Deliberately, this is the only film in the library with no directive
 * randomness at all — not one pick, oneOf, or reroll. Chance Suite argued
 * the grammar can leave choices open; this one argues the opposite case,
 * that a document can pin every axis because every axis is intent.
 *
 * Two constraints from the language shaped the staging. Effect presets are
 * scene-scoped per effect id, so the master's banked-charcoal preset would
 * also claim any charcoal the apprentice wore; in scene three she takes
 * sparkles instead, which needs no preset — and reads better anyway, since
 * sparks belong before fire. And choosing the fire effect auto-equips a
 * burnable build in-family, but the last scene casts FIRE_DOUBLE_STAFF
 * explicitly: the ignition is the film's turn, not a side effect.
 */
export const emberFilm: FilmDirectorInput = {
  version: 4,
  id: "ember-r1",
  title: "Ember",
  brief:
    "A master and an apprentice, and one ten-step figure passed between them: full at level 3 with a turn figure of [1, fl, 0, half], shadowed flat a beat behind, taken alone at level 2, then performed on fire by the student while the teacher marks it in smoke. Every axis is pinned — no directive randomness anywhere.",
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  scenes: [
    {
      id: "banked",
      title: "Banked",
      intent:
        "The master alone with the full figure, coals barely lit. The camera circles once, unhurried, and steps closer.",
      durationSeconds: 13,
      location: { environmentId: "ember", showStage: false },
      performance: {
        bpm: 66,
        formation: "solo",
        performers: [
          {
            id: "master",
            name: "Master",
            characterId: "ch10",
            prop: PropType.STAFF,
            staffLengthCm: 150,
            effect: "charcoal",
            effort: "glide",
            // The figure the whole film hands down: EMBER pins beta3 as the
            // only feasible start, expands to ten steps, and carries the
            // level-3 turn shape — a whole turn, a float, a rest, a half —
            // repeating across the phrase.
            sequence: {
              word: "EMBER",
              startPosition: "beta3",
              level: 3,
              turns: [1, "fl", 0, 0.5],
              flow: "smooth",
            },
          },
        ],
      },
      effectPresets: { charcoal: "charcoal-banked-ember" },
      camera: {
        subject: { kind: "group" },
        shotSize: "medium",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 2 },
          {
            move: "orbit",
            direction: "ccw",
            amount: { degrees: 40 },
            durationSeconds: 6,
            easing: "ease-in-out",
          },
          {
            move: "push-in",
            amount: { meters: 1.2 },
            durationSeconds: 3,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 2 },
        ],
      },
    },
    {
      id: "the-lesson",
      title: "The lesson",
      intent:
        "The apprentice walks in, squares up beside the master, and shadows the phrase marked flat, one beat behind.",
      durationSeconds: 14,
      transition: { kind: "environment-dissolve", durationSeconds: 0.8 },
      // The wall grid stands in for the studio mirror: both face it, and the
      // marked phrase lives on it.
      location: { environmentId: "ember", showStage: false, visiblePlanes: ["wall"] },
      performance: {
        bpm: 66,
        formation: "custom",
        performers: [
          {
            id: "master",
            name: "Master",
            characterId: "ch10",
            prop: PropType.STAFF,
            staffLengthCm: 150,
            effect: "charcoal",
            effort: "glide",
            bluePlane: "wall",
            redPlane: "wall",
            sequence: {
              word: "EMBER",
              startPosition: "beta3",
              level: 3,
              turns: [1, "fl", 0, 0.5],
              flow: "smooth",
            },
            position: { x: -0.9, z: 0 },
            facingDegrees: 180,
          },
          {
            id: "apprentice",
            name: "Apprentice",
            characterId: "ch34",
            prop: PropType.STAFF,
            staffLengthCm: 120,
            effect: "none",
            effort: "anticipation",
            bluePlane: "wall",
            redPlane: "wall",
            // The same word stripped of everything hard: level 1, no turns.
            // A dancer marks a phrase by doing it small; a spinner marks it
            // by doing it flat. One beat behind, because she is reading him.
            sequence: {
              word: "EMBER",
              startPosition: "beta3",
              level: 1,
              turns: 0,
              flow: "smooth",
            },
            beatOffset: -1,
            position: { x: 3.5, z: 0 },
            facingDegrees: 180,
            // 2.6 m in 4 s is 0.65 m/s — a student's entrance, not a cue
            // sprint, and comfortably inside the 0.47–2.6 walk window. The
            // turn squares her to the wall grid the way the master already
            // stands.
            blocking: [
              { move: "stand", durationSeconds: 1.5 },
              { move: "walk", to: { x: 0.9, z: 0 }, facing: "travel", durationSeconds: 4 },
              {
                move: "turn",
                facing: { degrees: 180 },
                durationSeconds: 1,
                easing: "ease-in-out",
              },
              { move: "stand", durationSeconds: 7.5 },
            ],
          },
        ],
      },
      effectPresets: { charcoal: "charcoal-banked-ember" },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 2.5 },
          {
            move: "push-in",
            amount: { meters: 2 },
            durationSeconds: 6,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 5.5 },
        ],
      },
    },
    {
      id: "first-sparks",
      title: "First sparks",
      intent:
        "The apprentice takes the phrase alone at level 2 and strays onto the wheel plane mid-figure. The master marks it, steps back, and turns to watch.",
      durationSeconds: 14,
      transition: { kind: "cut" },
      location: {
        environmentId: "ember",
        showStage: false,
        // Both grids up: the wall she was taught on, and the wheel she finds.
        visiblePlanes: ["wall", "wheel"],
      },
      performance: {
        bpm: 84,
        formation: "custom",
        performers: [
          {
            id: "apprentice",
            name: "Apprentice",
            characterId: "ch34",
            prop: PropType.STAFF,
            staffLengthCm: 120,
            effect: "sparkles",
            effort: "press",
            bluePlane: "wall",
            redPlane: "wall",
            // Halfway up the ladder: whole turns only, alternating with
            // rests. Ten steps, so the per-step overrides below sit at
            // indices 4–7 of 0–9.
            sequence: {
              word: "EMBER",
              startPosition: "beta3",
              level: 2,
              turns: [1, 0],
              flow: "smooth",
            },
            // The wobble: one hand strays onto the wheel at step 4, both
            // hands commit through 5–7, and steps 8–9 fall back to the wall
            // she was taught on. First flight, then the landing.
            stepPlanes: [
              { step: 4, hand: "blue", plane: "wheel" },
              { step: 5, hand: "blue", plane: "wheel" },
              { step: 5, hand: "red", plane: "wheel" },
              { step: 6, hand: "blue", plane: "wheel" },
              { step: 6, hand: "red", plane: "wheel" },
              { step: 7, hand: "blue", plane: "wheel" },
              { step: 7, hand: "red", plane: "wheel" },
            ],
            position: { x: 0, z: 0.4 },
            facingDegrees: 180,
          },
          {
            id: "master",
            name: "Master",
            characterId: "ch10",
            prop: PropType.STAFF,
            staffLengthCm: 150,
            effect: "charcoal",
            effort: "glide",
            bluePlane: "wall",
            redPlane: "wall",
            // The echo reverses for good here: the master carries the
            // marked phrase now, a beat behind her.
            sequence: {
              word: "EMBER",
              startPosition: "beta3",
              level: 1,
              turns: 0,
              flow: "smooth",
            },
            beatOffset: -1,
            position: { x: -0.9, z: 0 },
            facingDegrees: 180,
            // 1.77 m in 3 s is 0.59 m/s — ceding the floor, not leaving it.
            // The turn aims him at her mark: from (-2.2, -1.2) toward
            // (0, 0.4) is atan2(2.2, 1.6), 54 degrees.
            blocking: [
              { move: "stand", durationSeconds: 1 },
              {
                move: "walk",
                to: { x: -2.2, z: -1.2 },
                facing: "travel",
                durationSeconds: 3,
              },
              {
                move: "turn",
                facing: { degrees: 54 },
                durationSeconds: 1.6,
                easing: "ease-in-out",
              },
              { move: "stand", durationSeconds: 8.4 },
            ],
          },
        ],
      },
      // Sparkles wears its defaults: the scene-scoped preset map has one
      // charcoal slot, and it belongs to the master's banked coals.
      effectPresets: { charcoal: "charcoal-banked-ember" },
      camera: {
        subject: { kind: "group" },
        shotSize: "medium",
        // Low, because first turns should feel bigger than they are.
        angle: "low",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 2 },
          {
            move: "orbit",
            direction: "cw",
            amount: { degrees: 30 },
            durationSeconds: 5,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 7 },
        ],
      },
    },
    {
      id: "handed-down",
      title: "Handed down",
      intent:
        "Before the seated house: the apprentice performs the master's full figure on fire, and the master marks it in smoke a beat behind her.",
      durationSeconds: 17,
      transition: { kind: "fade-through-black", durationSeconds: 1.2 },
      location: { environmentId: "celestial", showStage: false, showAudience: true },
      performance: {
        bpm: 96,
        formation: "custom",
        performers: [
          {
            id: "apprentice",
            name: "Apprentice",
            characterId: "ch34",
            // Cast explicitly, not left to the fire auto-equip: the film's
            // whole turn is this prop change.
            prop: PropType.FIRE_DOUBLE_STAFF,
            staffLengthCm: 120,
            effect: "fire",
            effort: "glide",
            // The master's directive from scene one, verbatim — word, level,
            // and turn figure. This is the handoff.
            sequence: {
              word: "EMBER",
              startPosition: "beta3",
              level: 3,
              turns: [1, "fl", 0, 0.5],
              flow: "smooth",
            },
            position: { x: 0, z: 0.6 },
            facingDegrees: 0,
          },
          {
            id: "master",
            name: "Master",
            characterId: "ch10",
            prop: PropType.STAFF,
            staffLengthCm: 150,
            effect: "smoke",
            effort: "glide",
            // And the apprentice's scene-two directive, verbatim, down to
            // the beat behind. Off the centre line — dead upstage of her
            // would hide him on the camera axis the way Back to Back hides
            // its far performer on purpose.
            sequence: {
              word: "EMBER",
              startPosition: "beta3",
              level: 1,
              turns: 0,
              flow: "smooth",
            },
            beatOffset: -1,
            position: { x: -1.7, z: -3.3 },
            facingDegrees: 0,
          },
        ],
      },
      effectPresets: { fire: "fire-classic", smoke: "smoke-spirit-veil" },
      camera: {
        // The seated crowd sits at +Z and both performers face it, so the
        // camera stands behind the house looking over its heads — the
        // Figures staging. Aiming at a point just upstage of the apprentice
        // backs the extreme-wide rig off far enough to hold the seating arc
        // in the lower frame with both performers clear above it.
        subject: { kind: "point", position: [0, 0.9, -0.8] },
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
            move: "push-in",
            amount: { meters: 2.5 },
            durationSeconds: 5,
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 5 },
        ],
      },
    },
  ],
};
