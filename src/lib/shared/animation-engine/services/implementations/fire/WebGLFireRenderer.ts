/**
 * WebGLFireRenderer - Navier-Stokes Fluid Fire Simulation
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
 *
 * @deprecated Superseded by render-graph WebGPUFireExecutor (WGSL Navier-Stokes).
 * Same 13-step pipeline ported to WebGPU with WGSL shaders, explicit bind groups,
 * and 256×256 rgba16float ping-pong textures. Gated behind window.__TKA_UNIFIED_VIEWER.
 */

import { FireFrameCache } from "./FireFrameCache";
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
  BLOOM_COMPOSITE_FRAG,
  CURL_NOISE_FRAG,
} from "./FluidShaderSources";
import {
  BLOOM_DOWNSAMPLE_FRAG,
  BLOOM_UPSAMPLE_FRAG,
} from "../led/LedShaderSources";
import { BASE_COLOR_CURVE } from "../../../domain/types/FireTypes";

const MAX_DPR = 2;
const _DEFAULT_JACOBI_ITERATIONS = 12;

// ============================================================
// Active instance tracking for adaptive quality
// ============================================================

/** Number of currently active fire renderer instances across all animation engines */
let activeFireInstanceCount = 0;

/** Read the current active instance count (used by compose module for quality decisions) */
export function getActiveFireInstanceCount(): number {
  return activeFireInstanceCount;
}

/**
 * Compute optimal Jacobi iterations based on how many fire renderers
 * are running simultaneously. Fire doesn't need precise pressure solving -
 * visual plausibility is all that matters.
 */
export function computeAdaptiveJacobiIterations(instanceCount: number): number {
  if (instanceCount <= 1) return 12;
  if (instanceCount <= 4) return 8;
  return 6;
}

