/**
 * WebGLLedRenderer — Additive Glow Sprite + PBR Bloom LED Overlay
 *
 * Creates a transparent WebGL2 canvas overlaid on the Canvas2D animation canvas.
 * Renders addressable LED props using instanced glow sprites with persistence-of-vision
 * trail accumulation and physically-based bloom post-processing.
 *
 * Architecture per frame (~12 draw calls):
 *   1. Instanced sprite pass: additive glow quads at each LED position
 *   2. Trail accumulation: max(current, previous * fadeRate) ping-pong
 *   3. Bloom downsample: 5-level mip chain with 13-tap energy-preserving kernel
 *   4. Bloom upsample: 3x3 tent filter with additive accumulation
 *   5. Display composite: trail + bloom to screen with premultiplied alpha
 *
 * References:
 *   - LearnOpenGL PBR Bloom (2022) — 13-tap downsample + tent upsample
 *   - GPU Pro 5 — energy-preserving bloom chain
 */

import type { ILedOverlayRenderer } from "../../contracts/ILedOverlayRenderer";
import type { LedFrameInput, LedOverlayConfig } from "../../../domain/types/LedTypes";
import {
	FULLSCREEN_VERT,
	LED_SPRITE_VERT,
	LED_SPRITE_FRAG,
	TRAIL_ACCUMULATE_FRAG,
	BLOOM_DOWNSAMPLE_FRAG,
	BLOOM_UPSAMPLE_FRAG,
	LED_DISPLAY_FRAG,
} from "./LedShaderSources";

const MAX_DPR = 2;
const MAX_LEDS = 32;
const BLOOM_MIP_COUNT = 5;

// ============================================================
// Framebuffer types (mirrored from WebGLFireRenderer)
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

export class WebGLLedRenderer implements ILedOverlayRenderer {
	private canvas: HTMLCanvasElement | null = null;
	private gl: WebGL2RenderingContext | null = null;
	private initialized = false;
	private dpr = 1;

	// Shader programs
	private spriteProgram: ShaderProgram | null = null;
	private trailProgram: ShaderProgram | null = null;
	private bloomDownProgram: ShaderProgram | null = null;
	private bloomUpProgram: ShaderProgram | null = null;
	private displayProgram: ShaderProgram | null = null;

	// Geometry
	private quadVAO: WebGLVertexArrayObject | null = null;
	private spriteVAO: WebGLVertexArrayObject | null = null;
	private quadBuffer: WebGLBuffer | null = null;
	private instanceBuffer: WebGLBuffer | null = null;
	private instanceData: Float32Array = new Float32Array(MAX_LEDS * 7);

	// Framebuffers
	private spriteFBO: FBOAttachment | null = null;
	private trailFBOs: DoubleFBO | null = null;
	private bloomMips: FBOAttachment[] = [];
	private bloomMipSizes: Array<{ w: number; h: number }> = [];

	// Display dimensions (physical pixels)
	private displayWidth = 0;
	private displayHeight = 0;

	// Reduced motion
	private reducedMotion = false;

	initialize(container: HTMLElement, width: number, height: number): boolean {
		this.canvas = document.createElement("canvas");
		this.canvas.style.position = "absolute";
		this.canvas.style.top = "0";
		this.canvas.style.left = "0";
		this.canvas.style.width = "100%";
		this.canvas.style.height = "100%";
		this.canvas.style.pointerEvents = "none";
		this.canvas.style.zIndex = "3";
		this.canvas.style.background = "transparent";
		this.canvas.setAttribute("aria-hidden", "true");

		this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		this.displayWidth = Math.round(width * this.dpr);
		this.displayHeight = Math.round(height * this.dpr);
		this.canvas.width = this.displayWidth;
		this.canvas.height = this.displayHeight;

		container.appendChild(this.canvas);

		this.gl = this.canvas.getContext("webgl2", {
			alpha: true,
			premultipliedAlpha: true,
			antialias: false,
			depth: false,
			stencil: false,
			preserveDrawingBuffer: true, // Required for video export to read LED pixels
		});

		if (!this.gl) {
			console.warn("WebGL2 not available for LED overlay");
			this.cleanup();
			return false;
		}

		const gl = this.gl;

		// Float texture support is required for HDR bloom pipeline
		const ext = gl.getExtension("EXT_color_buffer_float");
		if (!ext) {
			console.warn("EXT_color_buffer_float not available — LED overlay requires float FBOs");
			this.cleanup();
			return false;
		}
		gl.getExtension("OES_texture_float_linear");

		if (!this.compileAllPrograms()) {
			this.cleanup();
			return false;
		}

		this.createGeometry();
		this.createFramebuffers();
		this.clearAllFramebuffers();

		gl.disable(gl.DEPTH_TEST);

		if (typeof window !== "undefined" && window.matchMedia) {
			this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		}

		this.initialized = true;
		return true;
	}

