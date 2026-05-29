/**
 * PlaybackCommandHandler
 *
 * Executes playback voice commands (play, pause, next, faster, BPM, etc.)
 * by delegating to the global animation playback controller ref and
 * the animation visibility state manager for speed/BPM.
 */

import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../domain/voice-command-types";
import { getAnimationPlaybackRef } from "../../../coordinators/animation-playback-ref.svelte";
import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
import type { IVoiceCommandHandler } from "../contracts/types";

export class PlaybackCommandHandler implements IVoiceCommandHandler {
  readonly supportedCategories: VoiceCommandCategory[] = ["playback"];

  async execute(command: VoiceCommand): Promise<CommandResult> {
    const controller = getAnimationPlaybackRef();
    if (!controller) {
      return { success: false, message: "No sequence loaded" };
    }

    const visMgr = getAnimationVisibilityManager();

    switch (command.action) {
      case "play":
      case "pause":
        controller.togglePlayback();
        return { success: true, message: command.action === "play" ? "Playing" : "Paused" };

      case "stop":
        controller.stop();
        return { success: true, message: "Stopped" };

      case "next":
        controller.stepFullBeatForward();
        return { success: true, message: "Next step" };

      case "previous":
        controller.stepFullBeatBackward();
        return { success: true, message: "Previous step" };

      case "faster": {
        const currentSpeed = visMgr.getSpeed();
        const newSpeed = Math.min(3.0, currentSpeed * 1.25);
        visMgr.setSpeed(newSpeed);
        controller.setSpeed(newSpeed);
        return { success: true, message: `${visMgr.getBpm()} BPM` };
      }

      case "slower": {
        const currentSpeed = visMgr.getSpeed();
        const newSpeed = Math.max(0.1, currentSpeed * 0.8);
        visMgr.setSpeed(newSpeed);
        controller.setSpeed(newSpeed);
        return { success: true, message: `${visMgr.getBpm()} BPM` };
      }

      case "loop": {
        const currentMode = visMgr.getPlaybackMode();
        const newMode = currentMode === "continuous" ? "step" : "continuous";
        visMgr.setPlaybackMode(newMode);
        return { success: true, message: `Loop: ${newMode === "continuous" ? "ON" : "OFF"}` };
      }

      case "set_bpm": {
        const bpm = parseInt(command.target, 10);
        if (isNaN(bpm) || bpm < 6 || bpm > 180) {
          return { success: false, message: "BPM must be between 6 and 180" };
        }
        visMgr.setBpm(bpm);
        controller.setSpeed(bpm / 60);
        return { success: true, message: `${bpm} BPM` };
      }

      case "jump": {
        const step = parseInt(command.target, 10);
        if (isNaN(step) || step < 1) {
          return { success: false, message: "Invalid step number" };
        }
        controller.seekToStep(step);
        return { success: true, message: `Step ${step}` };
      }

      default:
        return { success: false, message: `Unknown playback action: ${command.action}` };
    }
  }
}
