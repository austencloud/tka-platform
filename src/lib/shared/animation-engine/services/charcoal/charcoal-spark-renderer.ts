/**
 * CharcoalSparkRenderer - WebGL2 Point-Sprite Particle System
 *
 * Discrete spark particles that burst on direction changes and fall
 * under gravity, producing steel-wool / charcoal ember aesthetics.
 *
 * Architecture:
 *   - Pre-allocated particle pool (zero allocation in the hot path)
 *   - Two shader programs: spark point sprites + ember glow halos
 *   - Additive blending (SRC_ALPHA, ONE) for bright-on-dark compositing
 *   - Burst emission on high jerk (direction reversals)
 *   - Ambient emission during sustained movement
 *   - Gravity + drag physics per particle
 *   - Temperature-based color (core -> mid -> cool over lifetime)
 *
 * Implements ICharcoalRenderer - architecturally independent from
 * the fire overlay renderer (different physics, shaders, visual output).
 */

import type {
	FireFrameInput,
	FireOverlayConfig,
	PropTipData,
} from "../../domain/types/fire-types";
import type {
	CharcoalSpark,
	CharcoalSparkParams,
} from "../../domain/types/charcoal-spark-types";
import { DEFAULT_CHARCOAL_PARAMS } from "../../domain/types/charcoal-spark-types";

// ============================================================================
// Constants
// ============================================================================

const MAX_DPR = 2;

/**
 * Tip positions from FireTipTracker are in canvas-pixel space
 * (0..canvasSize), NOT the fixed 950 viewbox. We read the actual
 * canvas size from FireFrameInput.canvasWidth / canvasHeight each frame.
 */

// ============================================================================
// Shader Sources (GLSL 300 ES)
// ============================================================================

const SPARK_VERTEX = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_position;
in float a_size;
in vec4 a_color;

uniform vec2 u_resolution;
uniform vec2 u_viewbox;

out vec4 v_color;

void main() {
  // Map viewbox coordinates to NDC [-1, 1]
  vec2 ndc = (a_position / u_viewbox) * 2.0 - 1.0;
  ndc.y = -ndc.y; // Flip Y: viewbox Y-down -> GL Y-up

  gl_Position = vec4(ndc, 0.0, 1.0);

  // Scale point size from viewbox units to device pixels
  float pixelsPerUnit = u_resolution.x / u_viewbox.x;
  gl_PointSize = a_size * pixelsPerUnit;

  v_color = a_color;
}
`;

const SPARK_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  // Distance from point center (gl_PointCoord is [0,1] within the point sprite)
  vec2 coord = gl_PointCoord - 0.5;
  float dist = length(coord) * 2.0; // Normalize to [0, 1] at edge

  // Soft circular falloff: bright core, soft edges
  float alpha = pow(1.0 - smoothstep(0.0, 1.0, dist), 1.8);

  // v_color is already premultiplied; scale by the radial falloff
  fragColor = v_color * alpha;
}
`;

const EMBER_VERTEX = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_position;

uniform vec2 u_resolution;
uniform vec2 u_viewbox;
uniform float u_radius;

void main() {
  vec2 ndc = (a_position / u_viewbox) * 2.0 - 1.0;
  ndc.y = -ndc.y;

  gl_Position = vec4(ndc, 0.0, 1.0);

  float pixelsPerUnit = u_resolution.x / u_viewbox.x;
  gl_PointSize = u_radius * 2.0 * pixelsPerUnit;
}
`;

const EMBER_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform vec4 u_color;
uniform float u_intensity;

out vec4 fragColor;

void main() {
  vec2 coord = gl_PointCoord - 0.5;
  float dist = length(coord) * 2.0;

  // Very soft exponential glow
  float glow = exp(-dist * dist * 3.0) * u_intensity;

  // Premultiplied output
  fragColor = vec4(u_color.rgb * glow, glow);
}
`;

// ============================================================================
// Shader program helper
// ============================================================================

interface ShaderProgram {
	program: WebGLProgram;
	uniforms: Map<string, WebGLUniformLocation>;
	attributes: Map<string, number>;
}

// ============================================================================
// CharcoalSparkRenderer
// ============================================================================

export class CharcoalSparkRenderer {
	private canvas: HTMLCanvasElement | null = null;
	private gl: WebGL2RenderingContext | null = null;
	private initialized = false;
	private dpr = 1;

