// WindSystem.ts - Wind gust management for autumn leaves
// Handles periodic wind gusts that affect leaf movement

import type { WindState } from "../domain/models/autumn-models";
import { AUTUMN_WIND } from "../domain/constants/autumn-constants";

export interface WindSystem {
  state: WindState;
  initialize(): void;
  update(frameMultiplier: number): void;
  getWindForce(): number;
  triggerGust(direction?: number): void;
}

export function createWindSystem(): WindSystem {
  const state: WindState = {
    gust: {
      active: false,
      strength: 0,
      duration: 0,
      currentStrength: 0,
    },
    framesSinceLastGust: 0,
    nextGustIn: 0,
  };

  function initialize(): void {
    state.framesSinceLastGust = 0;
    state.nextGustIn = getNextGustInterval();
    state.gust = {
      active: false,
      strength: 0,
      duration: 0,
      currentStrength: 0,
    };
  }

  function getNextGustInterval(): number {
    return (
      AUTUMN_WIND.gustIntervalMin +
      Math.random() *
        (AUTUMN_WIND.gustIntervalMax - AUTUMN_WIND.gustIntervalMin)
    );
  }

  function getGustDuration(): number {
    return (
      AUTUMN_WIND.gustDurationMin +
      Math.random() *
        (AUTUMN_WIND.gustDurationMax - AUTUMN_WIND.gustDurationMin)
    );
  }

  function getGustStrength(): number {
    const magnitude =
      AUTUMN_WIND.gustStrengthMin +
      Math.random() *
        (AUTUMN_WIND.gustStrengthMax - AUTUMN_WIND.gustStrengthMin);
    // Random direction
    return Math.random() < 0.5 ? magnitude : -magnitude;
  }

  function update(frameMultiplier: number): void {
    state.framesSinceLastGust += frameMultiplier;

    // Check if it's time for a new gust
    if (!state.gust.active && state.framesSinceLastGust >= state.nextGustIn) {
      triggerGust();
    }

    // Update active gust
    if (state.gust.active) {
      state.gust.duration -= frameMultiplier;

      // Ease in/out the gust strength
      const totalDuration = getGustDuration(); // Approximate, for easing
      const progress = 1 - state.gust.duration / totalDuration;

      if (progress < 0.2) {
        // Ease in
        state.gust.currentStrength = state.gust.strength * (progress / 0.2);
      } else if (progress > 0.7) {
        // Ease out
        state.gust.currentStrength =
          state.gust.strength * ((1 - progress) / 0.3);
      } else {
        // Full strength
        state.gust.currentStrength = state.gust.strength;
      }

      // Apply decay
      state.gust.currentStrength *= 1 - AUTUMN_WIND.gustDecay * frameMultiplier;

      // Check if gust is done
      if (state.gust.duration <= 0) {
        state.gust.active = false;
        state.gust.currentStrength = 0;
        state.framesSinceLastGust = 0;
        state.nextGustIn = getNextGustInterval();
      }
    }
  }

  function getWindForce(): number {
    return state.gust.currentStrength;
  }

  function triggerGust(direction?: number): void {
    const strength = direction !== undefined ? direction : getGustStrength();

    state.gust = {
      active: true,
      strength,
      duration: getGustDuration(),
      currentStrength: 0, // Will ramp up
    };
  }

  return {
    get state() {
      return state;
    },
    initialize,
    update,
    getWindForce,
    triggerGust,
  };
}
