/**
 * SakuraWindSystem - Gentle wind gust management for cherry blossoms
 *
 * Unlike Autumn's more dramatic gusts, Sakura wind is:
 * - Less frequent (longer calm periods)
 * - Gentler (lower strength)
 * - Has ambient drift (constant subtle movement)
 * - Eases in/out smoothly for natural feel
 */

import {
  SAKURA_WIND,
  SAKURA_WIND_MOBILE,
} from "../domain/constants/sakura-constants";

export interface SakuraWindState {
  gust: {
    active: boolean;
    strength: number;
    duration: number;
    totalDuration: number;
    currentStrength: number;
  };
  framesSinceLastGust: number;
  nextGustIn: number;
  ambientPhase: number;
}

export interface SakuraWindSystem {
  state: SakuraWindState;
  initialize(): void;
  update(frameMultiplier: number): void;
  getWindForce(): number;
  triggerGust(direction?: number): void;
}

/**
 * Detect if viewport is mobile-sized
 */
function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

/**
 * Get wind constants based on viewport
 */
function getWindConstants() {
  return isMobile() ? SAKURA_WIND_MOBILE : SAKURA_WIND;
}

export function createSakuraWindSystem(): SakuraWindSystem {
  const state: SakuraWindState = {
    gust: {
      active: false,
      strength: 0,
      duration: 0,
      totalDuration: 0,
      currentStrength: 0,
    },
    framesSinceLastGust: 0,
    nextGustIn: 0,
    ambientPhase: Math.random() * Math.PI * 2,
  };

  function initialize(): void {
    state.framesSinceLastGust = 0;
    state.nextGustIn = getNextGustInterval();
    state.ambientPhase = Math.random() * Math.PI * 2;
    state.gust = {
      active: false,
      strength: 0,
      duration: 0,
      totalDuration: 0,
      currentStrength: 0,
    };
  }

  function getNextGustInterval(): number {
    const wind = getWindConstants();
    return (
      wind.gustIntervalMin +
      Math.random() * (wind.gustIntervalMax - wind.gustIntervalMin)
    );
  }

  function getGustDuration(): number {
    const wind = getWindConstants();
    return (
      wind.gustDurationMin +
      Math.random() * (wind.gustDurationMax - wind.gustDurationMin)
    );
  }

  function getGustStrength(): number {
    const wind = getWindConstants();
    const magnitude =
      wind.gustStrengthMin +
      Math.random() * (wind.gustStrengthMax - wind.gustStrengthMin);
    // Random direction with slight bias toward one side for realism
    const directionBias = Math.random() < 0.6 ? 1 : -1;
    return magnitude * directionBias;
  }

  function update(frameMultiplier: number): void {
    const wind = getWindConstants();

    state.framesSinceLastGust += frameMultiplier;

    // Update ambient wind phase (slow oscillation)
    state.ambientPhase += 0.002 * frameMultiplier;

    // Check if it's time for a new gust
    if (!state.gust.active && state.framesSinceLastGust >= state.nextGustIn) {
      triggerGust();
    }

    // Update active gust with smooth easing
    if (state.gust.active) {
      state.gust.duration -= frameMultiplier;

      // Calculate progress (0 to 1)
      const progress = 1 - state.gust.duration / state.gust.totalDuration;

      // Smooth ease in/out curve (sine-based for natural feel)
      let easedStrength: number;
      if (progress < 0.3) {
        // Ease in: smooth ramp up
        easedStrength = state.gust.strength * Math.sin((progress / 0.3) * (Math.PI / 2));
      } else if (progress > 0.7) {
        // Ease out: smooth ramp down
        const fadeProgress = (progress - 0.7) / 0.3;
        easedStrength = state.gust.strength * Math.cos(fadeProgress * (Math.PI / 2));
      } else {
        // Full strength with slight variation
        const variation = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
        easedStrength = state.gust.strength * variation;
      }

      state.gust.currentStrength = easedStrength;

      // Apply decay
      state.gust.currentStrength *= 1 - wind.gustDecay * frameMultiplier;

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
    const wind = getWindConstants();

    // Ambient wind: subtle constant drift with slow variation
    const ambientWind =
      wind.ambientStrength +
      Math.sin(state.ambientPhase) * wind.ambientVariation;

    // Combine ambient with gust
    return ambientWind + state.gust.currentStrength;
  }

  function triggerGust(direction?: number): void {
    const strength = direction !== undefined ? direction : getGustStrength();
    const duration = getGustDuration();

    state.gust = {
      active: true,
      strength,
      duration,
      totalDuration: duration,
      currentStrength: 0, // Will ramp up via easing
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
