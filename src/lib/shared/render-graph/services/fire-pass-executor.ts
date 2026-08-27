/**
 * Fire pass executor for the render-graph WebGL2 backend.
 *
 * Restructured Navier-Stokes fluid fire simulation from
 * WebGLFireRenderer.ts. Uses the SHARED WebGL2 context, FBOPool,
 * and ShaderLibrary instead of managing its own GPU resources.
 *
 * Pipeline per frame (~30 draw calls):
 *   1. Splat fuel + velocity + temperature at each source point
 *   2. Advect velocity through itself
 *   3. Curl + vorticity confinement
 *   4. Curl noise turbulence (divergence-free perturbation)
 *   5. Buoyancy (temperature -> upward force)
 *   6. Combustion: fuel burns -> heat, cooling
 *   7. Divergence -> Jacobi pressure solve -> gradient subtraction
 *   8. Advect temperature + fuel through velocity field
 *   9. Display render: temperature -> blackbody color + wick cores
 *  10. Bloom post-process (downsample -> upsample -> composite)
 */

import type {
  FirePassPayload,
  FireSourcePoint,
  FireColorStop,
} from "../domain/fire-pass";
import type { FBO, FBOPool, PingPongPair } from "./fbo-pool";
import type { CompiledProgram, ShaderLibrary } from "./shader-library";


const SIM_SIZE = 256;
const JACOBI_ITERATIONS = 12;
const VELOCITY_DISSIPATION = 0.985;
const TEMPERATURE_DISSIPATION = 0.96;
const FUEL_DISSIPATION = 0.92;
const BURN_RATE = 3.0;
const BURN_TEMP = 0.1;
const FUEL_EFFICIENCY = 3.5;
const COOLING_RATE = 2.5;
const AMBIENT_TEMP = 0.0;
const BUOYANCY_DEFAULT = 1.2;
const VORTICITY_STRENGTH = 15.0;
const TERMINAL_VELOCITY = 6.0;
const GRAVITY = -0.3;
const DISPLAY_INTENSITY = 2.2;
const BLOOM_MIP_COUNT = 4;
const BLOOM_STRENGTH = 0.08;
const SPLAT_RADIUS = 0.012;

// Default color curve (white gas / natural fire)
const DEFAULT_COLD: [number, number, number] = [0.8, 0.2, 0.05];
const DEFAULT_MID: [number, number, number] = [1.0, 0.6, 0.1];
const DEFAULT_HOT: [number, number, number] = [1.0, 0.85, 0.4];
const DEFAULT_CORE: [number, number, number] = [1.0, 0.95, 0.85];


export class FirePassExecutor {
  private gl: WebGL2RenderingContext;
  private fbos: FBOPool;
  private shaders: ShaderLibrary;
  private emptyVAO: WebGLVertexArrayObject;
  private initialized = false;
  private elapsedTime = 0;

  // Ping-pong pairs (managed via FBOPool)
  private vel!: PingPongPair;
  private temp!: PingPongPair;
  private fuel!: PingPongPair;
  private press!: PingPongPair;
  private color!: PingPongPair;

  // Pre-cached tip uniform locations (avoids per-frame getUniformLocation stalls)
  private tipPositionLocs: (WebGLUniformLocation | null)[] = [];
  private tipSpeedLocs: (WebGLUniformLocation | null)[] = [];
  private tipFlameScaleLocs: (WebGLUniformLocation | null)[] = [];
  private tipColorLocs: (WebGLUniformLocation | null)[] = [];

  constructor(
    gl: WebGL2RenderingContext,
    fbos: FBOPool,
    shaders: ShaderLibrary,
    emptyVAO: WebGLVertexArrayObject,
  ) {
    this.gl = gl;
    this.fbos = fbos;
    this.shaders = shaders;
    this.emptyVAO = emptyVAO;
  }


