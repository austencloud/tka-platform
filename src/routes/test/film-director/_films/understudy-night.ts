import type { FilmDirectorInput } from "../_lib/film-director-schema";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * The constraint-drama film. Each scene stresses a different corner of the
 * directive grammar: a pinned lead with sameAs/not understudies, a distinct
 * draw that exactly saturates the eight-effort catalog, a two-performer
 * mirror built entirely from sameAs (including the plane axes), and an
 * odd-one-out cast where one performer is excluded from the group's pool.
 */
export const understudyNightFilm: FilmDirectorInput = {
  version: 3,
  id: "understudy-night-r1",
  title: "Understudy Night",
  brief:
    "A pinned lead and four understudies who copy the lead's prop but are forbidden the lead's effect, a cast that draws all eight efforts at once, a sameAs mirror pair, and a closing circle with one deliberate outlier.",
  seed: { base: 47 },
  format: { width: 1920, height: 1080, fps: 30 },
  playback: { loop: true, autoplay: true },
  scenes: [
    {
      id: "lead-and-copies",
      title: "The lead and the copies",
      intent:
        "One pinned sword lead burns classic fire up front. The four understudies copy the lead's prop via sameAs, are barred from fire via not, and draw four different efforts around the lead's pinned punch.",
      durationSeconds: 10,
      location: { environmentId: "forest", showStage: true },
      performance: {
        bpm: 88,
        formation: "v-shape",
        cast: {
          count: 5,
          // Cast override ids follow the resolver's performer-N naming;
          // performer-1 is the lead the sameAs default points at.
          defaults: {
            avatarId: { pick: "any" },
            prop: { sameAs: "performer-1" },
            effect: { not: "fire" },
            effort: { pick: "distinct" },
          },
          performers: [
            {
              id: "performer-1",
              name: "Lead",
              avatarId: "y-bot",
              prop: PropType.SWORD,
              effect: "fire",
              effort: "punch",
            },
          ],
        },
      },
      effectPresets: { fire: "fire-classic" },
      camera: {
        subject: { kind: "performer", performerId: "performer-1", height: 1.35 },
        shotSize: "close-up",
        angle: "low",
        position: "front",
        moves: [
          { move: "push-in", amount: { meters: 2 }, easing: "ease-out" },
          {
            move: "orbit",
            direction: "cw",
            amount: { degrees: 70 },
            easing: "ease-in-out",
          },
        ],
      },
    },
    {
      id: "all-eight-efforts",
      title: "All eight efforts",
      intent:
        "Eight performers, eight efforts, one distinct draw. The pool is exactly the size of the cast, so every effort in the catalog appears exactly once.",
      durationSeconds: 9,
      transition: { kind: "environment-dissolve", durationSeconds: 0.9 },
      location: { environmentId: "rainbow", showStage: true },
      performance: {
        bpm: 96,
        formation: "line",
        cast: {
          count: 8,
          defaults: {
            avatarId: { pick: "any" },
            prop: PropType.STAFF,
            effect: "led",
            effort: { pick: "distinct" },
          },
        },
      },
      effectPresets: { led: { pick: "any" } },
      camera: {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          {
            move: "pan",
            direction: "left",
            amount: { degrees: 30 },
            easing: "ease-in-out",
          },
          { move: "hold", durationSeconds: 2 },
          { move: "pull-back", amount: { meters: 3 }, easing: "ease-in" },
        ],
      },
    },
    {
      id: "mirror-pair",
      title: "Mirror pair",
      intent:
        "Stage left is authored in full. Stage right is nothing but sameAs: prop, effect, effort, and both hand planes copied from the original, with only the staff length drawn distinct so the mirror is one detail off.",
      durationSeconds: 8,
      transition: { kind: "cut" },
      location: { environmentId: "blossom", showStage: true },
      performance: {
        bpm: 72,
        formation: "stage-lr",
        cast: {
          count: 2,
          performers: [
            {
              id: "performer-1",
              name: "Original",
              avatarId: "x-bot",
              prop: PropType.STAFF,
              effect: "petals",
              effort: "glide",
              bluePlane: "wheel",
              redPlane: "floor",
              staffLengthCm: { pick: "distinct", from: [110, 150] },
            },
            {
              id: "performer-2",
              name: "Mirror",
              avatarId: "ch01",
              prop: { sameAs: "performer-1" },
              effect: { sameAs: "performer-1" },
              effort: { sameAs: "performer-1" },
              bluePlane: { sameAs: "performer-1" },
              redPlane: { sameAs: "performer-1" },
              staffLengthCm: { pick: "distinct", from: [110, 150] },
            },
          ],
        },
      },
      effectPresets: { petals: { pick: "any" } },
      camera: {
        subject: { kind: "group" },
        // Wide, not medium: stage-lr splits the pair across the whole stage,
        // and a 0.75x medium crops both mirrors to the frame edges.
        shotSize: "wide",
        angle: "eye",
        position: "front",
        moves: [
          { move: "push-in", amount: { meters: 1.5 }, easing: "ease-in-out" },
        ],
      },
    },
    {
      id: "odd-one-out",
      title: "Odd one out",
      intent:
        "Five performers share a silk look while the sixth draws from a pool the group never touches, so the outlier reads on camera without any staging change.",
      durationSeconds: 9,
      transition: { kind: "fade-through-black", durationSeconds: 1 },
      location: { environmentId: "autumn", showStage: true },
      performance: {
        bpm: 80,
        formation: "circle",
        cast: {
          count: 6,
          defaults: {
            avatarId: { pick: "any" },
            prop: PropType.TRIAD,
            effect: "silk",
            effort: "elastic",
          },
          // Only the last slot needs an override; performer-6 is the outlier.
          performers: [
            {
              id: "performer-6",
              name: "Outlier",
              effect: { pick: "any", from: ["fire", "zap", "ink"] },
              effort: "bounce",
            },
          ],
        },
      },
      effectPresets: { silk: { pick: "any" } },
      camera: { preset: "group-orbit", orbitDegrees: 160 },
    },
  ],
};
