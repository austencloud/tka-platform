const VERT = `#version 300 es
precision highp float;
const vec2 QUAD[6] = vec2[6](
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0)
);
uniform vec4 u_destRect; // (x, y, w, h) in pixels
uniform vec2 u_canvasSize;
out vec2 v_uv;
void main() {
  vec2 q = QUAD[gl_VertexID];
  v_uv = vec2(q.x, 1.0 - q.y);
  vec2 pos = (u_destRect.xy + q * u_destRect.zw) / u_canvasSize * 2.0 - 1.0;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_source;
void main() {
  fragColor = texture(u_source, v_uv);
}
`;

export class ExportGLCompositor {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private destRectLoc: WebGLUniformLocation;
  private canvasSizeLoc: WebGLUniformLocation;
  private sourceLoc: WebGLUniformLocation;

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;

    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) throw new Error("WebGL2 unavailable for export compositor");
    this.gl = gl;

    this.program = this.buildProgram();
    this.destRectLoc = gl.getUniformLocation(this.program, "u_destRect")!;
    this.canvasSizeLoc = gl.getUniformLocation(this.program, "u_canvasSize")!;
    this.sourceLoc = gl.getUniformLocation(this.program, "u_source")!;

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.useProgram(this.program);
    gl.uniform2f(this.canvasSizeLoc, width, height);
    gl.uniform1i(this.sourceLoc, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
  }

  clear(r: number, g: number, b: number, a: number): void {
    const gl = this.gl;
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  drawOpaque(source: TexImageSource, x: number, y: number, w: number, h: number): void {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    this.uploadAndDraw(source, x, y, w, h);
  }

  drawPremultiplied(source: TexImageSource, x: number, y: number, w: number, h: number): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.uploadAndDraw(source, x, y, w, h);
  }

  getImageData(): ImageData {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const imgData = new ImageData(w, h);
    const out = imgData.data;
    const rowBytes = w * 4;

    for (let srcRow = 0; srcRow < h; srcRow++) {
      const dstRow = h - 1 - srcRow;
      const srcOff = srcRow * rowBytes;
      const dstOff = dstRow * rowBytes;
      for (let col = 0; col < rowBytes; col += 4) {
        const a = pixels[srcOff + col + 3]!;
        if (a === 0) {
          out[dstOff + col] = out[dstOff + col + 1] = out[dstOff + col + 2] = out[dstOff + col + 3] = 0;
          continue;
        }
        const scale = 255 / a;
        out[dstOff + col]     = Math.min(255, Math.round(pixels[srcOff + col]!     * scale));
        out[dstOff + col + 1] = Math.min(255, Math.round(pixels[srcOff + col + 1]! * scale));
        out[dstOff + col + 2] = Math.min(255, Math.round(pixels[srcOff + col + 2]! * scale));
        out[dstOff + col + 3] = a;
      }
    }

    return imgData;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  blitTo2D(target: HTMLCanvasElement): void {
    const ctx = target.getContext("2d")!;
    ctx.putImageData(this.getImageData(), 0, 0);
  }

  destroy(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  private uploadAndDraw(source: TexImageSource, x: number, y: number, w: number, h: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform4f(this.destRectLoc, x, y, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private buildProgram(): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, VERT);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("ExportGLCompositor shader link: " + gl.getProgramInfoLog(prog));
    }
    gl.detachShader(prog, vs);
    gl.detachShader(prog, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("ExportGLCompositor shader compile: " + info);
    }
    return shader;
  }
}