  execute(payload: FirePassPayload, dt: number): void {
    const gl = this.gl;
    this.elapsedTime += dt;

    if (!this.initialized) {
      this.initFBOs();
      this.cacheTipUniformLocations();
      this.initialized = true;
    }

    const simSize = payload.gridSize ?? SIM_SIZE;
    const texelSize: [number, number] = [1 / simSize, 1 / simSize];
    const iterations = payload.jacobiIterations ?? JACOBI_ITERATIONS;

    gl.viewport(0, 0, simSize, simSize);
    gl.disable(gl.BLEND);

    // 1. Splat sources (fuel + velocity + temperature)
    for (const src of payload.sources) {
      this.splat(src, payload.intensity);
    }

    // 2. Advect velocity through itself
    this.advect("fire-advection", this.vel, this.vel.read, texelSize, VELOCITY_DISSIPATION, dt);

    // 3. Curl + vorticity confinement
    this.computeCurl(texelSize);
    this.applyVorticity(texelSize, payload.turbulence, dt);

    // 4. Curl noise turbulence
    if (payload.turbulence > 0.01) {
      this.applyCurlNoise(texelSize, payload.turbulence, dt);
    }

    // 5. Buoyancy
    this.applyBuoyancy(payload.buoyancy ?? BUOYANCY_DEFAULT, dt);

    // 6. Combustion
    this.combustion(payload.intensity, dt);

    // 7. Divergence
    this.computeDivergence(texelSize);

    // 8. Jacobi pressure solve
    this.clearFBO(this.press.write);
    this.press.swap();
    for (let i = 0; i < iterations; i++) {
      this.jacobiIteration(texelSize);
    }

    // 9. Gradient subtraction
    this.gradientSubtract(texelSize);

    // 10. Advect temperature + fuel
    this.advect("fire-advection", this.temp, this.temp.read, texelSize, TEMPERATURE_DISSIPATION, dt);
    this.advect("fire-advection", this.fuel, this.fuel.read, texelSize, FUEL_DISSIPATION, dt);

    // 11. Display render -> fire-display FBO
    this.display(payload);

    // 12. Bloom post-process
    this.bloom();

    // 13. Composite onto screen
    this.compositeToScreen();
  }

  dispose(): void {
    // FBOs are managed by FBOPool -- release named keys
    const keys = [
      "fire-vel", "fire-temp", "fire-fuel", "fire-pressure", "fire-color",
      "fire-curl", "fire-divergence", "fire-display",
    ];
    for (const k of keys) this.fbos.release(k);
    for (let i = 0; i < BLOOM_MIP_COUNT; i++) this.fbos.release(`fire-bloom-${i}`);
    this.initialized = false;
  }

  // ── FBO initialization ──────────────────────────────────────────────────

  private initFBOs(): void {
    // Ping-pong pairs for double-buffered sim fields (rgba16f for float precision)
    this.vel = this.fbos.getOrAllocatePair("fire-vel", "rgba16f");
    this.temp = this.fbos.getOrAllocatePair("fire-temp", "rgba16f");
    this.fuel = this.fbos.getOrAllocatePair("fire-fuel", "rgba16f");
    this.press = this.fbos.getOrAllocatePair("fire-pressure", "rgba16f");
    this.color = this.fbos.getOrAllocatePair("fire-color", "rgba16f");

    // Single-buffer targets
    this.fbos.getOrAllocateSized("fire-curl", SIM_SIZE, SIM_SIZE, "rgba16f");
    this.fbos.getOrAllocateSized("fire-divergence", SIM_SIZE, SIM_SIZE, "rgba16f");
    this.fbos.getOrAllocateSized("fire-display", SIM_SIZE, SIM_SIZE, "rgba16f");

    // Bloom mip chain: 4 levels, each half the previous
    let w = Math.max(1, SIM_SIZE >> 1);
    let h = Math.max(1, SIM_SIZE >> 1);
    for (let i = 0; i < BLOOM_MIP_COUNT; i++) {
      this.fbos.getOrAllocateSized(`fire-bloom-${i}`, w, h, "rgba16f");
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }

  /** Cache per-tip array uniform locations on the display shader to avoid per-frame stalls. */
  private cacheTipUniformLocations(): void {
    const prog = this.shaders.get("fire-display");
    const gl = this.gl;
    const MAX_TIPS = 16;

    this.tipPositionLocs = new Array(MAX_TIPS);
    this.tipSpeedLocs = new Array(MAX_TIPS);
    this.tipFlameScaleLocs = new Array(MAX_TIPS);
    this.tipColorLocs = new Array(MAX_TIPS);

    for (let i = 0; i < MAX_TIPS; i++) {
      this.tipPositionLocs[i] = gl.getUniformLocation(prog.program, `u_tipPositions[${i}]`);
      this.tipSpeedLocs[i] = gl.getUniformLocation(prog.program, `u_tipSpeeds[${i}]`);
      this.tipFlameScaleLocs[i] = gl.getUniformLocation(prog.program, `u_tipFlameScales[${i}]`);
      this.tipColorLocs[i] = gl.getUniformLocation(prog.program, `u_tipColors[${i}]`);
    }
  }

  // ── Splat: inject fuel, velocity, temperature at source points ──────────

  private splat(src: FireSourcePoint, intensity: number): void {
    const _gl = this.gl;
    const prog = this.shaders.get("fire-splat");

    // Convert NDC position to UV
    const u = (src.position[0] + 1) / 2;
    const v = (src.position[1] + 1) / 2;
    const radius = src.radius > 0 ? src.radius : SPLAT_RADIUS;

    // Fuel splat
    this.splatField(prog, this.fuel, u, v, src.density * intensity, 0, 0, radius);

    // Velocity splat
    this.splatField(prog, this.vel, u, v, src.velocity[0], src.velocity[1], 0, radius);

    // Temperature splat
    this.splatField(prog, this.temp, u, v, src.temperature * intensity, 0, 0, radius);
  }

  private splatField(
    prog: CompiledProgram,
    target: PingPongPair,
    x: number, y: number,
    r: number, g: number, b: number,
    radius: number,
  ): void {
    const gl = this.gl;
    gl.useProgram(prog.program);

    this.bindTexture(0, target.read.texture);
    gl.uniform1i(prog.uniforms["u_target"]!, 0);
    gl.uniform2f(prog.uniforms["u_point"]!, x, y);
    gl.uniform3f(prog.uniforms["u_splatValue"]!, r, g, b);
    gl.uniform1f(prog.uniforms["u_radius"]!, radius);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.write.framebuffer);
    this.drawQuad();
    target.swap();
  }

