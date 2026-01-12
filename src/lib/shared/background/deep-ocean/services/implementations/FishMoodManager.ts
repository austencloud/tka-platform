import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { FishMood, MoodVisuals } from "../../domain/types/fish-personality-types";
import type { IFishMoodManager } from "../contracts/IFishMoodManager";
import {
  MOOD_DECAY_RATES,
  MOOD_VISUALS,
  MOOD_THRESHOLDS,
  STIMULUS_EFFECTS,
  METABOLISM_RATES,
} from "../../domain/constants/fish-constants";

/**
 * FishMoodManager - Manages emotional state transitions for fish
 *
 * Handles mood decay, energy/hunger metabolism, stimulus responses,
 * and provides visual modifiers for rendering.
 */
export class FishMoodManager implements IFishMoodManager {
  // Debug: Track mood changes (enable for debugging mood issues)
  private static DEBUG_MOOD = false;

  updateMood(fish: FishMarineLife, deltaSeconds: number): void {
    // Initialize if needed
    if (fish.mood === undefined) fish.mood = "calm";
    if (fish.moodTimer === undefined) fish.moodTimer = 0;
    if (fish.energy === undefined) fish.energy = 0.8;
    if (fish.hunger === undefined) fish.hunger = 0.2;
    if (fish.lastStimulusTime === undefined) fish.lastStimulusTime = 0;

    // Check if mood was manually set recently (from Fish Behavior Lab)
    // If so, skip ALL automatic mood processing for 5 seconds
    const manualSetAt = (fish as { _manualMoodSetAt?: number })._manualMoodSetAt;
    if (manualSetAt) {
      const elapsed = performance.now() - manualSetAt;
      if (elapsed < 5000) {
        // Only update timers, don't change mood
        fish.moodTimer += deltaSeconds;
        fish.lastStimulusTime += deltaSeconds;
        this.updateMetabolism(fish, deltaSeconds);
        return;
      }
    }

    // Update metabolism
    this.updateMetabolism(fish, deltaSeconds);

    // Update mood timer
    fish.moodTimer += deltaSeconds;
    fish.lastStimulusTime += deltaSeconds;

    // Check for automatic mood transitions based on state
    this.checkAutomaticTransitions(fish);

    // Decay current mood toward calm
    this.decayMood(fish, deltaSeconds);
  }

  getMoodVisuals(fish: FishMarineLife): MoodVisuals {
    const mood = fish.mood ?? "calm";
    return MOOD_VISUALS[mood];
  }

  setMood(fish: FishMarineLife, mood: FishMood): void {
    fish.mood = mood;
    fish.moodTimer = 0;
  }

  markStimulus(
    fish: FishMarineLife,
    type: "food" | "threat" | "friend" | "novelty"
  ): void {
    const effect = STIMULUS_EFFECTS[type];

    // Reset stimulus timer
    fish.lastStimulusTime = 0;

    // Apply energy cost
    if (fish.energy !== undefined) {
      fish.energy = Math.max(0, fish.energy - effect.energyCost);
    }

    // Apply hunger effect
    if (fish.hunger !== undefined) {
      fish.hunger = Math.max(0, Math.min(1, fish.hunger + effect.hungerEffect));
    }

    // Personality affects how fish respond to stimuli
    const personality = fish.personality;
    if (personality) {
      // Bold fish don't get as startled by threats
      if (type === "threat" && personality.boldness > 0.7) {
        // High boldness: might become curious instead of alert
        if (Math.random() < personality.boldness - 0.5) {
          this.setMood(fish, "curious");
          return;
        }
      }

      // Shy fish don't approach friends as readily
      if (type === "friend" && personality.sociability < 0.3) {
        // Low sociability: might stay calm instead of social
        if (Math.random() > personality.sociability + 0.2) {
          return; // No mood change
        }
      }

      // High curiosity fish get more excited by novelty
      if (type === "novelty" && personality.curiosity > 0.7) {
        this.setMood(fish, "curious");
        // Might trigger wobble
        fish.wobbleType = "curious_tilt";
        fish.wobbleTimer = 0.6; // Match WOBBLE_CONFIGS duration
        fish.wobbleIntensity = 1;
        return;
      }
    }

    // Default: apply the stimulus mood
    this.setMood(fish, effect.mood);
  }

  shouldTransitionBehavior(fish: FishMarineLife): boolean {
    const mood = fish.mood ?? "calm";

    // Alert fish should consider fleeing
    if (mood === "alert") return true;

    // Hungry fish should consider feeding
    if (mood === "hungry" && (fish.hunger ?? 0) > 0.6) return true;

    // Tired fish should consider resting
    if (mood === "tired") return true;

    // Social fish should consider approaching others
    if (mood === "social") return true;

    // Playful fish change behavior more often
    if (mood === "playful") return Math.random() < 0.3;

    return false;
  }

