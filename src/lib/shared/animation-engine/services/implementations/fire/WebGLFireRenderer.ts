/**
 * WebGLFireRenderer — Navier-Stokes Fluid Fire Simulation
 *
 * Creates a transparent WebGL2 canvas overlaid on the Canvas2D animation canvas.
 * Runs a multi-pass fluid simulation with combustion, buoyancy, and blackbody
 * rendering to produce physically-based fire at prop tip positions.
 *
 * Architecture per frame (~30 draw calls):
 *   1. Splat fuel + velocity at each tip position
 *   2. Advect velocity through itself
 *   3. Compute curl → apply vorticity confinement
 *   4. Apply buoyancy (temperature → upward force)
 *   5. Combustion: fuel burns → heat, fuel decays, cooling
 *   6. Compute divergence → Jacobi pressure solve (30 iterations)
 *   7. Gradient subtraction → divergence-free velocity
 *   8. Advect temperature + fuel through velocity field
 *   9. Display render: temperature → blackbody color
 *
 * References:
 *   - GPU Gems Ch. 38 (Harris, 2004)
 *   - andrewkchan.dev/posts/fire.html
 *   - Pavel Dobryakov's WebGL-Fluid-Simulation
 */

import type { IFireOverlayRenderer } from "../../contracts/IFireOverlayRenderer";
import type {
  FireFrameInput,
  FireOverlayConfig,
  FirePhysicsParams,
  PropTipData,
} from "../../../domain/types/FireTypes";
import { DEFAULT_PHYSICS } from "../../../domain/types/FireTypes";
import {
  VERTEX_SHADER,
  SPLAT_FRAG,
  ADVECTION_FRAG,
  CURL_FRAG,
  VORTICITY_FRAG,
  BUOYANCY_FRAG,
  COMBUSTION_FRAG,
  DIVERGENCE_FRAG,
  JACOBI_FRAG,
  GRADIENT_SUBTRACT_FRAG,
  CLEAR_FRAG,
  DISPLAY_FRAG,
} from "./FluidShaderSources";
import { WHITE_GAS_COLOR } from "../../../domain/types/BuiltInFuelSources";

const MAX_DPR = 2;
const JACOBI_ITERATIONS = 30;

/** Maps quality level to simulation grid resolution */
function qualityToResolution(quality: number): number {
  if (quality <= 2) return 128;
  if (quality === 3) return 192;
  return 256;
}

// ============================================================
// Framebuffer pair for ping-pong rendering
// ============================================================

interface DoubleFBO {
  read: FBOAttachment;
  write: FBOAttachment;
}

interface FBOAttachment {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
}

// ============================================================
// Shader program with cached uniform locations
// ============================================================

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
}

