/**
 * Preview map — one place mapping each GameId to the little animated preview
 * that acts out its mechanic on the hub card's stage. Shared by GameCard (the
 * PlayHub wall) and LevelPicker (the game-detail screen) so both surfaces
 * show literally the same preview per game — never two hand-maintained
 * copies of this switch drifting apart.
 */
import type { Component } from "svelte";
import type { GameId } from "../../domain/arcade-types";
import PictographShufflePreview from "./PictographShufflePreview.svelte";
import OptionPulsePreview from "./OptionPulsePreview.svelte";
import SequenceFlowPreview from "./SequenceFlowPreview.svelte";
import PerformerPulsePreview from "./PerformerPulsePreview.svelte";
import LetterStreamPreview from "./LetterStreamPreview.svelte";
import MandalaBloomPreview from "./MandalaBloomPreview.svelte";
import CardToMandalaPreview from "./CardToMandalaPreview.svelte";
import MotionToMandalaPreview from "./MotionToMandalaPreview.svelte";
import TracePathsPreview from "./TracePathsPreview.svelte";

/* The two letter games are adjacent in the hub grid, so they deliberately
   get different previews (glyphs dealt vs an option grid being scanned) —
   twin cards would read as a rendering bug on the magnet surface. */
const GAME_PREVIEWS: Record<GameId, Component<{ accent: string }>> = {
  "pictograph-to-letter": PictographShufflePreview,
  "letter-to-pictograph": OptionPulsePreview,
  "valid-next": SequenceFlowPreview,
  "performer-word": PerformerPulsePreview,
  "speed-blitz": LetterStreamPreview,
  "mandala-match": MandalaBloomPreview,
  "card-to-mandala": CardToMandalaPreview,
  "motion-to-mandala": MotionToMandalaPreview,
  "trace-paths": TracePathsPreview,
};

export function getGamePreview(id: GameId): Component<{ accent: string }> {
  return GAME_PREVIEWS[id];
}
