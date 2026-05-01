import { Spring, Tween } from "svelte/motion";
import {
  springPresets,
  beatAnimationVariants,
  interpolateVariant,
  buildTransform,
  buildFilter,
  type SpringPreset,
  type StepAnimationVariant,
  type AnimationVariantConfig,
} from "./presets";

export class StepAnimation {
  readonly progress: Spring<number>;
  private readonly variantConfig: AnimationVariantConfig;

  constructor(variant: StepAnimationVariant = "springPop") {
    const config = beatAnimationVariants[variant];
    if (!config) {
      throw new Error(`Unknown animation variant: ${variant}`);
    }
    this.variantConfig = config;
    this.progress = new Spring(0, config.spring);
  }

  trigger() {
    this.progress.target = 0;
    setTimeout(() => (this.progress.target = 1), 50);
  }

  reset() {
    this.progress.target = 0;
  }

  getValues() {
    return interpolateVariant(this.variantConfig, this.progress.current);
  }

  getStyle(): string {
    const values = interpolateVariant(
      this.variantConfig,
      this.progress.current
    );
    const parts: string[] = [];

    parts.push(`opacity: ${values.opacity}`);

    const transform = buildTransform({
      x: values.x,
      y: values.y,
      scale: values.scale,
    });
    if (transform) parts.push(`transform: ${transform}`);

    const filter = buildFilter({ blur: values.blur });
    if (filter) parts.push(`filter: ${filter}`);

    return parts.join("; ");
  }
}

export class PresenceAnimation {
  readonly opacity: Spring<number>;
  readonly scale: Spring<number>;

  constructor(preset: SpringPreset = "snappy") {
    const config = springPresets[preset];
    this.opacity = new Spring(0, config);
    this.scale = new Spring(0.95, config);
  }

  enter() {
    this.opacity.target = 1;
    this.scale.target = 1;
  }

  exit() {
    this.opacity.target = 0;
    this.scale.target = 0.95;
  }

  getStyle(): string {
    return `opacity: ${this.opacity.current}; transform: scale(${this.scale.current})`;
  }
}

export class GestureAnimation {
  readonly x: Spring<number>;
  readonly y: Spring<number>;

  constructor(preset: SpringPreset = "gentle") {
    const config = springPresets[preset];
    this.x = new Spring(0, config);
    this.y = new Spring(0, config);
  }

  snapTo(targetX: number = 0, targetY: number = 0) {
    this.x.target = targetX;
    this.y.target = targetY;
  }

  getStyle(): string {
    return `transform: translate(${this.x.current}px, ${this.y.current}px)`;
  }
}

export function createSpring(
  initialValue: number = 0,
  preset: SpringPreset = "snappy"
): Spring<number> {
  return new Spring(initialValue, springPresets[preset]);
}

export function createTween(
  initialValue: number = 0,
  duration: number = 250,
  easing?: (t: number) => number
): Tween<number> {
  const options: { duration: number; easing?: (t: number) => number } = {
    duration,
  };
  if (easing !== undefined) {
    options.easing = easing;
  }
  return new Tween(initialValue, options);
}

export class StaggeredAnimation {
  readonly animations: Spring<number>[];

  constructor(
    count: number,
    preset: SpringPreset = "snappy",
    private delayMs: number = 50
  ) {
    const config = springPresets[preset];
    this.animations = Array.from(
      { length: count },
      () => new Spring(0, config)
    );
  }

  triggerAll() {
    this.animations.forEach((anim, index) => {
      setTimeout(() => (anim.target = 1), index * this.delayMs);
    });
  }

  resetAll() {
    this.animations.forEach((anim) => {
      anim.target = 0;
    });
  }
}
