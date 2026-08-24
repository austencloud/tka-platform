import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * The seeded-chance film. Almost nothing is pinned: environments, formations,
 * props, effects, efforts, and planes are drawn from pools by the seeded
 * resolver. The same seed always produces the same film; bumping one axis in
 * the seed block rerolls only that axis. Shots 1 and 4 carry identical
 * directives on different shot ids, which proves each shot draws from its
 * own stream.
 */
const ROLLABLE_PROPS = [
  PropType.STAFF,
  PropType.CLUB,
  PropType.TRIAD,
  PropType.SWORD,
  PropType.FIRE_DOUBLE_STAFF,
];

const ROLLABLE_EFFECTS = [
  "trails",
  "fire",
  "led",
  "zap",
  "sparkles",
  "ghost",
  "bubbles",
  "petals",
  "smoke",
  "ink",
  "silk",
  "pulse",
];

export const chanceSuiteFilm: FilmDirectorInput = {
  version: 2,
  id: "chance-suite-r1",
  title: "Chance Suite",
  brief:
    "A film the seed writes: environment, formation, prop, effect, effort, and both hand planes are all drawn from pools. Rerolling means bumping one integer in the seed block, and the opening and closing shots share directives but land on different rolls.",
  seed: { base: 20260824 },
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  shots: [
    {
      id: "cold-open-rolled",
      title: "Cold open, rolled",
      intent:
        "Four performers whose look, effort, and hand planes were all drawn by the resolver, in an environment and formation it also chose.",
      durationSeconds: 9,
      scene: { environmentId: { pick: "any" }, showStage: true },
      performance: {
        bpm: 82,
        formation: { pick: "any" },
        cast: {
          count: 4,
          defaults: {
            avatarId: { pick: "any" },
            prop: { pick: "any", from: ROLLABLE_PROPS },
            effect: { pick: "any", from: ROLLABLE_EFFECTS },
            effort: { pick: "any" },
            bluePlane: { pick: "any" },
            redPlane: { pick: "any" },
          },
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 1.5 },
          { move: "push-in", amount: { meters: 3 }, easing: "ease-in-out" },
        ],
      },
    },
    {
      id: "distinct-everything",
      title: "Distinct everything",
      intent:
        "Five performers where the distinct draws guarantee no repeats: five different props exactly saturate the pool, and effects, efforts, and blue planes each differ across the cast.",
      durationSeconds: 10,
      transition: { kind: "environment-dissolve", durationSeconds: 0.9 },
      scene: {
        environmentId: { pick: "any", from: ["cosmic", "celestial", "rainbow"] },
        showStage: true,
      },
      performance: {
        bpm: 90,
        formation: "circle",
        cast: {
          count: 5,
          defaults: {
            avatarId: { pick: "any" },
            prop: { pick: "distinct", from: ROLLABLE_PROPS },
            effect: { pick: "distinct", from: ROLLABLE_EFFECTS },
            effort: { pick: "distinct" },
            bluePlane: { pick: "distinct" },
            redPlane: "wall",
          },
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "medium",
        angle: "high",
        position: { degrees: -40 },
        moves: [
          {
            move: "orbit",
            direction: "cw",
            amount: { degrees: 100 },
            easing: "ease-in-out",
          },
        ],
      },
    },
    {
      id: "loaded-dice",
      title: "Loaded dice",
      intent:
        "Chance with the pools narrowed and a count canon underneath: six performers offset by one count each, effects loaded toward three options, and step four's hands rolled onto planes the wall is excluded from.",
      durationSeconds: 10,
      transition: { kind: "cut" },
      scene: {
        environmentId: { not: ["void", "winter"] },
        showStage: true,
      },
      performance: {
        bpm: 86,
        formation: "tunnel-stack",
        cast: {
          count: 6,
          defaults: {
            avatarId: { pick: "any" },
            prop: PropType.CLUB,
            effect: { oneOf: ["fire", "led", "trails"] },
            effort: { pick: "any", from: ["glide", "press", "elastic"] },
            stepPlanes: [
              { step: 4, hand: "blue", plane: { oneOf: ["wheel", "floor"] } },
              { step: 4, hand: "red", plane: { not: "wall" } },
            ],
          },
          // Id-less overrides fill cast slots in order: a one-count canon
          // down the tunnel.
          performers: [
            { beatOffset: 0 },
            { beatOffset: -1 },
            { beatOffset: -2 },
            { beatOffset: -3 },
            { beatOffset: -4 },
            { beatOffset: -5 },
          ],
        },
      },
      camera: {
        subject: { kind: "group" },
        shotSize: "medium",
        angle: "low",
        position: "behind",
        moves: [
          {
            move: "orbit",
            direction: "cw",
            amount: { degrees: 180 },
            easing: "ease-in-out",
          },
        ],
      },
    },
    {
      id: "reroll-finale",
      title: "Reroll finale",
      intent:
        "The same directives as the cold open on a different shot id and a bigger cast. Every axis draws from its own per-shot stream, so this is a fresh roll of the same instructions.",
      durationSeconds: 9,
      transition: { kind: "fade-through-black", durationSeconds: 1.1 },
      scene: { environmentId: { pick: "any" }, showStage: true },
      performance: {
        bpm: 82,
        formation: { pick: "any" },
        cast: {
          count: 8,
          defaults: {
            avatarId: { pick: "any" },
            prop: { pick: "any", from: ROLLABLE_PROPS },
            effect: { pick: "any", from: ROLLABLE_EFFECTS },
            effort: { pick: "any" },
            bluePlane: { pick: "any" },
            redPlane: { pick: "any" },
          },
        },
      },
      camera: { preset: "group-orbit", orbitDegrees: 200 },
    },
  ],
};
