import type { ISubInterpreter } from "../contracts/ISubInterpreter";
import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";
import { getAnimationPlaybackRef } from "../../../coordinators/animation-playback-ref.svelte";

const PLAY_PHRASES = new Set(["play", "resume", "start", "start playing"]);
const PAUSE_PHRASES = new Set(["pause", "pause playback"]);
const STOP_PHRASES = new Set(["stop playback", "stop playing", "stop animation"]);
const NEXT_PHRASES = new Set(["next", "next step", "next beat", "advance", "forward"]);
const PREV_PHRASES = new Set(["previous", "prev", "previous step", "prev step", "back step", "back one"]);
const FASTER_PHRASES = new Set(["faster", "speed up"]);
const SLOWER_PHRASES = new Set(["slower", "slow down"]);
const LOOP_PHRASES = new Set(["loop", "toggle loop"]);

/** "set bpm to 120" or "bpm 120" */
const BPM_PATTERN = /^(?:set )?bpm(?: to)?\s+(\d+)$/;

/** "jump to step 4" or "go to step 4" or "step 4" */
const JUMP_PATTERN = /^(?:jump to |go to )?step\s+(\d+)$/;

export class PlaybackSubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "playback";

  tryInterpret(text: string, _context: CommandContext): VoiceCommand | null {
    // Only match if a playback controller exists (sequence is loaded somewhere)
    const controller = getAnimationPlaybackRef();
    if (!controller) return null;

    if (PLAY_PHRASES.has(text)) {
      return this.build("play", "", text);
    }
    if (PAUSE_PHRASES.has(text)) {
      return this.build("pause", "", text);
    }
    if (STOP_PHRASES.has(text)) {
      return this.build("stop", "", text);
    }
    if (NEXT_PHRASES.has(text)) {
      return this.build("next", "", text);
    }
    if (PREV_PHRASES.has(text)) {
      return this.build("previous", "", text);
    }
    if (FASTER_PHRASES.has(text)) {
      return this.build("faster", "", text);
    }
    if (SLOWER_PHRASES.has(text)) {
      return this.build("slower", "", text);
    }
    if (LOOP_PHRASES.has(text)) {
      return this.build("loop", "", text);
    }

    // BPM pattern
    const bpmMatch = text.match(BPM_PATTERN);
    if (bpmMatch?.[1]) {
      return this.build("set_bpm", bpmMatch[1], text);
    }

    // Jump to step
    const jumpMatch = text.match(JUMP_PATTERN);
    if (jumpMatch?.[1]) {
      return this.build("jump", jumpMatch[1], text);
    }

    return null;
  }

  private build(action: string, target: string, rawText: string): VoiceCommand {
    return {
      category: "playback",
      action,
      target,
      rawText,
      confidence: 0.9,
    };
  }
}
