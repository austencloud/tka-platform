import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * The plane-language showcase. Every scene leans on an axis that shipped in
 * the 2026-08-24 plane pass: whole-cast hand planes, distinct-plane draws,
 * per-step scrambles, and dictated grid visibility.
 */
export const ninePlanesFilm: FilmDirectorInput = {
  version: 5,
  id: "nine-planes-r1",
  title: "Nine Planes",
  brief:
    "Four scenes that put the plane grammar on camera: a whole-cast wheel circle, a distinct-plane draw where no two performers match, a mid-phrase scramble driven by per-step overrides, and a split shield wall with its grids dictated visible.",
  seed: { base: 9 },
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  scenes: [
    {
      id: "wheelhouse",
      title: "Wheelhouse",
      intent:
        "Eight performers run the same phrase entirely in the wheel plane while the wheel grid stays visible as the only scenery.",
      durationSeconds: 9,
      location: {
        environmentId: "void",
        showStage: true,
        visiblePlanes: ["wheel"],
      },
      performance: {
        bpm: 76,
        formation: "circle",
        cast: {
          count: 8,
          defaults: {
            characterId: { pick: "any" },
            prop: PropType.STAFF,
            effect: "trails",
            effort: "glide",
            leftPlane: "wheel",
            rightPlane: "wheel",
          },
        },
      },
      effectPresets: { trails: { pick: "any" } },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: { degrees: 25 },
        moves: [
          {
            move: "orbit",
            direction: "ccw",
            amount: { degrees: 120 },
            easing: "ease-in-out",
          },
        ],
      },
    },
    {
      id: "no-two-alike",
      title: "No two alike",
      intent:
        "A line of eight where every performer's blue hand draws a different plane from the nine-plane catalog, and every red hand draws its own as well.",
      durationSeconds: 9,
      transition: { kind: "environment-dissolve", durationSeconds: 0.9 },
      location: { environmentId: "celestial", showStage: true },
      performance: {
        bpm: 84,
        formation: "line",
        cast: {
          count: 8,
          defaults: {
            characterId: { pick: "any" },
            prop: PropType.CLUB,
            effect: "led",
            effort: "press",
            leftPlane: { pick: "distinct" },
            rightPlane: { pick: "distinct" },
          },
        },
      },
      effectPresets: { led: { pick: "any" } },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "high",
        position: "front",
        moves: [
          {
            move: "pan",
            direction: "right",
            amount: { degrees: 35 },
            easing: "ease-in-out",
          },
          { move: "push-in", amount: { meters: 3 }, easing: "ease-out" },
        ],
      },
    },
    {
      id: "mid-phrase-scramble",
      title: "Mid-phrase scramble",
      intent:
        "Everyone starts on the wall plane, then per-step overrides throw individual hands onto planes drawn per performer, so the chevron breaks apart and reforms inside one phrase.",
      durationSeconds: 10,
      transition: { kind: "cut" },
      location: { environmentId: "ember", showStage: true },
      performance: {
        bpm: 92,
        formation: "v-shape",
        cast: {
          count: 8,
          defaults: {
            characterId: { pick: "any" },
            prop: PropType.STAFF,
            effect: "zap",
            effort: "punch",
            leftPlane: "wall",
            rightPlane: "wall",
            stepPlanes: [
              { step: 2, hand: "left", plane: { pick: "any" } },
              { step: 3, hand: "right", plane: { pick: "any" } },
              { step: 5, hand: "left", plane: { pick: "any" } },
              { step: 6, hand: "right", plane: { pick: "any" } },
            ],
          },
        },
      },
      effectPresets: { zap: { pick: "any" } },
      camera: {
        subject: { kind: "group" },
        // Wide with a modest push: a medium of this 8-person chevron plus a
        // 4m push ended on just the apex three, losing the scramble's shape.
        shotSize: "wide",
        angle: "high",
        position: "front",
        moves: [
          { move: "push-in", amount: { meters: 1.5 }, easing: "ease-in-out" },
        ],
      },
    },
    {
      id: "shield-wall",
      title: "Shield wall",
      intent:
        "The left half of the row works the left shield and the right half the right shield, with both shield grids dictated visible while the camera cranes down into the seam.",
      durationSeconds: 9,
      transition: { kind: "fade-through-black", durationSeconds: 1 },
      location: {
        environmentId: "winter",
        showStage: true,
        visiblePlanes: ["left-shield", "right-shield"],
      },
      performance: {
        bpm: 70,
        formation: "side-by-side",
        cast: {
          count: 8,
          defaults: {
            characterId: { pick: "any" },
            prop: PropType.CLUB,
            effect: "sparkles",
            effort: "press",
          },
          // Id-less overrides fill cast slots positionally: the left half of
          // the row works the left shield, the right half the right shield.
          performers: [
            { leftPlane: "left-shield", rightPlane: "left-shield" },
            { leftPlane: "left-shield", rightPlane: "left-shield" },
            { leftPlane: "left-shield", rightPlane: "left-shield" },
            { leftPlane: "left-shield", rightPlane: "left-shield" },
            { leftPlane: "right-shield", rightPlane: "right-shield" },
            { leftPlane: "right-shield", rightPlane: "right-shield" },
            { leftPlane: "right-shield", rightPlane: "right-shield" },
            { leftPlane: "right-shield", rightPlane: "right-shield" },
          ],
        },
      },
      effectPresets: { sparkles: { pick: "any" } },
      camera: {
        subject: { kind: "group" },
        // High, not top: a top angle stays overhead through the crane, and the
        // 45-degree shield grids read as edge-on lines from straight above.
        shotSize: "wide",
        angle: "high",
        position: "front",
        moves: [
          {
            move: "crane",
            direction: "down",
            amount: { meters: 2.5 },
            easing: "ease-in-out",
          },
          { move: "push-in", amount: { meters: 3 }, easing: "ease-out" },
        ],
      },
    },
  ],
};