	// Shader programs
	private sparkProgram: ShaderProgram | null = null;
	private emberProgram: ShaderProgram | null = null;

	// Particle pool
	private particles: CharcoalSpark[] = [];
	private maxParticles = 0;

	// GPU buffers for spark rendering
	private sparkVAO: WebGLVertexArrayObject | null = null;
	private positionBuffer: WebGLBuffer | null = null;
	private sizeBuffer: WebGLBuffer | null = null;
	private colorBuffer: WebGLBuffer | null = null;

	// GPU buffers for ember glow rendering
	private emberVAO: WebGLVertexArrayObject | null = null;
	private emberPositionBuffer: WebGLBuffer | null = null;

	// CPU-side typed arrays (reused each frame, no allocation)
	private positionData: Float32Array = new Float32Array(0);
	private sizeData: Float32Array = new Float32Array(0);
	private colorData: Float32Array = new Float32Array(0);
	private emberPositionData: Float32Array = new Float32Array(0);

	// Timing
	private lastTime = 0;
	private reducedMotion = false;

	// Ambient emission accumulator per tip (fractional spark carry)
	private ambientAccumulators: Map<string, number> = new Map();

	// Current params (updated externally via setParams)
	private currentParams: CharcoalSparkParams = { ...DEFAULT_CHARCOAL_PARAMS };

	// Emission density scale. Quadratic (area-based) so particles-per-unit-area
	// stays constant as the canvas shrinks.
	private canvasScale = 1.0;
	// Linear scale for particle size + ember glow radius. Sparks authored at
	// the reference size need to shrink proportionally on smaller canvases
	// so the halo stays the same fraction of the frame.
	private sizeScale = 1.0;
	// Charcoal default params (sizeMin/Max, emberGlowRadius) were tuned on
	// a 950px canvas, so the linear size-scale is referenced to 950 - not
	// the project-wide 500 - to preserve the look at full size.
	private static readonly REFERENCE_SIZE = 950;

	// ======================================================================
	// IFireOverlayRenderer implementation
	// ======================================================================

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
		const areaRatio = (width * height) / (CharcoalSparkRenderer.REFERENCE_SIZE ** 2);
		this.canvasScale = Math.max(0.1, Math.min(1.0, areaRatio));
		const minDim = Math.min(width, height);
		this.sizeScale = Math.max(0.1, Math.min(1.0, minDim / CharcoalSparkRenderer.REFERENCE_SIZE));

		this.gl = this.canvas!.getContext("webgl2", {
			alpha: true,
			premultipliedAlpha: true,
			antialias: false,
			depth: false,
			stencil: false,
			preserveDrawingBuffer: true,
		}) as WebGL2RenderingContext | null;

		if (!this.gl) {
			console.warn("WebGL2 not available for charcoal spark overlay");
			this.cleanup();
			return false;
		}

		if (!this.compilePrograms()) {
			this.cleanup();
			return false;
		}

		this.allocateParticlePool(this.currentParams.maxParticles);
		this.createGPUBuffers();

		const gl = this.gl;
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		gl.disable(gl.DEPTH_TEST);