export class WebGLFireRenderer implements IFireOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private initialized = false;

  // Simulation grid resolution (independent of display resolution)
  private simWidth = 256;
  private simHeight = 256;

  // Display dimensions
  private dpr = 1;

  // Shader programs
  private splatProgram: ShaderProgram | null = null;
  private advectionProgram: ShaderProgram | null = null;
  private curlProgram: ShaderProgram | null = null;
  private vorticityProgram: ShaderProgram | null = null;
  private buoyancyProgram: ShaderProgram | null = null;
  private combustionProgram: ShaderProgram | null = null;
  private divergenceProgram: ShaderProgram | null = null;
  private jacobiProgram: ShaderProgram | null = null;
  private gradientSubtractProgram: ShaderProgram | null = null;
  private clearProgram: ShaderProgram | null = null;
  private displayProgram: ShaderProgram | null = null;

  // Double-buffered simulation fields
  private velocity: DoubleFBO | null = null;
  private pressure: DoubleFBO | null = null;
  private temperature: DoubleFBO | null = null;
  private fuel: DoubleFBO | null = null;
  private colorField: DoubleFBO | null = null;

  // Single-buffered fields (no ping-pong needed)
  private divergenceFBO: FBOAttachment | null = null;
  private curlFBO: FBOAttachment | null = null;

  // Timing
  private lastTime = 0;
  private reducedMotion = false;

  // Per-frame tip data cached for display pass (set during stepSimulation)
  private displayTipUVs: Float32Array = new Float32Array(32);  // 16 tips * 2 (x,y)
  private displayTipSpeeds: Float32Array = new Float32Array(16);
  private displayTipFlameScales: Float32Array = new Float32Array(16);
  private displayTipColors: Float32Array = new Float32Array(48); // 16 tips * 3 (r,g,b)
  private displayTipCount = 0;
  private displayCanvasWidth = 1;
  private displayCanvasHeight = 1;

  // Mutable physics parameters — set via config.physicsPreset or defaults
  private physics: FirePhysicsParams = { ...DEFAULT_PHYSICS };
  private readonly AMBIENT_TEMP = 0.0;
  private readonly BURN_TEMP = 0.1;

  initialize(container: HTMLElement, width: number, height: number): boolean {
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "2";
    this.canvas.style.background = "transparent";
    this.canvas.setAttribute("aria-hidden", "true");

    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);

    container.appendChild(this.canvas);

    this.gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });

    if (!this.gl) {
      console.warn("WebGL2 not available for fire overlay");
      this.cleanup();
      return false;
    }

    const gl = this.gl;

    // Float texture support is required for fluid simulation
    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      console.warn("EXT_color_buffer_float not available — fire simulation requires float FBOs");
      this.cleanup();
      return false;
    }
    gl.getExtension("OES_texture_float_linear");

    if (!this.compileAllPrograms()) {
      this.cleanup();
      return false;
    }

    this.createSimulationBuffers();

    // Blending for final display composite (premultiplied alpha source-over)
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA
    );
    gl.disable(gl.DEPTH_TEST);

    if (typeof window !== "undefined" && window.matchMedia) {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    this.lastTime = performance.now();
    this.initialized = true;
    return true;
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    // Simulation buffers stay at simWidth x simHeight — independent of display
  }

  renderFire(input: FireFrameInput, config: FireOverlayConfig): void {
    const gl = this.gl;
    if (!gl || !this.initialized) return;

    // Apply physics preset if provided
    if (config.physicsPreset) {
      this.physics = config.physicsPreset;
    }

    this.stepSimulation(input.tips, input, config);
    this.renderDisplay(config, input);
  }

  setQuality(level: number): void {
    const newRes = qualityToResolution(level);
    if (newRes !== this.simWidth && this.gl) {
      this.simWidth = newRes;
      this.simHeight = newRes;
      this.destroySimulationBuffers();
      this.createSimulationBuffers();
    }
  }

  dispose(): void {
    this.cleanup();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================
  // Simulation pipeline
  // ============================================================

  private stepSimulation(
    tips: PropTipData[],
    input: FireFrameInput,
    config: FireOverlayConfig
  ): void {
    const gl = this.gl!;
    const now = input.currentTime;
    let dt = Math.min((now - this.lastTime) / 1000, 0.033);
    if (this.reducedMotion) dt *= 0.2;
    this.lastTime = now;
    if (dt <= 0) dt = 0.016;

    gl.viewport(0, 0, this.simWidth, this.simHeight);
    gl.disable(gl.BLEND);

    const texelSize: [number, number] = [1.0 / this.simWidth, 1.0 / this.simHeight];

    // Cache tip UV positions for the display pass (wick core rendering)
    this.displayTipCount = Math.min(tips.length, 16);
    this.displayCanvasWidth = input.canvasWidth;
    this.displayCanvasHeight = input.canvasHeight;

    // 1. Inject fuel + velocity at tip positions, scaled by per-tip flameScale
    const p = this.physics;
    const baseSplatRadius = p.splatRadius;

    for (const tip of tips) {
      const uvX = tip.x / input.canvasWidth;
      const uvY = 1.0 - tip.y / input.canvasHeight;
      const fs = tip.flameScale;

      // Scale splat radius by flameScale (larger wicks = wider splat)
      this.physics.splatRadius = baseSplatRadius * fs;

      const fuelAmount = p.fuelAmount * config.intensity * fs;
      this.splat(this.fuel!, uvX, uvY, fuelAmount, 0, 0);

      // Velocity injection: fire trails BEHIND the wick (opposite to motion).
      // The upward bias is reduced for spinning — centrifugal force dominates.
      const velScale = config.velocityReactive ? p.velocityInjectScale : 0;
      const injectVx = -tip.velocityX * velScale * fs;
      const injectVy = tip.velocityY * velScale * fs + p.upwardBias * config.flameHeight * fs;
      this.splat(this.velocity!, uvX, uvY, injectVx, injectVy, 0);

      // Temperature injection: the wick is always hot
      this.splat(this.temperature!, uvX, uvY, p.temperatureInjection * config.intensity * fs, 0, 0);

      // Color injection: splat prop color into color field
      if ((config.colorBlend ?? 0) > 0 && input.propColors && this.colorField) {
        const propColor = input.propColors[tip.propIndex];
        if (propColor) {
          this.splat(this.colorField, uvX, uvY, propColor.r, propColor.g, propColor.b);
        }
      }
    }

    // Restore base splat radius after per-tip overrides
    this.physics.splatRadius = baseSplatRadius;

    // Cache tip UV positions + flameScales for the display pass (wick core rendering)
    for (let ti = 0; ti < this.displayTipCount; ti++) {
      const tip = tips[ti]!;
      this.displayTipUVs[ti * 2] = tip.x / input.canvasWidth;
      this.displayTipUVs[ti * 2 + 1] = 1.0 - tip.y / input.canvasHeight;
      this.displayTipSpeeds[ti] = tip.speed;
      this.displayTipFlameScales[ti] = tip.flameScale;
      if (input.propColors) {
        const color = input.propColors[tip.propIndex];
        if (color) {
          this.displayTipColors[ti * 3] = color.r;
          this.displayTipColors[ti * 3 + 1] = color.g;
          this.displayTipColors[ti * 3 + 2] = color.b;
        }
      }
    }

    // 2. Advect velocity through itself
    this.advect(this.velocity!, this.velocity!.read, p.velocityDissipation, dt, texelSize);

    // 3. Curl + vorticity confinement
    this.computeCurl(texelSize);
    this.applyVorticity(dt, texelSize, config.flameHeight);

    // 4. Buoyancy
    this.applyBuoyancy(dt, config.flameHeight);

    // 5. Combustion + cooling
    this.applyCombustion(dt, config.intensity);

    // 6. Pressure projection
    this.computeDivergence(texelSize);
    this.scalePressure();
    for (let i = 0; i < JACOBI_ITERATIONS; i++) {
      this.jacobiStep(texelSize);
    }
    this.gradientSubtract(texelSize);

    // 7. Advect temperature + fuel
    this.advect(this.temperature!, this.temperature!.read, p.temperatureDissipation, dt, texelSize);
    this.advect(this.fuel!, this.fuel!.read, p.fuelDissipation, dt, texelSize);
    if (this.colorField && (config.colorBlend ?? 0) > 0) {
      this.advect(this.colorField, this.colorField.read, p.fuelDissipation, dt, texelSize);
    }
  }

  // ============================================================
  // Simulation passes
  // ============================================================

  private splat(target: DoubleFBO, x: number, y: number, r: number, g: number, b: number): void {
    const gl = this.gl!;
    const prog = this.splatProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target.read.texture);
    gl.uniform1i(prog.uniforms.get("u_target")!, 0);
    gl.uniform2f(prog.uniforms.get("u_point")!, x, y);
    gl.uniform3f(prog.uniforms.get("u_splatValue")!, r, g, b);
    gl.uniform1f(prog.uniforms.get("u_radius")!, this.physics.splatRadius);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(target);
  }

  private advect(
    target: DoubleFBO,
    source: FBOAttachment,
    dissipation: number,
    dt: number,
    texelSize: [number, number]
  ): void {
    const gl = this.gl!;
    const prog = this.advectionProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_velocity")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(prog.uniforms.get("u_source")!, 1);

    gl.uniform2f(prog.uniforms.get("u_texelSize")!, texelSize[0], texelSize[1]);
    gl.uniform1f(prog.uniforms.get("u_dt")!, dt);
    gl.uniform1f(prog.uniforms.get("u_dissipation")!, dissipation);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(target);
  }

  private computeCurl(texelSize: [number, number]): void {
    const gl = this.gl!;
    const prog = this.curlProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_velocity")!, 0);
    gl.uniform2f(prog.uniforms.get("u_texelSize")!, texelSize[0], texelSize[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.curlFBO!.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private applyVorticity(dt: number, texelSize: [number, number], heightMult: number): void {
    const gl = this.gl!;
    const prog = this.vorticityProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_velocity")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curlFBO!.texture);
    gl.uniform1i(prog.uniforms.get("u_curl")!, 1);

    gl.uniform2f(prog.uniforms.get("u_texelSize")!, texelSize[0], texelSize[1]);
    gl.uniform1f(prog.uniforms.get("u_dt")!, dt);
    gl.uniform1f(prog.uniforms.get("u_strength")!, this.physics.vorticityStrength * heightMult);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity!.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(this.velocity!);
  }

  private applyBuoyancy(dt: number, heightMult: number): void {
    const gl = this.gl!;
    const prog = this.buoyancyProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_velocity")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.temperature!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_temperature")!, 1);

    gl.uniform1f(prog.uniforms.get("u_dt")!, dt);
    gl.uniform1f(prog.uniforms.get("u_buoyancy")!, this.physics.buoyancyStrength * heightMult);
    gl.uniform1f(prog.uniforms.get("u_ambientTemp")!, this.AMBIENT_TEMP);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity!.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(this.velocity!);
  }

  private applyCombustion(dt: number, intensityMult: number): void {
    const gl = this.gl!;
    const prog = this.combustionProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.temperature!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_temperature")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fuel!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_fuel")!, 1);

    gl.uniform1f(prog.uniforms.get("u_dt")!, dt);
    gl.uniform1f(prog.uniforms.get("u_burnRate")!, this.physics.burnRate * intensityMult);
    gl.uniform1f(prog.uniforms.get("u_burnTemp")!, this.BURN_TEMP);
    gl.uniform1f(prog.uniforms.get("u_fuelEfficiency")!, this.physics.fuelEfficiency);
    gl.uniform1f(prog.uniforms.get("u_coolingRate")!, this.physics.coolingRate);
    gl.uniform1f(prog.uniforms.get("u_ambientTemp")!, this.AMBIENT_TEMP);

    // Combustion shader outputs only updated temperature in .x channel.
    // Fuel decay is handled separately via advection dissipation (FUEL_DISSIPATION).
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.temperature!.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(this.temperature!);
  }

  private computeDivergence(texelSize: [number, number]): void {
    const gl = this.gl!;
    const prog = this.divergenceProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_velocity")!, 0);
    gl.uniform2f(prog.uniforms.get("u_texelSize")!, texelSize[0], texelSize[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceFBO!.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Scale pressure field by dissipation factor before Jacobi iterations */
  private scalePressure(): void {
    const gl = this.gl!;
    const prog = this.clearProgram!;
    gl.useProgram(prog.program);

    // We want to multiply pressure by PRESSURE_DISSIPATION, not set to a constant.
    // The clear shader sets a flat value — that's not what we want.
    // Instead, use advection with dt=0 and dissipation = PRESSURE_DISSIPATION.
    const advProg = this.advectionProgram!;
    gl.useProgram(advProg.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(advProg.uniforms.get("u_velocity")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pressure!.read.texture);
    gl.uniform1i(advProg.uniforms.get("u_source")!, 1);

    gl.uniform2f(advProg.uniforms.get("u_texelSize")!, 1.0 / this.simWidth, 1.0 / this.simHeight);
    gl.uniform1f(advProg.uniforms.get("u_dt")!, 0.0);
    gl.uniform1f(advProg.uniforms.get("u_dissipation")!, this.physics.pressureDissipation);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure!.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(this.pressure!);
  }

  private jacobiStep(texelSize: [number, number]): void {
    const gl = this.gl!;
    const prog = this.jacobiProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.pressure!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_pressure")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.divergenceFBO!.texture);
    gl.uniform1i(prog.uniforms.get("u_divergence")!, 1);

    gl.uniform2f(prog.uniforms.get("u_texelSize")!, texelSize[0], texelSize[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure!.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(this.pressure!);
  }

  private gradientSubtract(texelSize: [number, number]): void {
    const gl = this.gl!;
    const prog = this.gradientSubtractProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_velocity")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pressure!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_pressure")!, 1);

    gl.uniform2f(prog.uniforms.get("u_texelSize")!, texelSize[0], texelSize[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity!.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(this.velocity!);
  }

  // ============================================================
  // Display rendering
  // ============================================================

  private renderDisplay(config: FireOverlayConfig, input: FireFrameInput): void {
    const gl = this.gl!;

    gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);
    gl.enable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const prog = this.displayProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.temperature!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_temperature")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fuel!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_fuel")!, 1);

    // Color field texture
    gl.activeTexture(gl.TEXTURE2);
    if (this.colorField && (config.colorBlend ?? 0) > 0) {
      gl.bindTexture(gl.TEXTURE_2D, this.colorField.read.texture);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.fuel!.read.texture);
    }
    gl.uniform1i(prog.uniforms.get("u_colorField")!, 2);

    // Color blend factor (0.0 = natural, 0.5 = tinted, 1.0 = fully colored)
    gl.uniform1f(prog.uniforms.get("u_colorBlend")!, config.colorBlend ?? 0);

    gl.uniform1f(prog.uniforms.get("u_displayIntensity")!, config.intensity);

    // Wick core positions (always-bright flame at each tip)
    gl.uniform1i(prog.uniforms.get("u_tipCount")!, this.displayTipCount);

    for (let i = 0; i < this.displayTipCount; i++) {
      const posLoc = gl.getUniformLocation(prog.program, `u_tipPositions[${i}]`);
      const speedLoc = gl.getUniformLocation(prog.program, `u_tipSpeeds[${i}]`);
      const scaleLoc = gl.getUniformLocation(prog.program, `u_tipFlameScales[${i}]`);
      if (posLoc) gl.uniform2f(posLoc, this.displayTipUVs[i * 2]!, this.displayTipUVs[i * 2 + 1]!);
      if (speedLoc) gl.uniform1f(speedLoc, this.displayTipSpeeds[i]!);
      if (scaleLoc) gl.uniform1f(scaleLoc, this.displayTipFlameScales[i]!);
      const colorLoc = gl.getUniformLocation(prog.program, `u_tipColors[${i}]`);
      if (colorLoc) {
        gl.uniform3f(
          colorLoc,
          this.displayTipColors[i * 3] ?? 1.0,
          this.displayTipColors[i * 3 + 1] ?? 0.65,
          this.displayTipColors[i * 3 + 2] ?? 0.12
        );
      }
    }

    // Aspect correction so wick cores render as circles, not ellipses
    const aspect = this.displayCanvasWidth / Math.max(this.displayCanvasHeight, 1);
    gl.uniform2f(prog.uniforms.get("u_aspectCorrect")!, 1.0, aspect);

    // Per-fuel-source color curve (falls back to white gas = old hardcoded values)
    const curve = config.colorCurve ?? WHITE_GAS_COLOR;
    gl.uniform3fv(prog.uniforms.get("u_colorCold")!, curve.coldColor);
    gl.uniform3fv(prog.uniforms.get("u_colorMid")!, curve.midColor);
    gl.uniform3fv(prog.uniforms.get("u_colorHot")!, curve.hotColor);
    gl.uniform3fv(prog.uniforms.get("u_colorCore")!, curve.coreColor);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ============================================================
  // FBO management
  // ============================================================

  private createDoubleFBO(w: number, h: number): DoubleFBO {
    const gl = this.gl!;
    return {
      read: this.createFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR),
      write: this.createFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR),
    };
  }

  private createSingleFBO(w: number, h: number): FBOAttachment {
    const gl = this.gl!;
    return this.createFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
  }

  private createFBO(
    w: number, h: number,
    internalFormat: number, format: number, type: number, filter: number
  ): FBOAttachment {
    const gl = this.gl!;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return { fbo, texture };
  }

  private swapFBO(fbo: DoubleFBO): void {
    const tmp = fbo.read;
    fbo.read = fbo.write;
    fbo.write = tmp;
  }

  private createSimulationBuffers(): void {
    const w = this.simWidth;
    const h = this.simHeight;

    this.velocity = this.createDoubleFBO(w, h);
    this.pressure = this.createDoubleFBO(w, h);
    this.temperature = this.createDoubleFBO(w, h);
    this.fuel = this.createDoubleFBO(w, h);
    this.divergenceFBO = this.createSingleFBO(w, h);
    this.curlFBO = this.createSingleFBO(w, h);
    this.colorField = this.createDoubleFBO(w, h);
  }

  private destroySimulationBuffers(): void {
    const gl = this.gl;
    if (!gl) return;

    const destroyDouble = (d: DoubleFBO | null) => {
      if (!d) return;
      gl.deleteTexture(d.read.texture);
      gl.deleteFramebuffer(d.read.fbo);
      gl.deleteTexture(d.write.texture);
      gl.deleteFramebuffer(d.write.fbo);
    };

    const destroySingle = (f: FBOAttachment | null) => {
      if (!f) return;
      gl.deleteTexture(f.texture);
      gl.deleteFramebuffer(f.fbo);
    };

    destroyDouble(this.velocity);
    destroyDouble(this.pressure);
    destroyDouble(this.temperature);
    destroyDouble(this.fuel);
    destroyDouble(this.colorField);
    destroySingle(this.divergenceFBO);
    destroySingle(this.curlFBO);

    this.velocity = null;
    this.pressure = null;
    this.temperature = null;
    this.fuel = null;
    this.colorField = null;
    this.divergenceFBO = null;
    this.curlFBO = null;
  }

  // ============================================================
  // Shader compilation
  // ============================================================

  private compileAllPrograms(): boolean {
    this.splatProgram = this.buildProgram(SPLAT_FRAG, ["u_target", "u_point", "u_splatValue", "u_radius"]);
    this.advectionProgram = this.buildProgram(ADVECTION_FRAG, ["u_velocity", "u_source", "u_texelSize", "u_dt", "u_dissipation"]);
    this.curlProgram = this.buildProgram(CURL_FRAG, ["u_velocity", "u_texelSize"]);
    this.vorticityProgram = this.buildProgram(VORTICITY_FRAG, ["u_velocity", "u_curl", "u_texelSize", "u_dt", "u_strength"]);
    this.buoyancyProgram = this.buildProgram(BUOYANCY_FRAG, ["u_velocity", "u_temperature", "u_dt", "u_buoyancy", "u_ambientTemp"]);
    this.combustionProgram = this.buildProgram(COMBUSTION_FRAG, ["u_temperature", "u_fuel", "u_dt", "u_burnRate", "u_burnTemp", "u_fuelEfficiency", "u_coolingRate", "u_ambientTemp"]);
    this.divergenceProgram = this.buildProgram(DIVERGENCE_FRAG, ["u_velocity", "u_texelSize"]);
    this.jacobiProgram = this.buildProgram(JACOBI_FRAG, ["u_pressure", "u_divergence", "u_texelSize"]);
    this.gradientSubtractProgram = this.buildProgram(GRADIENT_SUBTRACT_FRAG, ["u_velocity", "u_pressure", "u_texelSize"]);
    this.clearProgram = this.buildProgram(CLEAR_FRAG, ["u_clearValue"]);
    this.displayProgram = this.buildProgram(DISPLAY_FRAG, [
      "u_temperature", "u_fuel", "u_colorField", "u_displayIntensity",
      "u_tipCount", "u_aspectCorrect", "u_colorBlend",
      "u_colorCold", "u_colorMid", "u_colorHot", "u_colorCore",
    ]);

    const all = [
      this.splatProgram, this.advectionProgram, this.curlProgram,
      this.vorticityProgram, this.buoyancyProgram, this.combustionProgram,
      this.divergenceProgram, this.jacobiProgram, this.gradientSubtractProgram,
      this.clearProgram, this.displayProgram,
    ];

    if (all.some(p => p === null)) {
      console.error("Failed to compile one or more fire simulation shaders");
      return false;
    }

    return true;
  }

  private buildProgram(fragSource: string, uniformNames: string[]): ShaderProgram | null {
    const gl = this.gl!;

    const vertShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, fragSource);
    if (!vertShader || !fragShader) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Fire shader link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return null;
    }

    gl.detachShader(program, vertShader);
    gl.detachShader(program, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    const uniforms = new Map<string, WebGLUniformLocation>();
    for (const name of uniformNames) {
      const loc = gl.getUniformLocation(program, name);
      if (loc !== null) {
        uniforms.set(name, loc);
      }
    }

    return { program, uniforms };
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const typeName = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      console.error(`Fire ${typeName} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  // ============================================================
  // Cleanup
  // ============================================================

  private cleanup(): void {
    this.destroySimulationBuffers();

    const gl = this.gl;
    if (gl) {
      const programs = [
        this.splatProgram, this.advectionProgram, this.curlProgram,
        this.vorticityProgram, this.buoyancyProgram, this.combustionProgram,
        this.divergenceProgram, this.jacobiProgram, this.gradientSubtractProgram,
        this.clearProgram, this.displayProgram,
      ];
      for (const p of programs) {
        if (p) gl.deleteProgram(p.program);
      }
    }

    this.splatProgram = null;
    this.advectionProgram = null;
    this.curlProgram = null;
    this.vorticityProgram = null;
    this.buoyancyProgram = null;
    this.combustionProgram = null;
    this.divergenceProgram = null;
    this.jacobiProgram = null;
    this.gradientSubtractProgram = null;
    this.clearProgram = null;
    this.displayProgram = null;

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }

    this.gl = null;
    this.initialized = false;
  }
}
