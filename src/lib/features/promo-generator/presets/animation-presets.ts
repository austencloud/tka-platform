/**
 * Animation Presets
 *
 * Pre-defined animation sequences for device mockup videos.
 * Each preset includes camera and device keyframes.
 */

import type { AnimationPreset } from "../domain/promo-models";

/**
 * Orbit Showcase
 *
 * Camera orbits around a stationary phone, showcasing the design
 * from multiple angles. Classic product showcase style.
 */
export const orbitShowcasePreset: AnimationPreset = {
  id: "orbit-showcase",
  name: "Orbit Showcase",
  description:
    "Camera orbits around the device, showcasing it from all angles",
  duration: 8,
  defaultCamera: {
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  defaultDevice: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  keyframes: [
    {
      time: 0,
      camera: { position: [0, 0, 5], lookAt: [0, 0, 0] },
      device: { rotation: [0, 0, 0] },
      easing: "power2.inOut",
    },
    {
      time: 0.25,
      camera: { position: [3.5, 1, 3.5], lookAt: [0, 0, 0] },
      device: { rotation: [0, Math.PI * 0.5, 0] },
      easing: "power2.inOut",
    },
    {
      time: 0.5,
      camera: { position: [0, 1.5, 5], lookAt: [0, 0, 0] },
      device: { rotation: [0, Math.PI, 0] },
      easing: "power2.inOut",
    },
    {
      time: 0.75,
      camera: { position: [-3.5, 1, 3.5], lookAt: [0, 0, 0] },
      device: { rotation: [0, Math.PI * 1.5, 0] },
      easing: "power2.inOut",
    },
    {
      time: 1,
      camera: { position: [0, 0, 5], lookAt: [0, 0, 0] },
      device: { rotation: [0, Math.PI * 2, 0] },
      easing: "power2.inOut",
    },
  ],
};

/**
 * Float & Rotate
 *
 * Device floats upward while slowly rotating. Dreamy, ethereal feel.
 * Similar to the VTG app promo style.
 */
export const floatRotatePreset: AnimationPreset = {
  id: "float-rotate",
  name: "Float & Rotate",
  description: "Device floats upward while gently rotating - dreamy aesthetic",
  duration: 10,
  defaultCamera: {
    position: [0, -0.5, 5],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  defaultDevice: {
    position: [0, -1, 0],
    rotation: [-0.2, 0, 0.1],
    scale: 1,
  },
  keyframes: [
    {
      time: 0,
      camera: { position: [0, -0.5, 5], lookAt: [0, -1, 0] },
      device: { position: [0, -1, 0], rotation: [-0.2, 0, 0.1] },
      easing: "power1.inOut",
    },
    {
      time: 0.3,
      camera: { position: [1, 0, 4.5], lookAt: [0, 0, 0] },
      device: { position: [0, 0, 0], rotation: [-0.1, Math.PI * 0.4, 0.05] },
      easing: "power1.inOut",
    },
    {
      time: 0.6,
      camera: { position: [-0.5, 0.5, 4.5], lookAt: [0, 0.5, 0] },
      device: { position: [0, 0.5, 0], rotation: [0, Math.PI * 0.8, 0] },
      easing: "power1.inOut",
    },
    {
      time: 1,
      camera: { position: [0, 1, 5], lookAt: [0, 1, 0] },
      device: { position: [0, 1, 0], rotation: [0.1, Math.PI * 1.2, -0.05] },
      easing: "power1.inOut",
    },
  ],
};

/**
 * Dramatic Reveal
 *
 * Starts with extreme close-up on the screen, pulls back dramatically
 * to reveal the full device. Great for showcasing app UI.
 */
export const dramaticRevealPreset: AnimationPreset = {
  id: "dramatic-reveal",
  name: "Dramatic Reveal",
  description:
    "Close-up on screen pulls back to reveal full device - cinematic",
  duration: 6,
  defaultCamera: {
    position: [0, 0, 1.5],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  defaultDevice: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  keyframes: [
    {
      time: 0,
      camera: { position: [0, 0, 1.5], lookAt: [0, 0, 0], fov: 50 },
      device: { rotation: [0, 0, 0] },
      easing: "power3.inOut",
    },
    {
      time: 0.4,
      camera: { position: [0, 0, 2.5], lookAt: [0, 0, 0], fov: 50 },
      device: { rotation: [0, 0, 0] },
      easing: "power2.inOut",
    },
    {
      time: 0.7,
      camera: { position: [1, 0.5, 4], lookAt: [0, 0, 0], fov: 50 },
      device: { rotation: [0, -0.3, 0] },
      easing: "power2.inOut",
    },
    {
      time: 1,
      camera: { position: [0, 0, 5], lookAt: [0, 0, 0], fov: 50 },
      device: { rotation: [0, 0, 0] },
      easing: "power2.out",
    },
  ],
};

/**
 * Hero Spin
 *
 * Fast, dynamic 360° spin with slight wobble.
 * Energetic, attention-grabbing style.
 */
export const heroSpinPreset: AnimationPreset = {
  id: "hero-spin",
  name: "Hero Spin",
  description: "Fast 360° spin with dynamic movement - energetic style",
  duration: 4,
  defaultCamera: {
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  defaultDevice: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  keyframes: [
    {
      time: 0,
      device: { rotation: [0, 0, 0], position: [0, 0, 0] },
      easing: "power4.inOut",
    },
    {
      time: 0.15,
      device: { rotation: [-0.1, Math.PI * 0.5, 0.05], position: [0, 0.1, 0] },
      easing: "power4.inOut",
    },
    {
      time: 0.35,
      device: { rotation: [0, Math.PI, 0], position: [0, 0.2, 0] },
      easing: "power4.inOut",
    },
    {
      time: 0.55,
      device: { rotation: [0.1, Math.PI * 1.5, -0.05], position: [0, 0.1, 0] },
      easing: "power4.inOut",
    },
    {
      time: 0.75,
      device: { rotation: [0, Math.PI * 1.8, 0], position: [0, 0.05, 0] },
      easing: "power4.inOut",
    },
    {
      time: 1,
      device: { rotation: [0, Math.PI * 2, 0], position: [0, 0, 0] },
      easing: "power4.out",
    },
  ],
};

/**
 * Gentle Tilt
 *
 * Subtle, gentle tilting motion. Perfect for elegant, minimal showcases.
 * Non-distracting, lets the UI speak for itself.
 */
export const gentleTiltPreset: AnimationPreset = {
  id: "gentle-tilt",
  name: "Gentle Tilt",
  description: "Subtle tilting motion - elegant, minimal style",
  duration: 8,
  defaultCamera: {
    position: [0, 0, 4.5],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  defaultDevice: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  keyframes: [
    {
      time: 0,
      device: { rotation: [0, 0, 0] },
      easing: "sine.inOut",
    },
    {
      time: 0.25,
      device: { rotation: [0.1, 0.15, 0.05] },
      easing: "sine.inOut",
    },
    {
      time: 0.5,
      device: { rotation: [0, 0, 0] },
      easing: "sine.inOut",
    },
    {
      time: 0.75,
      device: { rotation: [-0.1, -0.15, -0.05] },
      easing: "sine.inOut",
    },
    {
      time: 1,
      device: { rotation: [0, 0, 0] },
      easing: "sine.inOut",
    },
  ],
};

/**
 * Side Slide
 *
 * Device slides in from the side with rotation.
 * Great for transition-style intros.
 */
export const sideSlidePreset: AnimationPreset = {
  id: "side-slide",
  name: "Side Slide",
  description: "Device slides in from side with rotation - intro style",
  duration: 5,
  defaultCamera: {
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  defaultDevice: {
    position: [-5, 0, 0],
    rotation: [0, -Math.PI * 0.3, 0],
    scale: 1,
  },
  keyframes: [
    {
      time: 0,
      device: { position: [-5, 0, 0], rotation: [0, -Math.PI * 0.3, 0] },
      easing: "power3.out",
    },
    {
      time: 0.4,
      device: { position: [0, 0, 0], rotation: [0, 0, 0] },
      easing: "power2.inOut",
    },
    {
      time: 0.6,
      device: { position: [0, 0, 0], rotation: [0, 0.1, 0] },
      easing: "power2.inOut",
    },
    {
      time: 0.8,
      device: { position: [0, 0, 0], rotation: [0, -0.1, 0] },
      easing: "power2.inOut",
    },
    {
      time: 1,
      device: { position: [0, 0, 0], rotation: [0, 0, 0] },
      easing: "power2.out",
    },
  ],
};

/**
 * Space Float
 *
 * Slow, ethereal floating motion with gentle rotation.
 * Perfect for space/dark themed backgrounds.
 */
export const spaceFloatPreset: AnimationPreset = {
  id: "space-float",
  name: "Space Float",
  description: "Ethereal floating in space - perfect for dark themes",
  duration: 12,
  defaultCamera: {
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  defaultDevice: {
    position: [0, 0, 0],
    rotation: [-0.1, 0, 0.1],
    scale: 1,
  },
  keyframes: [
    {
      time: 0,
      camera: { position: [0, 0, 5] },
      device: { position: [0, 0, 0], rotation: [-0.1, 0, 0.1] },
      easing: "sine.inOut",
    },
    {
      time: 0.2,
      camera: { position: [0.3, 0.2, 5] },
      device: { position: [0.1, 0.15, 0], rotation: [-0.05, 0.2, 0.05] },
      easing: "sine.inOut",
    },
    {
      time: 0.4,
      camera: { position: [-0.2, 0.1, 4.8] },
      device: { position: [-0.1, 0.1, 0], rotation: [0, 0.4, 0] },
      easing: "sine.inOut",
    },
    {
      time: 0.6,
      camera: { position: [0.1, -0.1, 5.1] },
      device: { position: [0.05, -0.05, 0], rotation: [0.05, 0.6, -0.05] },
      easing: "sine.inOut",
    },
    {
      time: 0.8,
      camera: { position: [-0.15, 0.15, 4.9] },
      device: { position: [-0.05, 0.1, 0], rotation: [-0.05, 0.8, 0.05] },
      easing: "sine.inOut",
    },
    {
      time: 1,
      camera: { position: [0, 0, 5] },
      device: { position: [0, 0, 0], rotation: [-0.1, 1, 0.1] },
      easing: "sine.inOut",
    },
  ],
};

/**
 * All available presets
 */
export const ANIMATION_PRESETS: AnimationPreset[] = [
  orbitShowcasePreset,
  floatRotatePreset,
  dramaticRevealPreset,
  heroSpinPreset,
  gentleTiltPreset,
  sideSlidePreset,
  spaceFloatPreset,
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): AnimationPreset | undefined {
  return ANIMATION_PRESETS.find((preset) => preset.id === id);
}

/**
 * Default preset ID
 */
export const DEFAULT_PRESET_ID = "float-rotate";