		if (isDom && typeof window !== "undefined" && window.matchMedia) {
			this.reducedMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)"
			).matches;
		}

		this.lastTime = performance.now();
		this.initialized = true;
		return true;
	}

	resize(width: number, height: number): void {
		if (!this.canvas) return;
		this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		this.canvas.width = Math.round(width * this.dpr);
		this.canvas.height = Math.round(height * this.dpr);

		// Scale emission density by canvas area relative to reference size.
		// A 300px canvas gets ~10% of the particles of a 950px canvas,
		// keeping visual density proportional instead of overwhelming small previews.
		const areaRatio = (width * height) / (CharcoalSparkRenderer.REFERENCE_SIZE ** 2);
		this.canvasScale = Math.max(0.1, Math.min(1.0, areaRatio));
		const minDim = Math.min(width, height);
		this.sizeScale = Math.max(0.1, Math.min(1.0, minDim / CharcoalSparkRenderer.REFERENCE_SIZE));
	}

	renderCharcoal(input: FireFrameInput, _config: FireOverlayConfig): void {
		if (!this.initialized || !this.gl || !this.canvas) return;

		// Deterministic when an explicit dt (seconds) is supplied (export); else
		// derive the wall-clock delta so the live path is byte-identical.
		const now = input.currentTime;
		const srcDt =
			input.dt ?? (this.lastTime > 0 ? (now - this.lastTime) / 1000 : 0);
		this.lastTime = now;
		let dt = Math.min(srcDt, 0.033);
		if (this.reducedMotion) dt *= 0.2;
		if (dt <= 0) dt = 0.016;

		// On loop: seamless sequences keep sparks continuous; non-seamless deactivate
		// existing particles so they don't linger at old positions.
		if (input.loopDetected && !input.isSeamlesslyLoopable) {
			this.clearSimulation();
		}

		const params = this.currentParams;

		// Emission
		for (const tip of input.tips) {
			this.emitFromTip(tip, params, dt);
		}

		// Physics update
		this.updateParticles(params, dt);

		// Render
		this.draw(input, params);
	}

	clearSimulation(): void {
		for (const p of this.particles) {
			p.active = false;
		}
		this.ambientAccumulators.clear();
		// Blank the visible default framebuffer too. preserveDrawingBuffer:true
		// retains the last spark frame in the drawing buffer; when this renderer is
		// parked warm (canvas hidden via keep-warm) then re-shown, the browser
		// composites that stale frame for one frame before draw()'s gl.clear runs.
		// Clearing here mirrors fire's clearSimulation and removes the flash.
		// (0,0,0,0) is correct under premultipliedAlpha:true.
		const gl = this.gl;
		if (gl && this.initialized) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
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

	// ======================================================================
	// Parameter updates
	// ======================================================================

	/** Update spark params from external sliders. Only reallocates pool when maxParticles changes. */
	setParams(params: CharcoalSparkParams): void {
		const poolChanged = params.maxParticles !== this.maxParticles;
		this.currentParams = params;

		if (poolChanged) {
			this.allocateParticlePool(params.maxParticles);
			this.resizeGPUBuffers();
		}
	}

	// ======================================================================
	// Particle pool
	// ======================================================================

	private allocateParticlePool(count: number): void {
		this.maxParticles = count;
		this.particles = [];
		for (let i = 0; i < count; i++) {
			this.particles.push({
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				life: 0,
				maxLife: 0,
				size: 0,
				temperature: 0,
				active: false,
			});
		}

		// CPU-side typed arrays
		this.positionData = new Float32Array(count * 2);
		this.sizeData = new Float32Array(count);
		this.colorData = new Float32Array(count * 4);
	}

	// ======================================================================
	// Emission
	// ======================================================================

	private emitFromTip(
		tip: PropTipData,
		params: CharcoalSparkParams,
		dt: number
	): void {
		const scale = this.canvasScale;

		// Burst emission on high jerk (direction reversals)
		if (tip.jerk > params.burstThreshold) {
			const excess = tip.jerk - params.burstThreshold;
			const count = Math.min(
				Math.floor(excess * params.burstMultiplier * scale),
				Math.floor(params.burstMax * scale)
			);
			for (let i = 0; i < count; i++) {
				this.spawnParticle(tip, params);
			}
		}

		// Ambient emission during sustained movement - proportional to speed.
		// Scaled by canvas area so small previews aren't overwhelmed.
		const tipKey = `${tip.propIndex}_${tip.tipIndex}`;

		if (tip.speed > params.ambientSpeedThreshold) {
			const speedFactor = tip.speed / 150;
			const accumulated =
				(this.ambientAccumulators.get(tipKey) ?? 0) +
				params.ambientRate * speedFactor * scale * dt;
			const toEmit = Math.floor(accumulated);

			this.ambientAccumulators.set(tipKey, accumulated - toEmit);

			for (let i = 0; i < toEmit; i++) {
				this.spawnParticle(tip, params);
			}
		} else if (params.idleRate > 0) {
			const accumulated =
				(this.ambientAccumulators.get(tipKey) ?? 0) +
				params.idleRate * scale * dt;
			const toEmit = Math.floor(accumulated);

			this.ambientAccumulators.set(tipKey, accumulated - toEmit);

			for (let i = 0; i < toEmit; i++) {
				this.spawnIdleParticle(tip, params);
			}
		}
	}

	private spawnParticle(tip: PropTipData, params: CharcoalSparkParams): void {
		// Find an inactive slot (oldest first)
		const slot = this.findInactiveSlot();
		if (!slot) return;

		// Inherit a fraction of the tip's velocity vector.
		// Sparks carry the tip's momentum - they fly where the tip was going
		// but slower, so the tip leaves them behind. On direction reversals,
		// the burst system (jerk detection) creates the dramatic spark pops.
		const inheritedVx = tip.velocityX * params.velocityInheritance;
		const inheritedVy = tip.velocityY * params.velocityInheritance;

		// Add random perturbation centered on the tip's velocity direction.
		// If the tip is nearly stationary, use a fully random direction.
		const perturbAngle =
			tip.speed > 1
				? Math.atan2(tip.velocityY, tip.velocityX) +
					(Math.random() - 0.5) * 2.0 * params.spreadAngle
				: Math.random() * Math.PI * 2;

		const perturbSpeed =
			params.perturbSpeedMin +
			Math.random() * (params.perturbSpeedMax - params.perturbSpeedMin);

		slot.x = tip.x;
		slot.y = tip.y;
		slot.vx = inheritedVx + Math.cos(perturbAngle) * perturbSpeed;
		slot.vy = inheritedVy + Math.sin(perturbAngle) * perturbSpeed;
		slot.maxLife =
			params.lifetimeMin +
			Math.random() * (params.lifetimeMax - params.lifetimeMin);
		slot.life = slot.maxLife;
		slot.size =
			(params.sizeMin + Math.random() * (params.sizeMax - params.sizeMin)) *
			this.sizeScale;
		slot.temperature = 1.0;
		slot.active = true;
	}

	/**
	 * Spawn a low-energy particle for idle/stationary tips.
	 * Minimal horizontal velocity - gravity pulls them straight down
	 * like embers falling off a still-burning prop.
	 */
	private spawnIdleParticle(tip: PropTipData, params: CharcoalSparkParams): void {
		const slot = this.findInactiveSlot();
		if (!slot) return;

		// Random direction, very low speed (just enough to spread slightly)
		const angle = Math.random() * Math.PI * 2;
		const speed = params.perturbSpeedMin * 0.3;

		slot.x = tip.x;
		slot.y = tip.y;
		slot.vx = Math.cos(angle) * speed;
		slot.vy = Math.sin(angle) * speed;
		slot.maxLife =
			params.lifetimeMin +
			Math.random() * (params.lifetimeMax - params.lifetimeMin) * 0.6;
		slot.life = slot.maxLife;
		slot.size =
			(params.sizeMin + Math.random() * (params.sizeMax - params.sizeMin) * 0.5) *
			this.sizeScale;
		slot.temperature = 0.7 + Math.random() * 0.3; // Cooler starting temp
		slot.active = true;
	}

	private findInactiveSlot(): CharcoalSpark | null {
		// First pass: find any inactive slot
		for (const p of this.particles) {
			if (!p.active) return p;
		}

		// Pool full: recycle the oldest particle (lowest remaining life)
		let oldest: CharcoalSpark | null = null;
		let lowestLife = Infinity;
		for (const p of this.particles) {
			if (p.life < lowestLife) {
				lowestLife = p.life;
				oldest = p;
			}
		}
		return oldest;
	}

	// ======================================================================
	// Physics
	// ======================================================================

	private updateParticles(params: CharcoalSparkParams, dt: number): void {
		const dragPerFrame = Math.pow(params.drag, dt);

		for (const p of this.particles) {
			if (!p.active) continue;

			// Apply gravity (positive = downward in viewbox Y-down space)
			p.vy += params.gravity * dt;

			// Apply drag
			p.vx *= dragPerFrame;
			p.vy *= dragPerFrame;

			// Integrate position
			p.x += p.vx * dt;
			p.y += p.vy * dt;

			// Decay lifetime and temperature
			p.life -= dt;
			p.temperature = Math.max(0, p.life / p.maxLife);

			// Shrink over life
			if (params.shrinkOverLife) {
				// Keep original spawn size encoded in maxLife ratio
				// size stays constant first 50%, then shrinks
				const lifeRatio = p.life / p.maxLife;
				if (lifeRatio < 0.5) {
					// sizeMin is the floor; original size is in p.size
					// We don't want to keep overwriting, so just scale
					// Actually we need original size. Use temperature as proxy:
					// at t=0.5, size = full. at t=0, size = sizeMin
					// Avoid storing extra data by using a smooth ramp
				}
			}

			// Deactivate dead particles
			if (p.life <= 0) {
				p.active = false;
			}
		}
	}

	// ======================================================================
	// Rendering
	// ======================================================================

	private draw(input: FireFrameInput, params: CharcoalSparkParams): void {
		const gl = this.gl!;
		const canvas = this.canvas!;

		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const resolution: [number, number] = [canvas.width, canvas.height];
		const viewbox: [number, number] = [input.canvasWidth, input.canvasHeight];

		this.drawSparks(gl, params, resolution, viewbox);
		this.drawEmberGlows(gl, params, input.tips, resolution, viewbox);
	}

	private drawSparks(
		gl: WebGL2RenderingContext,
		params: CharcoalSparkParams,
		resolution: [number, number],
		viewbox: [number, number]
	): void {
		if (!this.sparkProgram || !this.sparkVAO) return;

		// Build CPU arrays from active particles
		let activeCount = 0;
		for (const p of this.particles) {
			if (!p.active) continue;
			const i = activeCount;

			// Position
			this.positionData[i * 2] = p.x;
			this.positionData[i * 2 + 1] = p.y;

			// Size (shrink in last half of life if enabled)
			let size = p.size;
			if (params.shrinkOverLife) {
				const lifeRatio = p.life / p.maxLife;
				if (lifeRatio < 0.5) {
					size *= lifeRatio * 2.0; // linear ramp from full to 0
				}
			}
			this.sizeData[i] = size;

			// Color from temperature
			const t = p.temperature;
			const [r, g, b] = this.temperatureToColor(t, params);

			// Opacity: fade in first 5%, full until 70%, fade out last 30%
			const lifeRatio = p.life / p.maxLife;
			let opacity: number;
			if (lifeRatio > 0.95) {
				// Fade in: first 5% of life
				opacity = (1.0 - lifeRatio) / 0.05;
			} else if (lifeRatio > 0.3) {
				// Full opacity
				opacity = 1.0;
			} else {
				// Fade out: last 30%
				opacity = lifeRatio / 0.3;
			}

			// Premultiply alpha for additive blending
			const a = opacity;
			this.colorData[i * 4] = r * a;
			this.colorData[i * 4 + 1] = g * a;
			this.colorData[i * 4 + 2] = b * a;
			this.colorData[i * 4 + 3] = a;

			activeCount++;
		}

		if (activeCount === 0) return;

		// Upload to GPU
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positionData, 0, activeCount * 2);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sizeData, 0, activeCount);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colorData, 0, activeCount * 4);

		// Draw
		const prog = this.sparkProgram;
		gl.useProgram(prog.program);
		gl.uniform2f(prog.uniforms.get("u_resolution")!, resolution[0], resolution[1]);
		gl.uniform2f(prog.uniforms.get("u_viewbox")!, viewbox[0], viewbox[1]);

		gl.bindVertexArray(this.sparkVAO);
		gl.drawArrays(gl.POINTS, 0, activeCount);
		gl.bindVertexArray(null);
	}

	private drawEmberGlows(
		gl: WebGL2RenderingContext,
		params: CharcoalSparkParams,
		tips: PropTipData[],
		resolution: [number, number],
		viewbox: [number, number]
	): void {
		if (!this.emberProgram || !this.emberVAO || tips.length === 0) return;

		// Resize ember position data if needed
		if (this.emberPositionData.length < tips.length * 2) {
			this.emberPositionData = new Float32Array(tips.length * 2);
		}

		for (let i = 0; i < tips.length; i++) {
			this.emberPositionData[i * 2] = tips[i]!.x;
			this.emberPositionData[i * 2 + 1] = tips[i]!.y;
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this.emberPositionBuffer);
		gl.bufferSubData(
			gl.ARRAY_BUFFER,
			0,
			this.emberPositionData,
			0,
			tips.length * 2
		);

		const prog = this.emberProgram;
		gl.useProgram(prog.program);
		gl.uniform2f(prog.uniforms.get("u_resolution")!, resolution[0], resolution[1]);
		gl.uniform2f(prog.uniforms.get("u_viewbox")!, viewbox[0], viewbox[1]);
		gl.uniform1f(prog.uniforms.get("u_radius")!, params.emberGlowRadius * this.sizeScale);
		gl.uniform1f(prog.uniforms.get("u_intensity")!, params.emberGlowIntensity);

		// Ember glow color: use the mid color (warm orange) normalized to 0-1
		const [mr, mg, mb] = params.midColor;
		gl.uniform4f(
			prog.uniforms.get("u_color")!,
			mr / 255,
			mg / 255,
			mb / 255,
			1.0
		);

		gl.bindVertexArray(this.emberVAO);
		gl.drawArrays(gl.POINTS, 0, tips.length);
		gl.bindVertexArray(null);
	}

	// ======================================================================
	// Color mapping
	// ======================================================================

	/**
	 * Map temperature [0, 1] through a 3-stop color ramp.
	 * Returns normalized [0, 1] RGB.
	 */
	private temperatureToColor(
		t: number,
		params: CharcoalSparkParams
	): [number, number, number] {
		let r: number, g: number, b: number;

		if (t > 0.5) {
			// Hot half: core -> mid
			const blend = (t - 0.5) * 2.0; // 0 at mid, 1 at core
			r = this.lerpChannel(params.midColor[0], params.coreColor[0], blend);
			g = this.lerpChannel(params.midColor[1], params.coreColor[1], blend);
			b = this.lerpChannel(params.midColor[2], params.coreColor[2], blend);
		} else {
			// Cool half: cool -> mid
			const blend = t * 2.0; // 0 at cool, 1 at mid
			r = this.lerpChannel(params.coolColor[0], params.midColor[0], blend);
			g = this.lerpChannel(params.coolColor[1], params.midColor[1], blend);
			b = this.lerpChannel(params.coolColor[2], params.midColor[2], blend);
		}

		// Normalize from 0-255 to 0-1
		return [r / 255, g / 255, b / 255];
	}

	private lerpChannel(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	// ======================================================================
	// Shader compilation
	// ======================================================================

	private compilePrograms(): boolean {
		const gl = this.gl!;

		this.sparkProgram = this.createShaderProgram(
			gl,
			SPARK_VERTEX,
			SPARK_FRAGMENT,
			["u_resolution", "u_viewbox"],
			["a_position", "a_size", "a_color"]
		);
		if (!this.sparkProgram) return false;

		this.emberProgram = this.createShaderProgram(
			gl,
			EMBER_VERTEX,
			EMBER_FRAGMENT,
			["u_resolution", "u_viewbox", "u_radius", "u_intensity", "u_color"],
			["a_position"]
		);
		if (!this.emberProgram) return false;

		return true;
	}

	private createShaderProgram(
		gl: WebGL2RenderingContext,
		vertSrc: string,
		fragSrc: string,
		uniformNames: string[],
		attributeNames: string[]
	): ShaderProgram | null {
		const vert = this.compileShader(gl, gl.VERTEX_SHADER, vertSrc);
		if (!vert) return null;

		const frag = this.compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
		if (!frag) {
			gl.deleteShader(vert);
			return null;
		}

		const program = gl.createProgram()!;
		gl.attachShader(program, vert);
		gl.attachShader(program, frag);
		gl.linkProgram(program);

		// Shaders can be detached after linking
		gl.deleteShader(vert);
		gl.deleteShader(frag);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.warn(
				"CharcoalSparkRenderer: program link failed:",
				gl.getProgramInfoLog(program)
			);
			gl.deleteProgram(program);
			return null;
		}

		const uniforms = new Map<string, WebGLUniformLocation>();
		for (const name of uniformNames) {
			const loc = gl.getUniformLocation(program, name);
			if (loc !== null) {
				uniforms.set(name, loc);
			}
		}

		const attributes = new Map<string, number>();
		for (const name of attributeNames) {
			const loc = gl.getAttribLocation(program, name);
			if (loc >= 0) {
				attributes.set(name, loc);
			}
		}

		return { program, uniforms, attributes };
	}

	private compileShader(
		gl: WebGL2RenderingContext,
		type: number,
		source: string
	): WebGLShader | null {
		const shader = gl.createShader(type)!;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const typeLabel = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
			console.warn(
				`CharcoalSparkRenderer: ${typeLabel} shader compile failed:`,
				gl.getShaderInfoLog(shader)
			);
			gl.deleteShader(shader);
			return null;
		}

		return shader;
	}

	// ======================================================================
	// GPU buffer management
	// ======================================================================

	private createGPUBuffers(): void {
		const gl = this.gl!;

		// === Spark VAO ===
		this.sparkVAO = gl.createVertexArray();
		gl.bindVertexArray(this.sparkVAO);

		const sparkProg = this.sparkProgram!;

		// Position buffer (vec2)
		this.positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			this.positionData.byteLength,
			gl.DYNAMIC_DRAW
		);
		const posLoc = sparkProg.attributes.get("a_position")!;
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

		// Size buffer (float)
		this.sizeBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.sizeData.byteLength, gl.DYNAMIC_DRAW);
		const sizeLoc = sparkProg.attributes.get("a_size")!;
		gl.enableVertexAttribArray(sizeLoc);
		gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

		// Color buffer (vec4)
		this.colorBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			this.colorData.byteLength,
			gl.DYNAMIC_DRAW
		);
		const colorLoc = sparkProg.attributes.get("a_color")!;
		gl.enableVertexAttribArray(colorLoc);
		gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

		gl.bindVertexArray(null);

		// === Ember VAO ===
		this.emberVAO = gl.createVertexArray();
		gl.bindVertexArray(this.emberVAO);

		const emberProg = this.emberProgram!;

		// Ember position buffer (vec2) - up to 16 tips max
		this.emberPositionData = new Float32Array(32);
		this.emberPositionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.emberPositionBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			this.emberPositionData.byteLength,
			gl.DYNAMIC_DRAW
		);
		const emberPosLoc = emberProg.attributes.get("a_position")!;
		gl.enableVertexAttribArray(emberPosLoc);
		gl.vertexAttribPointer(emberPosLoc, 2, gl.FLOAT, false, 0, 0);

		gl.bindVertexArray(null);
	}

	/** Resize GPU buffers when particle pool size changes. */
	private resizeGPUBuffers(): void {
		const gl = this.gl;
		if (!gl) return;

		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			this.positionData.byteLength,
			gl.DYNAMIC_DRAW
		);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.sizeData.byteLength, gl.DYNAMIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			this.colorData.byteLength,
			gl.DYNAMIC_DRAW
		);
	}

	// ======================================================================
	// Cleanup
	// ======================================================================

	private cleanup(): void {
		const gl = this.gl;

		if (gl) {
			// Delete VAOs
			if (this.sparkVAO) gl.deleteVertexArray(this.sparkVAO);
			if (this.emberVAO) gl.deleteVertexArray(this.emberVAO);

			// Delete buffers
			if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
			if (this.sizeBuffer) gl.deleteBuffer(this.sizeBuffer);
			if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
			if (this.emberPositionBuffer)
				gl.deleteBuffer(this.emberPositionBuffer);

			// Delete programs
			if (this.sparkProgram) gl.deleteProgram(this.sparkProgram.program);
			if (this.emberProgram) gl.deleteProgram(this.emberProgram.program);
		}

		this.sparkVAO = null;
		this.emberVAO = null;
		this.positionBuffer = null;
		this.sizeBuffer = null;
		this.colorBuffer = null;
		this.emberPositionBuffer = null;
		this.sparkProgram = null;
		this.emberProgram = null;
		this.particles = [];
		this.ambientAccumulators.clear();

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

// ── EffectPlugin descriptor ──────────────────────────────────────────────────
import type { EffectPlugin } from "../effects/effect-plugin";
import type { EffectRendererManager } from "../effect-renderer-manager";
import type { EffectRendererLike } from "../effects/effect-renderer";
import type { CharcoalIntent } from "$lib/shared/effects/domain/effects-config";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

export const charcoalEffectPlugin: EffectPlugin<CharcoalIntent> = {
  id: "charcoal",
  kind: "webgl",
  createRenderer: () => new CharcoalSparkRenderer(),
  defaultConfig: DEFAULT_EFFECTS_CONFIG.charcoal,
  configKey: "charcoalRenderer",
  onInit: (mgr: EffectRendererManager, renderer: EffectRendererLike) => {
    const charcoalParams = mgr.getCharcoalParamsFromConfig();
    if (charcoalParams) (renderer as CharcoalSparkRenderer).setParams(charcoalParams);
  },
  onDisable: (mgr: EffectRendererManager) => {
    if (!mgr.isEffectEnabled("fire")) {
      mgr.fireTipTracker?.reset();
    }
  },
};