  private updateMetabolism(fish: FishMarineLife, deltaSeconds: number): void {
    // Energy drain
    let energyDrain = METABOLISM_RATES.energyDrain;

    // Faster movement drains more energy
    if (fish.speed > fish.baseSpeed * 1.5) {
      energyDrain *= METABOLISM_RATES.fastMovementDrain;
    }

    // Activity personality affects drain
    if (fish.personality?.activity) {
      // High activity fish burn energy faster but also recover faster
      energyDrain *= 0.8 + fish.personality.activity * 0.4;
    }

    // Resting recovers energy (behavior check would be better but mood is proxy)
    if (fish.mood === "tired" && fish.speed < fish.baseSpeed * 0.5) {
      fish.energy = Math.min(1, (fish.energy ?? 0) + METABOLISM_RATES.restRecovery * deltaSeconds);
    } else {
      fish.energy = Math.max(0, (fish.energy ?? 0) - energyDrain * deltaSeconds);
    }

    // Hunger increases over time
    fish.hunger = Math.min(1, (fish.hunger ?? 0) + METABOLISM_RATES.hungerIncrease * deltaSeconds);
  }

  private checkAutomaticTransitions(fish: FishMarineLife): void {
    const energy = fish.energy ?? 0.8;
    const hunger = fish.hunger ?? 0;
    const currentMood = fish.mood ?? "calm";
    const moodTimer = fish.moodTimer ?? 0;

    // Don't override moods that were just set (within 2 seconds)
    // This allows manual mood changes from the lab to persist
    if (moodTimer < 2 && currentMood !== "calm") {
      if (FishMoodManager.DEBUG_MOOD && currentMood !== "calm") {
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
          console.log(`🛡️ GUARD PROTECTED: ${currentMood} (timer: ${moodTimer.toFixed(3)})`);
        }
      }
      return;
    }

    // Tired overrides most moods when energy is very low
    if (energy < MOOD_THRESHOLDS.tiredEnergy && currentMood !== "alert") {
      if (currentMood !== "tired") {
        console.log(`⚡ TIRED OVERRIDE: energy ${energy.toFixed(2)} < threshold, changing ${currentMood} → tired`);
        this.setMood(fish, "tired");
        // Trigger tired wobble
        fish.wobbleType = "tired_drift";
        fish.wobbleTimer = 1.2; // Match WOBBLE_CONFIGS duration
        fish.wobbleIntensity = 1;
      }
      return;
    }

    // Hungry mood when hunger is high
    if (hunger > MOOD_THRESHOLDS.hungryLevel && currentMood === "calm") {
      this.setMood(fish, "hungry");
      return;
    }

    // Spontaneous playfulness (if enough energy and right personality)
    if (
      currentMood === "calm" &&
      energy > MOOD_THRESHOLDS.playfulMinEnergy &&
      fish.personality?.activity &&
      fish.personality.activity > 0.6
    ) {
      // Higher activity = more likely to become playful spontaneously
      if (Math.random() < 0.001 * fish.personality.activity) {
        this.setMood(fish, "playful");
        fish.wobbleType = "playful_wiggle";
        fish.wobbleTimer = 0.8; // Match WOBBLE_CONFIGS duration
        fish.wobbleIntensity = 1;
      }
    }
  }

  private decayMood(fish: FishMarineLife, deltaSeconds: number): void {
    const mood = fish.mood ?? "calm";
    if (mood === "calm") return; // Already at baseline

    const decayRate = MOOD_DECAY_RATES[mood];
    const moodTimer = fish.moodTimer ?? 0;

    // Minimum time before decay can start (gives manual changes time to be observed)
    const minMoodDuration = Math.max(3, 1 / decayRate);

    // Check if mood should decay back to calm
    // Decay probability increases with time and decay rate
    const decayChance = decayRate * deltaSeconds;

    if (moodTimer > minMoodDuration && Math.random() < decayChance) {
      // Check if there's a natural "step down" mood
      const nextMood = this.getDecayMood(mood, fish);
      if (FishMoodManager.DEBUG_MOOD) {
        console.log(`📉 DECAY: ${mood} → ${nextMood} (timer: ${moodTimer.toFixed(2)}, minDuration: ${minMoodDuration.toFixed(2)})`);
      }
      this.setMood(fish, nextMood);
    }
  }

  /**
   * Get the mood to decay to (allows step-down transitions)
   */
  private getDecayMood(currentMood: FishMood, fish: FishMarineLife): FishMood {
    // Most moods decay to calm
    // But some have intermediate states

    switch (currentMood) {
      case "alert":
        // Alert can decay to curious (still watchful) then calm
        if ((fish.moodTimer ?? 0) < 3) return "curious";
        return "calm";

      case "playful":
        // Playful can decay to calm, or tired if low energy
        if ((fish.energy ?? 1) < 0.4) return "tired";
        return "calm";

      case "social":
        // Social decays to calm
        return "calm";

      case "hungry":
        // Hungry persists until fed, but can decay if hunger drops
        if ((fish.hunger ?? 0) < 0.5) return "calm";
        return "hungry"; // Stay hungry

      case "tired":
        // Tired persists until energy recovers
        if ((fish.energy ?? 0) > 0.5) return "calm";
        return "tired"; // Stay tired

      case "curious":
        return "calm";

      default:
        return "calm";
    }
  }
}