  // ── Advection: Semi-Lagrangian backtracing ──────────────────────────────

  private advect(
    _programName: string,
    target: PingPongPair,
    source: FBO,
    texelSize: [number, number],
    dissipation: number,
    dt: number,
  ): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-advection");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.vel.read.texture);
    gl.uniform1i(prog.uniforms["u_velocity"]!, 0);

    this.bindTexture(1, source.texture);
    gl.uniform1i(prog.uniforms["u_source"]!, 1);

    gl.uniform2f(prog.uniforms["u_texelSize"]!, texelSize[0], texelSize[1]);
    gl.uniform1f(prog.uniforms["u_dt"]!, dt);
    gl.uniform1f(prog.uniforms["u_dissipation"]!, dissipation);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.write.framebuffer);
    this.drawQuad();
    target.swap();
  }

  // ── Curl: scalar vorticity of 2D velocity field ─────────────────────────

  private computeCurl(texelSize: [number, number]): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-curl");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.vel.read.texture);
    gl.uniform1i(prog.uniforms["u_velocity"]!, 0);
    gl.uniform2f(prog.uniforms["u_texelSize"]!, texelSize[0], texelSize[1]);

    const curlFBO = this.fbos.getOrAllocateSized("fire-curl", SIM_SIZE, SIM_SIZE, "rgba16f");
    gl.bindFramebuffer(gl.FRAMEBUFFER, curlFBO.framebuffer);
    this.drawQuad();
  }

  // ── Vorticity confinement ───────────────────────────────────────────────

  private applyVorticity(texelSize: [number, number], turbulence: number, dt: number): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-vorticity");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.vel.read.texture);
    gl.uniform1i(prog.uniforms["u_velocity"]!, 0);

    const curlFBO = this.fbos.getOrAllocateSized("fire-curl", SIM_SIZE, SIM_SIZE, "rgba16f");
    this.bindTexture(1, curlFBO.texture);
    gl.uniform1i(prog.uniforms["u_curl"]!, 1);

    gl.uniform2f(prog.uniforms["u_texelSize"]!, texelSize[0], texelSize[1]);
    gl.uniform1f(prog.uniforms["u_dt"]!, dt);
    gl.uniform1f(prog.uniforms["u_strength"]!, VORTICITY_STRENGTH);
    gl.uniform1f(prog.uniforms["u_time"]!, this.elapsedTime);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.vel.write.framebuffer);
    this.drawQuad();
    this.vel.swap();
  }

  // ── Curl noise turbulence ───────────────────────────────────────────────

  private applyCurlNoise(texelSize: [number, number], turbulence: number, dt: number): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-curl-noise");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.vel.read.texture);
    gl.uniform1i(prog.uniforms["u_velocity"]!, 0);

    this.bindTexture(1, this.temp.read.texture);
    gl.uniform1i(prog.uniforms["u_temperature"]!, 1);

    gl.uniform2f(prog.uniforms["u_texelSize"]!, texelSize[0], texelSize[1]);
    gl.uniform1f(prog.uniforms["u_dt"]!, dt);
    gl.uniform1f(prog.uniforms["u_time"]!, this.elapsedTime);

    // Strength scaled by vorticity strength so turbulence is proportional
    // to the overall fire intensity. The turbulence parameter (0-1) maps
    // to a 0-8x multiplier on the base vorticity strength.
    const strength = VORTICITY_STRENGTH * turbulence * 8.0;
    gl.uniform1f(prog.uniforms["u_strength"]!, strength);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.vel.write.framebuffer);
    this.drawQuad();
    this.vel.swap();
  }

  // ── Buoyancy: hot fluid rises ───────────────────────────────────────────

  private applyBuoyancy(buoyancy: number, dt: number): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-buoyancy");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.vel.read.texture);
    gl.uniform1i(prog.uniforms["u_velocity"]!, 0);

    this.bindTexture(1, this.temp.read.texture);
    gl.uniform1i(prog.uniforms["u_temperature"]!, 1);

    gl.uniform1f(prog.uniforms["u_dt"]!, dt);
    gl.uniform1f(prog.uniforms["u_buoyancy"]!, buoyancy);
    gl.uniform1f(prog.uniforms["u_ambientTemp"]!, AMBIENT_TEMP);

    // Raise terminal velocity ceiling when gravity is active so fluid can fall
    const termVel = GRAVITY < 0 ? 14.0 : TERMINAL_VELOCITY;
    gl.uniform1f(prog.uniforms["u_terminalVelocity"]!, termVel);
    gl.uniform1f(prog.uniforms["u_gravity"]!, GRAVITY);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.vel.write.framebuffer);
    this.drawQuad();
    this.vel.swap();
  }

  // ── Combustion + cooling ────────────────────────────────────────────────

  private combustion(intensity: number, dt: number): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-combustion");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.temp.read.texture);
    gl.uniform1i(prog.uniforms["u_temperature"]!, 0);

    this.bindTexture(1, this.fuel.read.texture);
    gl.uniform1i(prog.uniforms["u_fuel"]!, 1);

    gl.uniform1f(prog.uniforms["u_dt"]!, dt);
    gl.uniform1f(prog.uniforms["u_burnRate"]!, BURN_RATE * intensity);
    gl.uniform1f(prog.uniforms["u_burnTemp"]!, BURN_TEMP);
    gl.uniform1f(prog.uniforms["u_fuelEfficiency"]!, FUEL_EFFICIENCY);
    gl.uniform1f(prog.uniforms["u_coolingRate"]!, COOLING_RATE);
    gl.uniform1f(prog.uniforms["u_ambientTemp"]!, AMBIENT_TEMP);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.temp.write.framebuffer);
    this.drawQuad();
    this.temp.swap();
  }

  // ── Divergence ──────────────────────────────────────────────────────────

  private computeDivergence(texelSize: [number, number]): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-divergence");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.vel.read.texture);
    gl.uniform1i(prog.uniforms["u_velocity"]!, 0);
    gl.uniform2f(prog.uniforms["u_texelSize"]!, texelSize[0], texelSize[1]);

    const divFBO = this.fbos.getOrAllocateSized("fire-divergence", SIM_SIZE, SIM_SIZE, "rgba16f");
    gl.bindFramebuffer(gl.FRAMEBUFFER, divFBO.framebuffer);
    this.drawQuad();
  }

  // ── Jacobi pressure iteration ───────────────────────────────────────────

  private jacobiIteration(texelSize: [number, number]): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-jacobi");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.press.read.texture);
    gl.uniform1i(prog.uniforms["u_pressure"]!, 0);

    const divFBO = this.fbos.getOrAllocateSized("fire-divergence", SIM_SIZE, SIM_SIZE, "rgba16f");
    this.bindTexture(1, divFBO.texture);
    gl.uniform1i(prog.uniforms["u_divergence"]!, 1);

    gl.uniform2f(prog.uniforms["u_texelSize"]!, texelSize[0], texelSize[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.press.write.framebuffer);
    this.drawQuad();
    this.press.swap();
  }

  // ── Gradient subtraction: make velocity divergence-free ─────────────────

  private gradientSubtract(texelSize: [number, number]): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-gradient-subtract");
    gl.useProgram(prog.program);

    this.bindTexture(0, this.vel.read.texture);
    gl.uniform1i(prog.uniforms["u_velocity"]!, 0);

    this.bindTexture(1, this.press.read.texture);
    gl.uniform1i(prog.uniforms["u_pressure"]!, 1);

    gl.uniform2f(prog.uniforms["u_texelSize"]!, texelSize[0], texelSize[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.vel.write.framebuffer);
    this.drawQuad();
    this.vel.swap();
  }

  // ── Display: temperature -> blackbody color + wick cores ────────────────

  private display(payload: FirePassPayload): void {
    const gl = this.gl;
    const prog = this.shaders.get("fire-display");
    gl.useProgram(prog.program);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
    );

    const displayFBO = this.fbos.getOrAllocateSized("fire-display", SIM_SIZE, SIM_SIZE, "rgba16f");
    gl.bindFramebuffer(gl.FRAMEBUFFER, displayFBO.framebuffer);
    gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.bindTexture(0, this.temp.read.texture);
    gl.uniform1i(prog.uniforms["u_temperature"]!, 0);

    this.bindTexture(1, this.fuel.read.texture);
    gl.uniform1i(prog.uniforms["u_fuel"]!, 1);

    // Color field texture (for prop-colored fire)
    this.bindTexture(2, this.color.read.texture);
    gl.uniform1i(prog.uniforms["u_colorField"]!, 2);

    gl.uniform1f(prog.uniforms["u_displayIntensity"]!, DISPLAY_INTENSITY * payload.intensity);
    gl.uniform1f(prog.uniforms["u_colorBlend"]!, 0);
    gl.uniform1f(prog.uniforms["u_time"]!, this.elapsedTime);

    // Extract color curve from payload stops or fall back to defaults
    const cold = this.findColorStop(payload.colorCurve, 0, DEFAULT_COLD);
    const mid = this.findColorStop(payload.colorCurve, 1, DEFAULT_MID);
    const hot = this.findColorStop(payload.colorCurve, 2, DEFAULT_HOT);
    const core = this.findColorStop(payload.colorCurve, 3, DEFAULT_CORE);

    gl.uniform3f(prog.uniforms["u_colorCold"]!, cold[0], cold[1], cold[2]);
    gl.uniform3f(prog.uniforms["u_colorMid"]!, mid[0], mid[1], mid[2]);
    gl.uniform3f(prog.uniforms["u_colorHot"]!, hot[0], hot[1], hot[2]);
    gl.uniform3f(prog.uniforms["u_colorCore"]!, core[0], core[1], core[2]);

    // Wick core tip positions (converted from NDC to UV)
    const tipCount = Math.min(payload.sources.length, 16);
    gl.uniform1i(prog.uniforms["u_tipCount"]!, tipCount);

    for (let i = 0; i < tipCount; i++) {
      const src = payload.sources[i]!;
      const tipU = (src.position[0] + 1) / 2;
      const tipV = (src.position[1] + 1) / 2;

      const posLoc = this.tipPositionLocs[i];
      if (posLoc) gl.uniform2f(posLoc, tipU, tipV);

      const speedLoc = this.tipSpeedLocs[i];
      if (speedLoc) gl.uniform1f(speedLoc, Math.sqrt(src.velocity[0] ** 2 + src.velocity[1] ** 2));

      const scaleLoc = this.tipFlameScaleLocs[i];
      if (scaleLoc) gl.uniform1f(scaleLoc, Math.max(0.5, src.radius / SPLAT_RADIUS));

      const colorLoc = this.tipColorLocs[i];
      if (colorLoc) gl.uniform3f(colorLoc, hot[0], hot[1], hot[2]);
    }

    // Aspect correction (square sim grid = 1:1)
    gl.uniform2f(prog.uniforms["u_aspectCorrect"]!, 1.0, 1.0);

    this.drawQuad();
  }

  // ── Bloom post-process ──────────────────────────────────────────────────

  private bloom(): void {
    const gl = this.gl;
    gl.disable(gl.BLEND);

    const displayFBO = this.fbos.getOrAllocateSized("fire-display", SIM_SIZE, SIM_SIZE, "rgba16f");

    // Collect mip FBOs and their sizes
    const mips: FBO[] = [];
    const sizes: [number, number][] = [];
    let w = Math.max(1, SIM_SIZE >> 1);
    let h = Math.max(1, SIM_SIZE >> 1);
    for (let i = 0; i < BLOOM_MIP_COUNT; i++) {
      mips.push(this.fbos.getOrAllocateSized(`fire-bloom-${i}`, w, h, "rgba16f"));
      sizes.push([w, h]);
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
    if (mips.length === 0) return;

    // --- Downsample chain ---
    const downProg = this.shaders.get("bloom-downsample");
    gl.useProgram(downProg.program);

    // First downsample: displayFBO -> mip[0]
    this.bindTexture(0, displayFBO.texture);
    gl.uniform1i(downProg.uniforms["u_source"]!, 0);
    gl.uniform2f(downProg.uniforms["u_texelSize"]!, 1.0 / SIM_SIZE, 1.0 / SIM_SIZE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, mips[0]!.framebuffer);
    gl.viewport(0, 0, sizes[0]![0], sizes[0]![1]);
    this.drawQuad();

    // Subsequent downsamples: mip[i-1] -> mip[i]
    for (let i = 1; i < mips.length; i++) {
      this.bindTexture(0, mips[i - 1]!.texture);
      gl.uniform2f(downProg.uniforms["u_texelSize"]!, 1.0 / sizes[i - 1]![0], 1.0 / sizes[i - 1]![1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mips[i]!.framebuffer);
      gl.viewport(0, 0, sizes[i]![0], sizes[i]![1]);
      this.drawQuad();
    }

    // --- Upsample chain (additive accumulation) ---
    const upProg = this.shaders.get("bloom-upsample");
    gl.useProgram(upProg.program);
    gl.uniform1f(upProg.uniforms["u_bloomRadius"]!, 1.0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive blend for bloom accumulation

    for (let i = mips.length - 1; i > 0; i--) {
      this.bindTexture(0, mips[i]!.texture);
      gl.uniform1i(upProg.uniforms["u_source"]!, 0);
      gl.uniform2f(upProg.uniforms["u_texelSize"]!, 1.0 / sizes[i]![0], 1.0 / sizes[i]![1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mips[i - 1]!.framebuffer);
      gl.viewport(0, 0, sizes[i - 1]![0], sizes[i - 1]![1]);
      this.drawQuad();
    }

    // Restore premultiplied alpha blend
    gl.blendFuncSeparate(
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
    );
  }

  // ── Composite to screen ─────────────────────────────────────────────────

  private compositeToScreen(): void {
    const gl = this.gl;
    const compProg = this.shaders.get("fire-bloom-composite");
    gl.useProgram(compProg.program);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
    );

    const displayFBO = this.fbos.getOrAllocateSized("fire-display", SIM_SIZE, SIM_SIZE, "rgba16f");
    this.bindTexture(0, displayFBO.texture);
    gl.uniform1i(compProg.uniforms["u_scene"]!, 0);

    const bloomMip0 = this.fbos.getOrAllocateSized(
      "fire-bloom-0",
      Math.max(1, SIM_SIZE >> 1),
      Math.max(1, SIM_SIZE >> 1),
      "rgba16f",
    );
    this.bindTexture(1, bloomMip0.texture);
    gl.uniform1i(compProg.uniforms["u_bloom"]!, 1);

    gl.uniform1f(compProg.uniforms["u_bloomStrength"]!, BLOOM_STRENGTH);

    // Bind to null framebuffer (screen) -- the backend's frame loop
    // will have set the viewport to the canvas dimensions already,
    // but we re-bind to null to ensure we hit the screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.drawQuad();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private clearFBO(fbo: FBO): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private bindTexture(unit: number, texture: WebGLTexture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  /** Draw fullscreen quad via 6-vertex gl_VertexID (two triangles). */
  private drawQuad(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Extract a color from the payload's color curve by index, falling back to
   * a default if the curve is too short or missing.
   */
  private findColorStop(
    curve: FireColorStop[] | undefined,
    index: number,
    fallback: [number, number, number],
  ): [number, number, number] {
    if (!curve || index >= curve.length) return fallback;
    return curve[index]!.color;
  }
}
