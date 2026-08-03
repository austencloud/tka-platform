/**
 * Trail settings for a trace drawn ON a printed card.
 *
 * Every other surface that reaches for HERO_TRAIL_PRESET (the home hero, the
 * composer's attract acts, the shape-matrix drill) paints onto a dark canvas
 * with nothing behind it, so that preset is tuned loud: a 9px glow and a wide
 * bright line, because at hero size on black the in-app default reads as
 * barely-there. The shop hero is the one surface where none of that holds. Its
 * canvas is a PRINTED CARD BACK — proof-mode white — and the printed mandala is
 * already there underneath. Loud is the wrong answer twice over: a glow halo on
 * white spreads into coloured fog instead of light, and a heavy line hides the
 * figure the trace is supposed to be revealing.
 *
 * So this preset is HERO_TRAIL_PRESET's opposite adjustment from the same
 * baseline, and its acceptance test is not "visible" but: mid-draw, can you
 * still read the printed mandala underneath the trail?
 *
 * Austen (2026-08-02): "because the card is on a white background we can
 * probably change the settings of the trails to be less overwhelming they're
 * kind of a little intense if you ask me."
 *
 * The colours are not a taste call. A proof-mode card back is a light surface
 * (card-back-theme-visuals forces `textColor: #111111` for every theme), so
 * CardBack renders its printed mandala with the LIGHT motion palette. Painting
 * the trail with the same two inks means the drawn stroke and the printed
 * stroke are literally the same colour, which is the claim the hero is making.
 */
import {
  TrailMode,
  TrailEffect,
  DEFAULT_TRAIL_SETTINGS,
  type TrailSettings,
} from "$lib/shared/animation-engine/domain/types/trail-types";
import {
  LIGHT_MOTION_BLUE_STROKE,
  LIGHT_MOTION_RED_STROKE,
} from "$lib/shared/mandala/domain/mandala-constants";

export const PRINTED_CARD_TRAIL_PRESET: TrailSettings = {
  ...DEFAULT_TRAIL_SETTINGS,
  mode: TrailMode.FADE,
  // NONE, not a small GLOW. A shadowBlur halo on a dark canvas reads as light;
  // on white it reads as a coloured smudge that veils the print underneath, and
  // even at 1px it left a visible haze around each prop. The stroke carries
  // itself here.
  effect: TrailEffect.NONE,
  glowBlur: 0,
  // Thin enough to sit ON the printed stroke instead of swallowing it. The
  // printed mandala draws at strokeWidth 2.5 on a ~200px figure.
  lineWidth: 2.5,
  // Shorter hang and a shorter visible tail: the point is watching the figure
  // get drawn, and a long tail on a white card just re-paints the whole print.
  fadeDurationMs: 1800,
  tailLength: 22,
  // The tail goes properly away instead of leaving a permanent wash.
  minOpacity: 0.05,
  maxOpacity: 0.85,
  blueColor: LIGHT_MOTION_BLUE_STROKE,
  redColor: LIGHT_MOTION_RED_STROKE,
};