/** Maps quality level to simulation grid resolution */
function qualityToResolution(quality: number): number {
  if (quality <= 1) return 64;
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

export class WebGLFireRenderer {
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
  private curlNoiseProgram: ShaderProgram | null = null;
  private combustionProgram: ShaderProgram | null = null;
  private divergenceProgram: ShaderProgram | null = null;
  private jacobiProgram: ShaderProgram | null = null;
  private gradientSubtractProgram: ShaderProgram | null = null;
  private clearProgram: ShaderProgram | null = null;
  private displayProgram: ShaderProgram | null = null;
  private bloomDownsampleProgram: ShaderProgram | null = null;
  private bloomUpsampleProgram: ShaderProgram | null = null;
  private bloomCompositeProgram: ShaderProgram | null = null;

  // Double-buffered simulation fields
  private velocity: DoubleFBO | null = null;
  private pressure: DoubleFBO | null = null;
  private temperature: DoubleFBO | null = null;
  private fuel: DoubleFBO | null = null;
  private colorField: DoubleFBO | null = null;

  // Soot density field (combustion byproduct, rendered as dark smoke)

  // Single-buffered fields (no ping-pong needed)
  private divergenceFBO: FBOAttachment | null = null;
  private curlFBO: FBOAttachment | null = null;

  // Bloom pipeline FBOs
  private displayFBO: FBOAttachment | null = null;
  private bloomMips: FBOAttachment[] = [];
  private bloomMipSizes: [number, number][] = [];

  // Timing
  private lastTime = 0;
  private lastRenderTime = -1;
  private reducedMotion = false;

  // Turbulence clock for idle-fire flickering (cheap deterministic noise)
  private turbulenceClock = 0;

  // Per-frame tip data cached for display pass (set during stepSimulation)
  private displayTipUVs: Float32Array = new Float32Array(32);  // 16 tips * 2 (x,y)
  private displayTipSpeeds: Float32Array = new Float32Array(16);
  private displayTipFlameScales: Float32Array = new Float32Array(16);
  private displayTipColors: Float32Array = new Float32Array(48); // 16 tips * 3 (r,g,b)
  private displayTipCount = 0;
  private displayCanvasWidth = 1;
  private displayCanvasHeight = 1;

  // Pre-cached uniform locations for tip arrays (avoids getUniformLocation per frame)
  // On Windows/ANGLE, each getUniformLocation call triggers a GPU-CPU sync stall.
  // With 4 tips × 4 uniforms = 16 calls per frame, this was costing 1.6-8ms of pure stall.
  private tipPositionLocs: (WebGLUniformLocation | null)[] = [];
  private tipSpeedLocs: (WebGLUniformLocation | null)[] = [];
  private tipFlameScaleLocs: (WebGLUniformLocation | null)[] = [];
  private tipColorLocs: (WebGLUniformLocation | null)[] = [];

  // Mutable physics parameters - set via config.physicsPreset or defaults
  private physics: FirePhysicsParams = { ...DEFAULT_PHYSICS };
  private readonly AMBIENT_TEMP = 0.0;
  private readonly BURN_TEMP = 0.1;

  // Frame cache for loop replay (Tier 3 optimization)
  private frameCache: FireFrameCache | null = null;
  private lastConfigHash = "";

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
    this.canvas.dataset.overlayType = "emissive";

    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);

    container.appendChild(this.canvas);

    return this.initGLContext(width, height, true);
  }

  initializeHeadless(width: number, height: number): boolean {
    this.canvas = new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
    this.dpr = 1;
    return this.initGLContext(width, height, false);
  }

  private initGLContext(width: number, height: number, isDom: boolean): boolean {
    this.gl = this.canvas!.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext | null;

    if (!this.gl) {
      console.warn("WebGL2 not available for fire overlay");
      this.cleanup();
      return false;
    }

    const gl = this.gl;

    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      console.warn("EXT_color_buffer_float not available - fire simulation requires float FBOs");
      this.cleanup();
      return false;
    }
    gl.getExtension("OES_texture_float_linear");

    if (!this.compileAllPrograms()) {
      this.cleanup();
      return false;
    }

    this.createSimulationBuffers();

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA
    );
    gl.disable(gl.DEPTH_TEST);

    if (isDom && typeof window !== "undefined" && window.matchMedia) {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    this.lastTime = performance.now();
    this.initialized = true;
    activeFireInstanceCount++;

    this.frameCache = new FireFrameCache(gl);

    return true;
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    // Simulation buffers stay at simWidth x simHeight - independent of display
    // Invalidate frame cache since display dimensions changed
    this.frameCache?.invalidate();
  }

  // --- EXPORT DIAGNOSTIC (remove after debugging) ---
  private _diagFrameCount = 0;
  private _diagEnabled = false;
  enableDiagnostics(): void { this._diagEnabled = true; this._diagFrameCount = 0; }
  disableDiagnostics(): void { this._diagEnabled = false; }
  resetDiagnosticCounter(): void { this._diagFrameCount = 0; }

  /**
   * Capture fire canvas as a downloadable PNG for visual debugging.
   * Also captures the composited result (main canvas + fire overlay)
   * using the same blend as the export pipeline. Triggered via
   * window.__tka_fire_snapshot() (wired in AnimatorCanvas).
   */
  snapshotFireCanvas(): void {
    const gl = this.gl;
    const c = this.canvas;
    if (!gl || !c) { console.log('[fire-snapshot] no gl/canvas'); return; }

    // 1. Fire canvas only
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fire-canvas-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      console.log(`[fire-snapshot] fire canvas saved (${c.width}x${c.height})`);
    });

    // 2. Composited frame (main + fire) using export blend
    const container = c.parentElement;
    if (container) {
      const mainCanvas = container.querySelector('canvas:not([data-overlay-type])') as HTMLCanvasElement | null;
      if (mainCanvas) {
        const comp = document.createElement('canvas');
        const size = Math.max(mainCanvas.width, mainCanvas.height);
        comp.width = size;
        comp.height = size;
        const ctx = comp.getContext('2d')!;
        ctx.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, size, size);
        // Fire overlay with same "lighter" blend as export uses
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(c, 0, 0, c.width, c.height, 0, 0, size, size);
        ctx.globalCompositeOperation = 'source-over';
        comp.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `fire-composited-lighter-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          console.log(`[fire-snapshot] composited (lighter blend) saved`);
        });
        // Also save source-over version for comparison
        const comp2 = document.createElement('canvas');
        comp2.width = size;
        comp2.height = size;
        const ctx2 = comp2.getContext('2d')!;
        ctx2.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, size, size);
        ctx2.drawImage(c, 0, 0, c.width, c.height, 0, 0, size, size);
        comp2.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `fire-composited-srcover-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          console.log(`[fire-snapshot] composited (source-over blend) saved`);
        });
      }
    }
  }

  sampleFireCanvas(): string {
    const gl = this.gl;
    const c = this.canvas;
    if (!gl || !c) return '[fire-sample] no gl/canvas';
    const px = new Uint8Array(4);
    const w = c.width, h = c.height;
    const points: [string, number, number][] = [
      ['center', Math.floor(w/2), Math.floor(h/2)],
      ['quarter', Math.floor(w/2), Math.floor(h*0.25)],
      ['edge', Math.floor(w*0.1), Math.floor(h/2)],
      ['corner', 5, 5],
    ];
    const lines: string[] = [`[fire-sample] canvas=${w}x${h} dpr=${this.dpr}`];
    for (const [name, x, y] of points) {
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      lines.push(`  ${name}(${x},${y}): rgba(${px[0]},${px[1]},${px[2]},${px[3]})`);
    }
    const result = lines.join('\n');
    console.log(result);
    return result;
  }

  renderFire(input: FireFrameInput, config: FireOverlayConfig): void {
    const gl = this.gl;
    if (!gl || !this.initialized) return;

    // Deduplicate: during export, two RAF callbacks fire with the same
    // virtualTime. Running the Navier-Stokes simulation twice doubles
    // fuel/velocity/temperature injection, producing concentric pressure
    // ring artifacts. preserveDrawingBuffer keeps display pixels from
    // the first call, so skipping the second is safe.
    if (input.currentTime === this.lastRenderTime) {
      if (this._diagEnabled) console.log('[fire-diag] DEDUP SKIP, currentTime=', input.currentTime);
      return;
    }
    this.lastRenderTime = input.currentTime;

    if (this._diagEnabled && this._diagFrameCount < 5) {
      this._diagFrameCount++;
      const tip0 = input.tips[0];
      const tipStr = tip0
        ? `tip0=(${Math.round(tip0.x)},${Math.round(tip0.y)}) spd=${Math.round(tip0.speed)} fs=${tip0.flameScale?.toFixed(2)}`
        : 'no-tips';
      const rawDt = (input.currentTime - this.lastTime) / 1000;
      const subSteps = Math.max(1, Math.ceil(Math.min(Math.abs(rawDt), 0.066) / 0.017));
      console.log(
        `[fire-diag] frame ${this._diagFrameCount} | t=${input.currentTime.toFixed(1)} rawDt=${rawDt.toFixed(4)} subSteps=${subSteps} | ` +
        `canvas=${this.canvas?.width}x${this.canvas?.height} sim=${this.simWidth}x${this.simHeight} | ` +
        `tips=${input.tips.length} ${tipStr} | ` +
        `intensity=${config.intensity} bloom=${config.bloomStrength ?? 0.08} cacheDisabled=${config.disableFrameCache} loopDet=${input.loopDetected}`
      );
    }

    // Apply physics preset if provided
    if (config.physicsPreset) {
      this.physics = config.physicsPreset;
    }

    // --- Frame cache logic ---
    const cache = this.frameCache;
    if (cache && !config.disableFrameCache) {
      // Compute config hash for invalidation (includes playback speed - different BPM = different fire physics)
      const hash = this.computeConfigHash(config, input.playbackSpeed, input.sequenceContentHash);

      // Invalidate cache if config changed
      if (hash !== this.lastConfigHash) {
        cache.checkConfigHash(hash);
        this.lastConfigHash = hash;
      }

      // Handle loop detection
      if (input.loopDetected) {
        if (cache.isRecording()) {
          // First loop complete - switch to playback
          cache.onLoopDetected();
        } else if (cache.isWarm()) {
          // Subsequent loop - reset playback index
          cache.onLoopDetected();
        } else {
          // Cache is idle - start recording this loop
          cache.startRecording(
            this.simWidth, this.simHeight,
            this.canvas!.width, this.canvas!.height,
            hash
          );
        }

        // For seamless loops, fire should continue naturally - props don't teleport,
        // so there's no velocity spike or positional discontinuity to fix.
        // For non-seamless loops, clear only velocity/pressure (physics fields) so
        // residual velocity doesn't push fire away from prop tips, but let
        // temperature/fuel/soot fade out naturally through dissipation physics.
        if (!cache.isWarm()) {
          if (input.isSeamlesslyLoopable) {
            // Don't clear anything - fire continues seamlessly
          } else {
            this.clearVelocityFields();
          }
        }
      }

      // If cache is warm, skip simulation entirely and blit from cache
      if (cache.isWarm()) {
        if (cache.blitCachedFrame(input.relativeTime)) {
          if (this._diagEnabled && this._diagFrameCount <= 5) console.log(`[fire-path] CACHE-BLIT (warm, frame ${this._diagFrameCount})`);
          return; // Done - no simulation needed
        }
        // Cache exhausted (shouldn't happen), fall through to live simulation
      }

      // If recording, render display to cache FBO after simulation
      if (cache.isRecording()) {
        if (this._diagEnabled && this._diagFrameCount <= 5) console.log(`[fire-path] CACHE-RECORD (no bloom, frame ${this._diagFrameCount})`);
        this.stepSimulation(input.tips, input, config);
        this.renderDisplayToCache(config, input, cache);
        return;
      }
    } else if (cache && config.disableFrameCache) {
      // Frame caching disabled - invalidate any existing cache
      if (cache.isRecording() || cache.isWarm()) {
        cache.invalidate();
      }
    }

    // Default path: no cache, run full simulation + display
    // On loop: seamless sequences keep fire continuous; non-seamless clear only
    // velocity to prevent drift while letting visible fire fade naturally.
    if (input.loopDetected && !input.isSeamlesslyLoopable) {
      this.clearVelocityFields();
    }
    const bloomStr = (config.bloomStrength ?? 0.08);
    const useBloom = bloomStr > 0 && this.displayFBO && this.bloomMips.length > 0;
    if (this._diagEnabled && this._diagFrameCount <= 5) {
      console.log(`[fire-path] DEFAULT (bloom=${useBloom}, bloomStr=${bloomStr}, displayFBO=${!!this.displayFBO}, mips=${this.bloomMips.length}, frame ${this._diagFrameCount})`);
    }
    this.stepSimulation(input.tips, input, config);
    this.renderDisplay(config, input);
  }

  /**
   * Compute a hash of fire config properties that affect visual output.
   * When any of these change, the frame cache must be invalidated.
   * Includes playback speed because different BPMs produce different tip velocities,
   * which change the fire physics (buoyancy, turbulence, trail shape).
   */
  private computeConfigHash(config: FireOverlayConfig, playbackSpeed?: number, sequenceContentHash?: string): string {
    return `${config.fuelSourceId ?? "default"}_${config.intensity}_${config.flameHeight}_${config.quality}_${config.colorBlend ?? 0}_${playbackSpeed ?? 1}_${sequenceContentHash ?? ""}`;
  }

  /**
   * Render the display pass to the cache's recording FBO, then blit to screen.
   * Used during the recording phase of the first loop.
   */
  private renderDisplayToCache(
    config: FireOverlayConfig,
    input: FireFrameInput,
    cache: FireFrameCache
  ): void {
    const gl = this.gl!;

    // Render display pass to the cache recording FBO at sim resolution
    gl.bindFramebuffer(gl.FRAMEBUFFER, cache.getRecordingFBO());
    gl.viewport(0, 0, cache.getCacheWidth(), cache.getCacheHeight());
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Run the same display shader, but output goes to cache FBO
    this.renderDisplayPass(config, input);

    // Commit the frame (copies to cache texture + blits to screen)
    cache.commitFrame(input.relativeTime ?? 0);
  }

  setQuality(level: number): void {
    const newRes = qualityToResolution(level);
    if (newRes !== this.simWidth && this.gl) {
      this.simWidth = newRes;
      this.simHeight = newRes;
      this.destroySimulationBuffers();
      this.createSimulationBuffers();
      this.frameCache?.invalidate();
    }
  }

  /**
   * Clear only velocity and pressure fields, preserving visual fire trails.
   * Used on non-seamless loop boundaries: prevents residual velocity from
   * pushing fire away from prop tips, while letting temperature/fuel/soot
   * fade out naturally through dissipation physics.
   */
  private clearVelocityFields(): void {
    const gl = this.gl;
    if (!gl || !this.initialized) return;

    const physicsFields = [this.velocity, this.pressure];
    for (const field of physicsFields) {
      if (!field) continue;
      for (const buf of [field.read, field.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, buf.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }

    // Divergence and curl are derived from velocity - clear them too
    if (this.divergenceFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceFBO.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (this.curlFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.curlFBO.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Note: frame cache is NOT invalidated here - velocity-only clearing
    // is compatible with continued recording.
  }

  invalidateFrameCache(): void {
    this.frameCache?.invalidate();
  }

  // Clears accumulated thermal energy (temp, fuel, velocity, color) while
  // preserving the converged pressure field. Used after export warmup: 60
  // frames of fuel at stationary tips builds unrealistic energy that the
  // live preview never accumulates. Pressure convergence is the entire
  // purpose of warmup — keep it, discard the visual residue.
  clearThermalFields(): void {
    const gl = this.gl;
    if (!gl || !this.initialized) return;

    const thermalFields = [this.velocity, this.temperature, this.fuel, this.colorField];
    for (const field of thermalFields) {
      if (!field) continue;
      for (const buf of [field.read, field.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, buf.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }

    if (this.divergenceFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceFBO.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (this.curlFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.curlFBO.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.lastRenderTime = -1;
    this.frameCache?.invalidate();
  }

  clearSimulation(): void {
    const gl = this.gl;
    if (!gl || !this.initialized) return;

    // Clear each double-buffered simulation field to zero
    const fields = [
      this.velocity,
      this.temperature,
      this.fuel,
      this.pressure,
      this.colorField,
    ];

    for (const field of fields) {
      if (!field) continue;
      for (const buf of [field.read, field.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, buf.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }

    // Clear single-buffered fields
    if (this.divergenceFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergenceFBO.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (this.curlFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.curlFBO.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Clear the display canvas so stale pixels from the last render don't
    // persist (the FBOs above are off-screen; this clears what's visible).
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Reset dedup guard so the first post-clear frame runs
    this.lastRenderTime = -1;

    // Invalidate frame cache so stale fire frames from old effort/position
    // aren't served after the simulation is cleared
    this.frameCache?.invalidate();
  }

  dispose(): void {
    this.cleanup();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  setCanvasZIndex(z: number): void {
    if (this.canvas) this.canvas.style.zIndex = String(z);
  }

  getGl(): WebGL2RenderingContext | null {
    return this.gl;
  }

  /** Snapshot of internal state for diagnostic reports. */
  getDiagnostics(): Record<string, unknown> {
    return {
      initialized: this.initialized,
      simResolution: [this.simWidth, this.simHeight],
      dpr: this.dpr,
      activeTips: this.displayTipCount,
      canvasSize: [this.displayCanvasWidth, this.displayCanvasHeight],
      cacheState: this.frameCache
        ? {
            state: this.frameCache.isWarm() ? "warm" : this.frameCache.isRecording() ? "recording" : "idle",
            totalFrames: (this.frameCache as unknown as Record<string, number>).totalFrames ?? 0,
          }
        : null,
      contextLost: this.gl?.isContextLost() ?? null,
      lastConfigHash: this.lastConfigHash,
    };
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
    let totalDt = Math.min((now - this.lastTime) / 1000, 0.066);
    if (this.reducedMotion) totalDt *= 0.2;
    this.lastTime = now;
    if (totalDt <= 0) totalDt = 0.016;

    gl.viewport(0, 0, this.simWidth, this.simHeight);
    gl.disable(gl.BLEND);

    const texelSize: [number, number] = [1.0 / this.simWidth, 1.0 / this.simHeight];

    // Cache tip UV positions for the display pass (wick core rendering)
    this.displayTipCount = Math.min(tips.length, 16);
    this.displayCanvasWidth = input.canvasWidth;
    this.displayCanvasHeight = input.canvasHeight;

    // Sub-step to keep dt ≤ 16ms. The Navier-Stokes solver is nonlinear —
    // larger time steps cause numerical instability that makes the fire
    // plume "explode" outward. At 30fps export (dt=33ms), this produced
    // massive bloom halos absent from the 60fps live preview.
    const MAX_SUB_DT = 0.017;
    const subSteps = Math.max(1, Math.ceil(totalDt / MAX_SUB_DT));
    const subDt = totalDt / subSteps;

    // 1. Inject fuel + velocity at tip positions (ONCE per frame, not per sub-step).
    const p = this.physics;
    const baseSplatRadius = p.splatRadius;
    const stepUV = baseSplatRadius;

    this.turbulenceClock += totalDt;

    for (const tip of tips) {
      const curUvX = tip.x / input.canvasWidth;
      const curUvY = 1.0 - tip.y / input.canvasHeight;
      const prevUvX = tip.prevX / input.canvasWidth;
      const prevUvY = 1.0 - tip.prevY / input.canvasHeight;
      const fs = tip.flameScale;

      const dxUV = curUvX - prevUvX;
      const dyUV = curUvY - prevUvY;
      const distUV = Math.sqrt(dxUV * dxUV + dyUV * dyUV);

      const splatCount = Math.min(32, Math.max(1, Math.ceil(distUV / stepUV)));

      this.physics.splatRadius = baseSplatRadius * fs;

      const velScale = config.velocityReactive ? p.velocityInjectScale : 0;
      const injectVx = -tip.velocityX * velScale * fs;
      const injectVy = tip.velocityY * velScale * fs + p.upwardBias * config.flameHeight * fs;

      const fuelPerSplat = (p.fuelAmount * config.intensity * fs) / splatCount;
      const baseTempPerSplat = (p.temperatureInjection * config.intensity * fs) / splatCount;

      const tc = this.turbulenceClock;
      const tipPhase = tip.propIndex * 3.7 + tip.tipIndex * 2.3;

      for (let s = 0; s < splatCount; s++) {
        const t = splatCount === 1 ? 1.0 : s / (splatCount - 1);
        const uvX = prevUvX + dxUV * t;
        const uvY = prevUvY + dyUV * t;

        const tempNoise = Math.sin(tc * 8.3 + tipPhase) * 0.15
                        + Math.sin(tc * 13.7 + tipPhase * 1.4) * 0.1;
        const tempPerSplat = baseTempPerSplat * (1.0 + tempNoise);

        this.splat(this.fuel!, uvX, uvY, fuelPerSplat, 0, 0);
        this.splat(this.velocity!, uvX, uvY, injectVx / splatCount, injectVy / splatCount, 0);
        this.splat(this.temperature!, uvX, uvY, tempPerSplat, 0, 0);

        if ((config.colorBlend ?? 0) > 0 && input.propColors && this.colorField) {
          const propColor = input.propColors[tip.propIndex];
          if (propColor) {
            this.splat(this.colorField, uvX, uvY, propColor.r, propColor.g, propColor.b);
          }
        }
      }
    }

    this.physics.splatRadius = baseSplatRadius;

    // Cache tip UV positions + flameScales for the display pass
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

    // 2-7. Physics sub-stepping: run advection, buoyancy, vorticity,
    // combustion, and pressure solve at ≤16ms increments.
    const iterations = config.jacobiIterations ?? computeAdaptiveJacobiIterations(activeFireInstanceCount);
    for (let step = 0; step < subSteps; step++) {
      this.advect(this.velocity!, this.velocity!.read, p.velocityDissipation, subDt, texelSize);
      this.computeCurl(texelSize);
      this.applyVorticity(subDt, texelSize, config.flameHeight);
      this.applyBuoyancy(subDt, config.flameHeight);
      this.applyCurlNoiseTurbulence(subDt, texelSize, config.flameHeight, config.turbulence ?? 0.5);
      this.applyCombustion(subDt, config.intensity);
      this.computeDivergence(texelSize);
      this.scalePressure();
      for (let i = 0; i < iterations; i++) {
        this.jacobiStep(texelSize);
      }
      this.gradientSubtract(texelSize);
      this.advect(this.temperature!, this.temperature!.read, p.temperatureDissipation, subDt, texelSize);
      this.advect(this.fuel!, this.fuel!.read, p.fuelDissipation, subDt, texelSize);
      if (this.colorField && (config.colorBlend ?? 0) > 0) {
        this.advect(this.colorField, this.colorField.read, p.fuelDissipation, subDt, texelSize);
      }
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
    gl.uniform1f(prog.uniforms.get("u_time")!, this.turbulenceClock);

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

    // Terminal velocity: force tapers to zero as velocity in the force direction approaches this ceiling.
    // Prevents runaway accumulation from both buoyancy (upward) and gravity (downward).
    // When gravity is active, raise the ceiling so fluid can actually fall fast.
    const termVel = this.physics.gravity < 0 ? 14.0 : 6.0;
    gl.uniform1f(prog.uniforms.get("u_terminalVelocity")!, termVel);
    gl.uniform1f(prog.uniforms.get("u_gravity")!, this.physics.gravity);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity!.write.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.swapFBO(this.velocity!);
  }

  /**
   * Apply curl-noise turbulence: divergence-free velocity perturbation
   * concentrated at flame boundaries. This is what makes stationary fire
   * flicker naturally - the rising plume gets pushed by spatially-coherent
   * vortical forces while the wick stays still.
   */
  private applyCurlNoiseTurbulence(dt: number, texelSize: [number, number], heightMult: number, turbulence: number): void {
    if (turbulence <= 0) return;
    const gl = this.gl!;
    const prog = this.curlNoiseProgram!;
    gl.useProgram(prog.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.velocity!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_velocity")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.temperature!.read.texture);
    gl.uniform1i(prog.uniforms.get("u_temperature")!, 1);

    gl.uniform2f(prog.uniforms.get("u_texelSize")!, texelSize[0], texelSize[1]);
    gl.uniform1f(prog.uniforms.get("u_dt")!, dt);
    gl.uniform1f(prog.uniforms.get("u_time")!, this.turbulenceClock);

    // Strength scaled by vorticity strength so turbulence is proportional
    // to the overall fire intensity. The turbulence parameter (0-1) maps
    // to a 0-8x multiplier on the base vorticity strength.
    const strength = this.physics.vorticityStrength * heightMult * turbulence * 8.0;
    gl.uniform1f(prog.uniforms.get("u_strength")!, strength);

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
    // The clear shader sets a flat value - that's not what we want.
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

  /**
   * Render the display pass. When bloom is enabled, renders to an intermediate
   * FBO, runs the bloom mip chain, then composites scene + bloom to screen.
   * Without bloom, renders directly to the default framebuffer.
   */
  private renderDisplay(config: FireOverlayConfig, input: FireFrameInput): void {
    const gl = this.gl!;
    const bloomStrength = config.bloomStrength ?? 0.08;
    const useBloom = bloomStrength > 0 && this.displayFBO && this.bloomMips.length > 0;

    if (useBloom) {
      // Render fire to intermediate FBO at sim resolution
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.displayFBO!.fbo);
      gl.viewport(0, 0, this.simWidth, this.simHeight);
      gl.enable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.renderDisplayPass(config, input);

      // Run bloom pipeline: downsample → upsample → composite to screen
      this.runBloomPipeline(bloomStrength);
    } else {
      // No bloom: render directly to screen
      gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);
      gl.enable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.renderDisplayPass(config, input);
    }

    // Post-render pixel sampling for diagnostics
    if (this._diagEnabled && this._diagFrameCount <= 5) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const px = new Uint8Array(4);
      const w = this.canvas!.width, h = this.canvas!.height;
      gl.readPixels(Math.floor(w/2), Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const center = `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`;
      gl.readPixels(Math.floor(w/2), Math.floor(h*0.25), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const quarter = `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`;
      gl.readPixels(5, 5, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const corner = `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`;
      console.log(`[fire-pixels] post-render: center=${center} quarter=${quarter} corner=${corner} | bloom=${useBloom}`);
    }
  }

  /**
   * PBR bloom pipeline (CoD:AW method):
   * 1. Downsample scene through mip chain with 13-tap energy-preserving kernel
   * 2. Upsample with additive 3x3 tent filter accumulation
   * 3. Composite bloom + original scene to screen
   */
  private runBloomPipeline(bloomStrength: number): void {
    const gl = this.gl!;
    const mips = this.bloomMips;
    const sizes = this.bloomMipSizes;
    if (mips.length === 0) return;

    gl.disable(gl.BLEND);

    // --- Downsample chain ---
    const downProg = this.bloomDownsampleProgram!;
    gl.useProgram(downProg.program);

    // First downsample: from displayFBO to mip[0] — with luminance prefilter.
    // The soft-knee threshold (UE4/Frostbite method) gates which pixels enter
    // the bloom chain. Only HDR values (wick cores at 4.0+) create bloom;
    // sub-HDR trail pixels are excluded, preventing the concentric halo rings
    // that appear when the fire canvas is composited onto dark backgrounds.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.displayFBO!.texture);
    gl.uniform1i(downProg.uniforms.get("u_source")!, 0);
    gl.uniform2f(downProg.uniforms.get("u_texelSize")!, 1.0 / this.simWidth, 1.0 / this.simHeight);
    gl.uniform1f(downProg.uniforms.get("u_threshold")!, 3.0);
    gl.uniform1f(downProg.uniforms.get("u_knee")!, 0.5);
    gl.bindFramebuffer(gl.FRAMEBUFFER, mips[0]!.fbo);
    gl.viewport(0, 0, sizes[0]![0], sizes[0]![1]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Subsequent downsamples: mip[i-1] → mip[i] (no threshold)
    gl.uniform1f(downProg.uniforms.get("u_threshold")!, 0.0);
    for (let i = 1; i < mips.length; i++) {
      gl.bindTexture(gl.TEXTURE_2D, mips[i - 1]!.texture);
      gl.uniform2f(downProg.uniforms.get("u_texelSize")!, 1.0 / sizes[i - 1]![0], 1.0 / sizes[i - 1]![1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mips[i]!.fbo);
      gl.viewport(0, 0, sizes[i]![0], sizes[i]![1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // --- Upsample chain (additive accumulation) ---
    const upProg = this.bloomUpsampleProgram!;
    gl.useProgram(upProg.program);
    gl.uniform1f(upProg.uniforms.get("u_bloomRadius")!, 1.0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive blend for bloom accumulation

    // Upsample: mip[last] → mip[last-1] → ... → mip[0]
    for (let i = mips.length - 1; i > 0; i--) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mips[i]!.texture);
      gl.uniform1i(upProg.uniforms.get("u_source")!, 0);
      gl.uniform2f(upProg.uniforms.get("u_texelSize")!, 1.0 / sizes[i]![0], 1.0 / sizes[i]![1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mips[i - 1]!.fbo);
      gl.viewport(0, 0, sizes[i - 1]![0], sizes[i - 1]![1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // --- Composite to screen ---
    gl.blendFuncSeparate(
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA
    ); // restore premultiplied alpha blend

    const compProg = this.bloomCompositeProgram!;
    gl.useProgram(compProg.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.displayFBO!.texture);
    gl.uniform1i(compProg.uniforms.get("u_scene")!, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mips[0]!.texture);
    gl.uniform1i(compProg.uniforms.get("u_bloom")!, 1);

    gl.uniform1f(compProg.uniforms.get("u_bloomStrength")!, bloomStrength);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * The display shader pass - sets uniforms and draws.
   * Caller is responsible for binding the target framebuffer and setting viewport.
   * This allows both renderDisplay (screen) and renderDisplayToCache (FBO) to share the same logic.
   */
  private renderDisplayPass(config: FireOverlayConfig, input: FireFrameInput): void {
    const gl = this.gl!;
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

    // Time for FBM noise animation (seconds since page load)
    gl.uniform1f(prog.uniforms.get("u_time")!, input.currentTime * 0.001);

    gl.uniform1f(prog.uniforms.get("u_displayIntensity")!, config.intensity);

    // Wick core positions (always-bright flame at each tip)
    // Uses pre-cached uniform locations to avoid per-frame getUniformLocation stalls
    gl.uniform1i(prog.uniforms.get("u_tipCount")!, this.displayTipCount);

    for (let i = 0; i < this.displayTipCount; i++) {
      const posLoc = this.tipPositionLocs[i];
      const speedLoc = this.tipSpeedLocs[i];
      const scaleLoc = this.tipFlameScaleLocs[i];
      const colorLoc = this.tipColorLocs[i];
      if (posLoc) gl.uniform2f(posLoc, this.displayTipUVs[i * 2]!, this.displayTipUVs[i * 2 + 1]!);
      if (speedLoc) gl.uniform1f(speedLoc, this.displayTipSpeeds[i]!);
      if (scaleLoc) gl.uniform1f(scaleLoc, this.displayTipFlameScales[i]!);
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
    const curve = config.colorCurve ?? BASE_COLOR_CURVE;
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

    // Display FBO for bloom pipeline (fire rendered here, then bloomed)
    this.displayFBO = this.createFBO(
      w, h,
      this.gl!.RGBA16F, this.gl!.RGBA, this.gl!.HALF_FLOAT, this.gl!.LINEAR
    );

    // Bloom mip chain: 4 levels, each half the previous
    this.createBloomMipChain(w, h);
  }

  private createBloomMipChain(baseW: number, baseH: number): void {
    this.destroyBloomMipChain();
    let w = Math.max(1, baseW >> 1);
    let h = Math.max(1, baseH >> 1);
    for (let i = 0; i < 4; i++) {
      this.bloomMips.push(
        this.createFBO(w, h, this.gl!.RGBA16F, this.gl!.RGBA, this.gl!.HALF_FLOAT, this.gl!.LINEAR)
      );
      this.bloomMipSizes.push([w, h]);
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }

  private destroyBloomMipChain(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const mip of this.bloomMips) {
      gl.deleteTexture(mip.texture);
      gl.deleteFramebuffer(mip.fbo);
    }
    this.bloomMips = [];
    this.bloomMipSizes = [];
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
    destroySingle(this.displayFBO);
    this.destroyBloomMipChain();

    this.velocity = null;
    this.pressure = null;
    this.temperature = null;
    this.fuel = null;
    this.colorField = null;
    this.divergenceFBO = null;
    this.curlFBO = null;
    this.displayFBO = null;
  }

  // ============================================================
  // Shader compilation
  // ============================================================

  private compileAllPrograms(): boolean {
    this.splatProgram = this.buildProgram(SPLAT_FRAG, ["u_target", "u_point", "u_splatValue", "u_radius"]);
    this.advectionProgram = this.buildProgram(ADVECTION_FRAG, ["u_velocity", "u_source", "u_texelSize", "u_dt", "u_dissipation"]);
    this.curlProgram = this.buildProgram(CURL_FRAG, ["u_velocity", "u_texelSize"]);
    this.vorticityProgram = this.buildProgram(VORTICITY_FRAG, ["u_velocity", "u_curl", "u_texelSize", "u_dt", "u_strength", "u_time"]);
    this.buoyancyProgram = this.buildProgram(BUOYANCY_FRAG, ["u_velocity", "u_temperature", "u_dt", "u_buoyancy", "u_ambientTemp", "u_terminalVelocity", "u_gravity"]);
    this.curlNoiseProgram = this.buildProgram(CURL_NOISE_FRAG, ["u_velocity", "u_temperature", "u_texelSize", "u_dt", "u_time", "u_strength"]);
    this.combustionProgram = this.buildProgram(COMBUSTION_FRAG, ["u_temperature", "u_fuel", "u_dt", "u_burnRate", "u_burnTemp", "u_fuelEfficiency", "u_coolingRate", "u_ambientTemp"]);
    this.divergenceProgram = this.buildProgram(DIVERGENCE_FRAG, ["u_velocity", "u_texelSize"]);
    this.jacobiProgram = this.buildProgram(JACOBI_FRAG, ["u_pressure", "u_divergence", "u_texelSize"]);
    this.gradientSubtractProgram = this.buildProgram(GRADIENT_SUBTRACT_FRAG, ["u_velocity", "u_pressure", "u_texelSize"]);
    this.clearProgram = this.buildProgram(CLEAR_FRAG, ["u_clearValue"]);
    this.displayProgram = this.buildProgram(DISPLAY_FRAG, [
      "u_temperature", "u_fuel", "u_colorField",
      "u_displayIntensity",
      "u_tipCount", "u_aspectCorrect", "u_colorBlend",
      "u_colorCold", "u_colorMid", "u_colorHot", "u_colorCore",
      "u_time",
    ]);
    this.bloomDownsampleProgram = this.buildProgram(BLOOM_DOWNSAMPLE_FRAG, [
      "u_source", "u_texelSize", "u_threshold", "u_knee",
    ]);
    this.bloomUpsampleProgram = this.buildProgram(BLOOM_UPSAMPLE_FRAG, [
      "u_source", "u_texelSize", "u_bloomRadius",
    ]);
    this.bloomCompositeProgram = this.buildProgram(BLOOM_COMPOSITE_FRAG, [
      "u_scene", "u_bloom", "u_bloomStrength",
    ]);
    const all = [
      this.splatProgram, this.advectionProgram, this.curlProgram,
      this.vorticityProgram, this.buoyancyProgram, this.curlNoiseProgram,
      this.combustionProgram,
      this.divergenceProgram, this.jacobiProgram, this.gradientSubtractProgram,
      this.clearProgram, this.displayProgram,
      this.bloomDownsampleProgram,
      this.bloomUpsampleProgram, this.bloomCompositeProgram,
    ];

    if (all.some(p => p === null)) {
      console.error("Failed to compile one or more fire simulation shaders");
      return false;
    }

    // Pre-cache tip array uniform locations to avoid per-frame getUniformLocation calls.
    // On Windows/ANGLE, each getUniformLocation triggers a GPU-CPU pipeline sync stall.
    this.cacheTipUniformLocations();

    return true;
  }

  private cacheTipUniformLocations(): void {
    if (!this.displayProgram || !this.gl) return;
    const gl = this.gl;
    const prog = this.displayProgram.program;
    const MAX_TIPS = 16;

    this.tipPositionLocs = new Array(MAX_TIPS);
    this.tipSpeedLocs = new Array(MAX_TIPS);
    this.tipFlameScaleLocs = new Array(MAX_TIPS);
    this.tipColorLocs = new Array(MAX_TIPS);

    for (let i = 0; i < MAX_TIPS; i++) {
      this.tipPositionLocs[i] = gl.getUniformLocation(prog, `u_tipPositions[${i}]`);
      this.tipSpeedLocs[i] = gl.getUniformLocation(prog, `u_tipSpeeds[${i}]`);
      this.tipFlameScaleLocs[i] = gl.getUniformLocation(prog, `u_tipFlameScales[${i}]`);
      this.tipColorLocs[i] = gl.getUniformLocation(prog, `u_tipColors[${i}]`);
    }
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
    if (this.initialized) {
      activeFireInstanceCount = Math.max(0, activeFireInstanceCount - 1);
    }
    this.frameCache?.dispose();
    this.frameCache = null;
    this.destroySimulationBuffers();

    const gl = this.gl;
    if (gl) {
      const programs = [
        this.splatProgram, this.advectionProgram, this.curlProgram,
        this.vorticityProgram, this.buoyancyProgram, this.curlNoiseProgram,
        this.combustionProgram,
        this.divergenceProgram, this.jacobiProgram, this.gradientSubtractProgram,
        this.clearProgram, this.displayProgram,
        this.bloomDownsampleProgram,
        this.bloomUpsampleProgram, this.bloomCompositeProgram,
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
    this.curlNoiseProgram = null;
    this.combustionProgram = null;
    this.divergenceProgram = null;
    this.jacobiProgram = null;
    this.gradientSubtractProgram = null;
    this.clearProgram = null;
    this.displayProgram = null;
    this.bloomDownsampleProgram = null;
    this.bloomUpsampleProgram = null;
    this.bloomCompositeProgram = null;

    if (this.canvas) {
      if (typeof (this.canvas as any).remove === "function") {
        this.canvas.remove();
      }
      this.canvas = null;
    }

    this.gl = null;
    this.initialized = false;
  }
}