	resize(width: number, height: number): void {
		if (!this.canvas || !this.gl) return;

		this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		this.displayWidth = Math.round(width * this.dpr);
		this.displayHeight = Math.round(height * this.dpr);
		this.canvas.width = this.displayWidth;
		this.canvas.height = this.displayHeight;

		// Recreate all framebuffers at new size
		this.destroyFramebuffers();
		this.createFramebuffers();
		this.clearAllFramebuffers();
	}

	renderLeds(input: LedFrameInput, config: LedOverlayConfig): void {
		if (!this.gl || !this.initialized) return;
		const gl = this.gl;

		if (input.tips.length === 0) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			return;
		}

		// Reset blend state to known baseline before each frame
		gl.disable(gl.BLEND);

		// 1. Update instance data from tips
		const tipCount = Math.min(input.tips.length, MAX_LEDS);
		const baseGlowRadius = config.glowRadius * 60.0;
		for (let i = 0; i < tipCount; i++) {
			const tip = input.tips[i]!;
			const offset = i * 7;
			this.instanceData[offset] = tip.x;
			this.instanceData[offset + 1] = tip.y;
			this.instanceData[offset + 2] = tip.r;
			this.instanceData[offset + 3] = tip.g;
			this.instanceData[offset + 4] = tip.b;
			this.instanceData[offset + 5] = tip.brightness * config.brightness;
			this.instanceData[offset + 6] = baseGlowRadius;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, tipCount * 7));

		// 2. Render sprites to spriteFBO
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.spriteFBO!.fbo);
		gl.viewport(0, 0, this.displayWidth, this.displayHeight);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE); // additive
		gl.useProgram(this.spriteProgram!.program);
		gl.uniform2f(
			this.spriteProgram!.uniforms.get("u_resolution")!,
			this.displayWidth,
			this.displayHeight,
		);
		gl.uniform2f(
			this.spriteProgram!.uniforms.get("u_viewboxSize")!,
			input.canvasWidth,
			input.canvasHeight,
		);
		gl.bindVertexArray(this.spriteVAO);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, tipCount);
		gl.bindVertexArray(null);

		// 3. Trail accumulation
		gl.disable(gl.BLEND);
		gl.useProgram(this.trailProgram!.program);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFBOs!.write.fbo);
		gl.viewport(0, 0, this.displayWidth, this.displayHeight);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.spriteFBO!.texture);
		gl.uniform1i(this.trailProgram!.uniforms.get("u_currentFrame")!, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.trailFBOs!.read.texture);
		gl.uniform1i(this.trailProgram!.uniforms.get("u_previousTrail")!, 1);
		gl.uniform1f(
			this.trailProgram!.uniforms.get("u_fadeRate")!,
			this.reducedMotion ? 0.0 : config.trailFadeRate,
		);
		gl.bindVertexArray(this.quadVAO);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.bindVertexArray(null);
		this.swapFBO(this.trailFBOs!);

		// 4. Bloom downsample
		let srcTexture = this.trailFBOs!.read.texture;
		let srcWidth = this.displayWidth;
		let srcHeight = this.displayHeight;
		gl.useProgram(this.bloomDownProgram!.program);
		gl.bindVertexArray(this.quadVAO);
		for (let i = 0; i < this.bloomMips.length; i++) {
			const mip = this.bloomMips[i]!;
			const mipSize = this.bloomMipSizes[i]!;
			gl.bindFramebuffer(gl.FRAMEBUFFER, mip.fbo);
			gl.viewport(0, 0, mipSize.w, mipSize.h);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, srcTexture);
			gl.uniform1i(this.bloomDownProgram!.uniforms.get("u_source")!, 0);
			gl.uniform2f(
				this.bloomDownProgram!.uniforms.get("u_texelSize")!,
				1.0 / srcWidth,
				1.0 / srcHeight,
			);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			srcTexture = mip.texture;
			srcWidth = mipSize.w;
			srcHeight = mipSize.h;
		}

		// 5. Bloom upsample (additive)
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);
		gl.useProgram(this.bloomUpProgram!.program);
		for (let i = this.bloomMips.length - 1; i > 0; i--) {
			const target = this.bloomMips[i - 1]!;
			const source = this.bloomMips[i]!;
			const targetSize = this.bloomMipSizes[i - 1]!;
			const sourceSize = this.bloomMipSizes[i]!;
			gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
			gl.viewport(0, 0, targetSize.w, targetSize.h);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, source.texture);
			gl.uniform1i(this.bloomUpProgram!.uniforms.get("u_source")!, 0);
			gl.uniform2f(
				this.bloomUpProgram!.uniforms.get("u_texelSize")!,
				1.0 / sourceSize.w,
				1.0 / sourceSize.h,
			);
			gl.uniform1f(this.bloomUpProgram!.uniforms.get("u_bloomRadius")!, 1.0);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
		gl.disable(gl.BLEND);
		gl.bindVertexArray(null);

		// 6. Display composite to screen
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(
			gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
			gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
		);
		gl.useProgram(this.displayProgram!.program);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.trailFBOs!.read.texture);
		gl.uniform1i(this.displayProgram!.uniforms.get("u_ledTrail")!, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.bloomMips[0]!.texture);
		gl.uniform1i(this.displayProgram!.uniforms.get("u_bloom")!, 1);
		gl.uniform1f(
			this.displayProgram!.uniforms.get("u_bloomIntensity")!,
			config.bloomIntensity,
		);
		gl.bindVertexArray(this.quadVAO);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.bindVertexArray(null);
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

	// ============================================================
	// Geometry creation
	// ============================================================

	private createGeometry(): void {
		const gl = this.gl!;

		// Quad vertices: two triangles forming a [-1,1] quad
		const quadVertices = new Float32Array([
			-1, -1, 1, -1, -1, 1,
			-1, 1, 1, -1, 1, 1,
		]);

		this.quadBuffer = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

		// Instance buffer for per-LED data (7 floats per LED)
		this.instanceBuffer = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);

		// Fullscreen quad VAO (used by trail, bloom, display passes)
		this.quadVAO = gl.createVertexArray()!;
		gl.bindVertexArray(this.quadVAO);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);

		// Sprite VAO with instanced attributes
		this.spriteVAO = gl.createVertexArray()!;
		gl.bindVertexArray(this.spriteVAO);

		// Attribute 0: quad vertices (per-vertex)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		// Instance attributes (per-instance, divisor 1)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
		const stride = 7 * 4; // 7 floats * 4 bytes

		gl.enableVertexAttribArray(1); // a_ledPos (vec2)
		gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
		gl.vertexAttribDivisor(1, 1);

		gl.enableVertexAttribArray(2); // a_ledColor (vec3)
		gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 8);
		gl.vertexAttribDivisor(2, 1);

		gl.enableVertexAttribArray(3); // a_brightness (float)
		gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 20);
		gl.vertexAttribDivisor(3, 1);

		gl.enableVertexAttribArray(4); // a_glowRadius (float)
		gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 24);
		gl.vertexAttribDivisor(4, 1);

		gl.bindVertexArray(null);
	}

	// ============================================================
	// Framebuffer management
	// ============================================================

	private createFramebuffers(): void {
		const w = this.displayWidth;
		const h = this.displayHeight;

		this.spriteFBO = this.createFBO(w, h);
		this.trailFBOs = {
			read: this.createFBO(w, h),
			write: this.createFBO(w, h),
		};

		// Bloom mip chain: each level is half the previous
		this.bloomMips = [];
		this.bloomMipSizes = [];
		let mipW = w;
		let mipH = h;
		for (let i = 0; i < BLOOM_MIP_COUNT; i++) {
			mipW = Math.max(1, Math.floor(mipW / 2));
			mipH = Math.max(1, Math.floor(mipH / 2));
			this.bloomMips.push(this.createFBO(mipW, mipH));
			this.bloomMipSizes.push({ w: mipW, h: mipH });
		}
	}

	private createFBO(w: number, h: number): FBOAttachment {
		const gl = this.gl!;

		const texture = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);

		const fbo = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);

		return { fbo, texture };
	}

	private clearAllFramebuffers(): void {
		const gl = this.gl!;
		gl.clearColor(0, 0, 0, 0);
		const targets = [
			this.spriteFBO!,
			this.trailFBOs!.read,
			this.trailFBOs!.write,
			...this.bloomMips,
		];
		for (const target of targets) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	private swapFBO(fbo: DoubleFBO): void {
		const tmp = fbo.read;
		fbo.read = fbo.write;
		fbo.write = tmp;
	}

	private destroyFramebuffers(): void {
		const gl = this.gl;
		if (!gl) return;

		const destroySingle = (f: FBOAttachment | null) => {
			if (!f) return;
			gl.deleteTexture(f.texture);
			gl.deleteFramebuffer(f.fbo);
		};

		destroySingle(this.spriteFBO);
		this.spriteFBO = null;

		if (this.trailFBOs) {
			destroySingle(this.trailFBOs.read);
			destroySingle(this.trailFBOs.write);
			this.trailFBOs = null;
		}

		for (const mip of this.bloomMips) {
			destroySingle(mip);
		}
		this.bloomMips = [];
		this.bloomMipSizes = [];
	}

	// ============================================================
	// Shader compilation
	// ============================================================

	private compileAllPrograms(): boolean {
		// Sprite program needs explicit attribute bindings before linking
		this.spriteProgram = this.buildSpriteProgram();

		// Fullscreen programs use FULLSCREEN_VERT with a_position at location 0
		this.trailProgram = this.buildFullscreenProgram(
			TRAIL_ACCUMULATE_FRAG,
			["u_currentFrame", "u_previousTrail", "u_fadeRate"],
		);
		this.bloomDownProgram = this.buildFullscreenProgram(
			BLOOM_DOWNSAMPLE_FRAG,
			["u_source", "u_texelSize"],
		);
		this.bloomUpProgram = this.buildFullscreenProgram(
			BLOOM_UPSAMPLE_FRAG,
			["u_source", "u_texelSize", "u_bloomRadius"],
		);
		this.displayProgram = this.buildFullscreenProgram(
			LED_DISPLAY_FRAG,
			["u_ledTrail", "u_bloom", "u_bloomIntensity"],
		);

		const all = [
			this.spriteProgram,
			this.trailProgram,
			this.bloomDownProgram,
			this.bloomUpProgram,
			this.displayProgram,
		];

		if (all.some(p => p === null)) {
			console.error("Failed to compile one or more LED shader programs");
			return false;
		}

		return true;
	}

	/**
	 * Builds the sprite program with explicit attribute location bindings
	 * BEFORE linking, as required for instanced rendering.
	 */
	private buildSpriteProgram(): ShaderProgram | null {
		const gl = this.gl!;

		const vertShader = this.compileShader(gl.VERTEX_SHADER, LED_SPRITE_VERT);
		const fragShader = this.compileShader(gl.FRAGMENT_SHADER, LED_SPRITE_FRAG);
		if (!vertShader || !fragShader) return null;

		const program = gl.createProgram()!;
		gl.attachShader(program, vertShader);
		gl.attachShader(program, fragShader);

		// Bind attribute locations BEFORE linking
		gl.bindAttribLocation(program, 0, "a_position");
		gl.bindAttribLocation(program, 1, "a_ledPos");
		gl.bindAttribLocation(program, 2, "a_ledColor");
		gl.bindAttribLocation(program, 3, "a_brightness");
		gl.bindAttribLocation(program, 4, "a_glowRadius");

		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("LED sprite shader link error:", gl.getProgramInfoLog(program));
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
		for (const name of ["u_resolution", "u_viewboxSize"]) {
			const loc = gl.getUniformLocation(program, name);
			if (loc !== null) {
				uniforms.set(name, loc);
			}
		}

		return { program, uniforms };
	}

	/**
	 * Builds a fullscreen pass program using FULLSCREEN_VERT.
	 * Binds a_position at location 0 before linking.
	 */
	private buildFullscreenProgram(
		fragSource: string,
		uniformNames: string[],
	): ShaderProgram | null {
		const gl = this.gl!;

		const vertShader = this.compileShader(gl.VERTEX_SHADER, FULLSCREEN_VERT);
		const fragShader = this.compileShader(gl.FRAGMENT_SHADER, fragSource);
		if (!vertShader || !fragShader) return null;

		const program = gl.createProgram()!;
		gl.attachShader(program, vertShader);
		gl.attachShader(program, fragShader);

		// Bind a_position at location 0 before linking
		gl.bindAttribLocation(program, 0, "a_position");

		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("LED fullscreen shader link error:", gl.getProgramInfoLog(program));
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
			console.error(`LED ${typeName} shader error:`, gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}

		return shader;
	}

	// ============================================================
	// Cleanup
	// ============================================================

	private cleanup(): void {
		const gl = this.gl;

		this.destroyFramebuffers();

		if (gl) {
			// Delete shader programs
			const programs = [
				this.spriteProgram,
				this.trailProgram,
				this.bloomDownProgram,
				this.bloomUpProgram,
				this.displayProgram,
			];
			for (const p of programs) {
				if (p) gl.deleteProgram(p.program);
			}

			// Delete VAOs
			if (this.spriteVAO) gl.deleteVertexArray(this.spriteVAO);
			if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);

			// Delete buffers
			if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
			if (this.instanceBuffer) gl.deleteBuffer(this.instanceBuffer);
		}

		this.spriteProgram = null;
		this.trailProgram = null;
		this.bloomDownProgram = null;
		this.bloomUpProgram = null;
		this.displayProgram = null;

		this.quadVAO = null;
		this.spriteVAO = null;
		this.quadBuffer = null;
		this.instanceBuffer = null;

		if (this.canvas) {
			this.canvas.remove();
			this.canvas = null;
		}

		this.gl = null;
		this.initialized = false;
	}
}
