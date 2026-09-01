import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * A five-point star facing the audience, revealed from its tip outward.
 *
 * The audience sits on the negative-Z side (every director camera fronts the
 * group from -Z, per computeFramingScene's wall-plane eye), so the tip of the
 * star is the most negative Z and the back pair is the most positive. All five
 * face 180 degrees, straight down the barrel of the lens.
 *
 * Sequence casting:
 * - DEFDEF is together-opposite hand timing end to end. D, E and F are the
 *   whole of Type 1's Together-Opposite group, so a word built only from them
 *   cannot drift into another timing.
 * - SAILOR and ORBITS both reach zero handpath and zero prop reversals, which
 *   is what keeps the fans gliding and the buugeng linear.
 * - The second fan and the second buugeng mirror the first of their pair.
 */
export const starOfFiveFilm: FilmDirectorInput = {
  version: 5,
  id: "star-of-five-r1",
  title: "Star of Five",
  brief:
    "Five performers hold a star facing the audience under the clouds. The camera opens tight on the baton at the tip and pulls back until the whole star is in frame.",
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  scenes: [
    {
      id: "star-reveal",
      title: "Star reveal",
      intent:
        "Open on the LED baton alone, then pull back and rise to find two fans behind him and two buugeng behind them, all on the wall plane.",
      durationSeconds: 16,
      location: { environmentId: "celestial", showStage: true },
      performance: {
        bpm: 72,
        formation: "custom",
        performers: [
          {
            id: "baton-tip",
            name: "Baton tip",
            characterId: "ch01",
            prop: PropType.CAPSULE_BATON,
            effect: "led",
            effort: "linear",
            sequence: { word: "DEFDEF" },
            position: { x: 0, z: -2.6 },
            facingDegrees: 180,
            leftPlane: "wall",
            rightPlane: "wall",
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
            leftPlane: "wall",
            rightPlane: "wall",
          },
          {
            id: "fan-right",
            name: "Fan right",
            // Cast off the rendered models, not the catalog names — several
            // Mixamo names contradict their meshes (ch12 "Luna" reads
            // masculine, ch18 "Nora" reads masculine, ch21 "Felix" reads
            // feminine). ch07 and ch22 both read feminine on screen, which is
            // what the fan pair needs.
            characterId: "ch22",
            prop: PropType.FAN,
            effect: "silk",
            effort: "glide",
            sequence: { mirrorOf: "fan-left" },
            position: { x: 2.47, z: -0.8 },
            facingDegrees: 180,
            leftPlane: "wall",
            rightPlane: "wall",
          },
          {
            id: "buugeng-left",
            name: "Buugeng left",
            characterId: "ch10",
            prop: PropType.BUUGENG,
            effect: "bubbles",
            effort: "linear",
            sequence: { word: "ORBITS" },
            position: { x: -1.53, z: 2.1 },
            facingDegrees: 180,
            leftPlane: "wall",
            rightPlane: "wall",
          },
          {
            id: "buugeng-right",
            name: "Buugeng right",
            // ch10 and ch24 both read masculine and have visibly different
            // builds, so the back pair is two different guys on sight.
            characterId: "ch24",
            prop: PropType.BUUGENG,
            effect: "bubbles",
            effort: "linear",
            sequence: { mirrorOf: "buugeng-left" },
            position: { x: 1.53, z: 2.1 },
            facingDegrees: 180,
            leftPlane: "wall",
            rightPlane: "wall",
          },
        ],
      },
      effectPresets: {
        led: "led-capsule-classic",
        silk: "silk-royal",
        bubbles: "bubbles-iridescent",
      },
      camera: {
        subject: { kind: "performer", performerId: "baton-tip", height: 1.55 },
        shotSize: "close-up",
        angle: "eye",
        position: "front",
        moves: [
          { move: "hold", durationSeconds: 2.5 },
          // Four metres, not six or nine: the subject stays the baton at the
          // tip, so every extra metre shrinks all five performers together.
          // Four clears the back pair while the cast still fills the frame
          // instead of shrinking into an island of stage floor.
          {
            move: "pull-back",
            amount: { meters: 4 },
            durationSeconds: 9.5,
            easing: "ease-out",
          },
          // Rising while still aimed at the tip tilts the lens down, which is
          // what separates the five points in depth — from eye level a star
          // read head-on collapses into a row. Kept to one metre: past that
          // the tilt buries the bottom half of the frame in empty stage.
          {
            move: "crane",
            direction: "up",
            amount: { meters: 1 },
            durationSeconds: 4,
          },
        ],
      },
    },
  ],
};
