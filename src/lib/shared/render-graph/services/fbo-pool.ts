/**
 * Named FBO pool.
 *
 * Manages WebGL2 framebuffers + backing textures keyed by string name.
 * Supports single targets (e.g. "scene", "bloom-input") and ping-pong
 * pairs (e.g. trail accumulation - read one, draw to the other, swap).
 *
 * Pool-level resize re-allocates all managed textures. Pool disposal
 * releases every GPU resource - there is no leakage of FBOs beyond
 * pool lifetime.
 */

import type { TargetFormat } from "../domain/frame-graph";

export interface FBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
  format: TargetFormat;
}

export interface PingPongPair {
  /** Texture currently holding the latest accumulated state. */
  read: FBO;
  /** Texture the next draw call should target. */
  write: FBO;
  /** Swap read/write after finishing a pass. */
  swap(): void;
}

interface PingPongStorage {
  a: FBO;
  b: FBO;
  currentReadIsA: boolean;
}

export class FBOPool {
  private readonly gl: WebGL2RenderingContext;
  private readonly single = new Map<string, FBO>();
  private readonly sized = new Map<string, FBO>();
  private readonly pairs = new Map<string, PingPongStorage>();
  private width: number;
  private height: number;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  get count(): number {
    return this.single.size + this.sized.size + this.pairs.size * 2;
  }

  /** Get-or-allocate a single-buffer target. Uses pool dimensions and the given format. */
  getOrAllocate(name: string, format: TargetFormat = "rgba8"): FBO {
    const existing = this.single.get(name);
    if (existing) return existing;
    const fbo = this.createFBO(this.width, this.height, format);
    this.single.set(name, fbo);
    return fbo;
  }

  /**
   * Get-or-allocate a target at arbitrary dimensions. Unlike getOrAllocate,
   * the target's size is caller-managed (e.g. half-res bloom FBOs derived
   * from canvas dims). Reallocates if dimensions or format change.
   */
  getOrAllocateSized(
    name: string,
    width: number,
    height: number,
    format: TargetFormat = "rgba8",
  ): FBO {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const existing = this.sized.get(name);
    if (existing?.width === w && existing.height === h && existing.format === format) {
      return existing;
    }
    if (existing) this.destroyFBO(existing);
    const fbo = this.createFBO(w, h, format);
    this.sized.set(name, fbo);
    return fbo;
  }

  /** Get-or-allocate a ping-pong pair. Swap() cycles read/write. */
  getOrAllocatePair(name: string, format: TargetFormat = "rgba8"): PingPongPair {
    let storage = this.pairs.get(name);
    if (!storage) {
      storage = {
        a: this.createFBO(this.width, this.height, format),
        b: this.createFBO(this.width, this.height, format),
        currentReadIsA: true,
      };
      this.pairs.set(name, storage);
    }
    const capturedStorage = storage;
    return {
      get read(): FBO {
        return capturedStorage.currentReadIsA ? capturedStorage.a : capturedStorage.b;
      },
      get write(): FBO {
        return capturedStorage.currentReadIsA ? capturedStorage.b : capturedStorage.a;
      },
      swap(): void {
        capturedStorage.currentReadIsA = !capturedStorage.currentReadIsA;
      },
    };
  }

  /** Release a single target by name. Safe to call on unknown names. */
  release(name: string): void {
    const fbo = this.single.get(name);
    if (fbo) {
      this.destroyFBO(fbo);
      this.single.delete(name);
      return;
    }
    const sized = this.sized.get(name);
    if (sized) {
      this.destroyFBO(sized);
      this.sized.delete(name);
      return;
    }
    const pair = this.pairs.get(name);
    if (pair) {
      this.destroyFBO(pair.a);
      this.destroyFBO(pair.b);
      this.pairs.delete(name);
    }
  }

  /** Resize all managed targets. Cheap no-op if unchanged. */
  resize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;

    for (const [name, fbo] of this.single) {
      const recreated = this.createFBO(w, h, fbo.format);
      this.destroyFBO(fbo);
      this.single.set(name, recreated);
    }
    for (const [name, pair] of this.pairs) {
      const newA = this.createFBO(w, h, pair.a.format);
      const newB = this.createFBO(w, h, pair.b.format);
      this.destroyFBO(pair.a);
      this.destroyFBO(pair.b);
      this.pairs.set(name, { a: newA, b: newB, currentReadIsA: pair.currentReadIsA });
    }
  }

  dispose(): void {
    for (const fbo of this.single.values()) this.destroyFBO(fbo);
    for (const fbo of this.sized.values()) this.destroyFBO(fbo);
    for (const pair of this.pairs.values()) {
      this.destroyFBO(pair.a);
      this.destroyFBO(pair.b);
    }
    this.single.clear();
    this.sized.clear();
    this.pairs.clear();
  }

  /** List all managed target names - for diagnostics. */
  listNames(): string[] {
    return [...this.single.keys(), ...this.sized.keys(), ...this.pairs.keys()];
  }

  private createFBO(width: number, height: number, format: TargetFormat): FBO {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("FBOPool: gl.createTexture returned null");
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const internalFormat = format === "rgba16f" ? gl.RGBA16F : gl.RGBA8;
    const type = format === "rgba16f" ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    gl.texImage2D(
      gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, type, null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      gl.deleteTexture(texture);
      throw new Error("FBOPool: gl.createFramebuffer returned null");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0,
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      throw new Error(`FBOPool: framebuffer incomplete, status=0x${status.toString(16)}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return { framebuffer, texture, width, height, format };
  }

  private destroyFBO(fbo: FBO): void {
    this.gl.deleteFramebuffer(fbo.framebuffer);
    this.gl.deleteTexture(fbo.texture);
  }
}
