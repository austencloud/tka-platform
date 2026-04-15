/**
 * Shader library.
 *
 * Holds GLSL source for every pass type this backend can execute.
 * Compiles lazily on first use and caches the resulting WebGLProgram
 * keyed by program id. Attribute + uniform locations are looked up
 * once at link time and exposed as a strongly-typed handle.
 */

export interface CompiledProgram {
  program: WebGLProgram;
  attribs: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface ProgramSpec {
  vertex: string;
  fragment: string;
  attribs: readonly string[];
  uniforms: readonly string[];
}

/** Fullscreen-triangle vertex shader. Emits clip-space position + uv without vertex buffer. */
const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  v_uv = (p + 1.0) * 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

/**
 * Decay shader — multiplicative fade + subtract-to-zero floor kill.
 *
 * Multiplies premultiplied RGBA by u_alphaFactor (matches Canvas2D
 * destination-out), then subtracts u_alphaSubtract to push 8-bit
 * precision-floored pixels (1/255) to real zero. Without the subtract,
 * rgba8 FBOs leave a permanent gray "ghost trail" from pixels that
 * multiplicative decay can never round below 1/255.
 */
const DECAY_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform float u_alphaFactor;
uniform float u_alphaSubtract;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_src, v_uv) * u_alphaFactor;
  fragColor = max(c - vec4(u_alphaSubtract), vec4(0.0));
}
`;

/** Composite shader — sample premultiplied source with an optional tint. */
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec4 u_tint;
out vec4 fragColor;
void main() {
  fragColor = texture(u_src, v_uv) * u_tint;
}
`;

/**
 * Trail mesh vertex shader. Interleaved input: (x, y, edge_t, alpha).
 *   - edge_t: −1 at left polygon edge, +1 at right edge (for AA).
 *   - alpha:  head→tail opacity ramp already embedded by mesh builder.
 */
const TRAIL_MESH_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
in float a_edge_t;
in float a_alpha;
out float v_edge_t;
out float v_alpha;
void main() {
  v_edge_t = a_edge_t;
  v_alpha = a_alpha;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Trail mesh fragment shader — sharp polygon with anti-aliased edge only.
 *
 * Glow diffusion is produced by a separable Gaussian blur pass on the
 * accumulator FBO, not by this shader. Keeping this shader sharp means
 * the subsequent blur has crisp geometry to spread from.
 */
const TRAIL_MESH_FRAG = `#version 300 es
precision highp float;
in float v_edge_t;
in float v_alpha;
uniform vec3 u_color;
uniform float u_aaWidth;
out vec4 fragColor;
void main() {
  float t = abs(v_edge_t);
  float a = (1.0 - smoothstep(1.0 - u_aaWidth, 1.0, t)) * v_alpha;
  fragColor = vec4(u_color * a, a);
}
`;

/**
 * Separable Gaussian blur. 9-tap symmetric kernel with sigma ≈ 2.
 *
 * u_direction = (1/width, 0) for horizontal pass, (0, 1/height) for
 * vertical. u_stride scales the tap offset so a single blur program
 * handles any radius — small stride = tight halo, large stride = wide
 * atmospheric bloom.
 */
const GAUSSIAN_BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_direction;
uniform float u_stride;
out vec4 fragColor;
const float W0 = 0.2042;
const float W1 = 0.1802;
const float W2 = 0.1238;
const float W3 = 0.0663;
const float W4 = 0.0276;
void main() {
  vec2 step = u_direction * u_stride;
  vec4 sum = texture(u_src, v_uv) * W0;
  sum += texture(u_src, v_uv + step) * W1;
  sum += texture(u_src, v_uv - step) * W1;
  sum += texture(u_src, v_uv + step * 2.0) * W2;
  sum += texture(u_src, v_uv - step * 2.0) * W2;
  sum += texture(u_src, v_uv + step * 3.0) * W3;
  sum += texture(u_src, v_uv - step * 3.0) * W3;
  sum += texture(u_src, v_uv + step * 4.0) * W4;
  sum += texture(u_src, v_uv - step * 4.0) * W4;
  fragColor = sum;
}
`;

/**
 * Trail composite — sharp + blurred additive bloom.
 *
 * Both inputs are premultiplied. Output is premultiplied. Downstream
 * blend is (ONE, ONE_MINUS_SRC_ALPHA). u_glowMix scales the blurred
 * contribution: 0 = sharp only, 1 = full bloom.
 */
const TRAIL_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_sharp;
uniform sampler2D u_blur;
uniform float u_glowMix;
out vec4 fragColor;
void main() {
  vec4 sharp = texture(u_sharp, v_uv);
  vec4 blur = texture(u_blur, v_uv);
  fragColor = clamp(sharp + blur * u_glowMix, vec4(0.0), vec4(1.0));
}
`;

const PROGRAMS: Record<string, ProgramSpec> = {
  decay: {
    vertex: FULLSCREEN_VERT,
    fragment: DECAY_FRAG,
    attribs: [],
    uniforms: ["u_src", "u_alphaFactor", "u_alphaSubtract"],
  },
  composite: {
    vertex: FULLSCREEN_VERT,
    fragment: COMPOSITE_FRAG,
    attribs: [],
    uniforms: ["u_src", "u_tint"],
  },
  "trail-mesh": {
    vertex: TRAIL_MESH_VERT,
    fragment: TRAIL_MESH_FRAG,
    attribs: ["a_position", "a_edge_t", "a_alpha"],
    uniforms: ["u_color", "u_aaWidth"],
  },
  "gaussian-blur": {
    vertex: FULLSCREEN_VERT,
    fragment: GAUSSIAN_BLUR_FRAG,
    attribs: [],
    uniforms: ["u_src", "u_direction", "u_stride"],
  },
  "trail-composite": {
    vertex: FULLSCREEN_VERT,
    fragment: TRAIL_COMPOSITE_FRAG,
    attribs: [],
    uniforms: ["u_sharp", "u_blur", "u_glowMix"],
  },
};

export class ShaderLibrary {
  private readonly gl: WebGL2RenderingContext;
  private readonly cache = new Map<string, CompiledProgram>();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  get(name: keyof typeof PROGRAMS | string): CompiledProgram {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const spec = PROGRAMS[name];
    if (!spec) throw new Error(`ShaderLibrary: unknown program "${name}"`);

    const compiled = this.compile(name, spec);
    this.cache.set(name, compiled);
    return compiled;
  }

  precompile(names: readonly string[]): void {
    for (const name of names) this.get(name);
  }

  dispose(): void {
    for (const { program } of this.cache.values()) {
      this.gl.deleteProgram(program);
    }
    this.cache.clear();
  }

  private compile(name: string, spec: ProgramSpec): CompiledProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, spec.vertex, `${name}.vert`);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, spec.fragment, `${name}.frag`);

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`ShaderLibrary: gl.createProgram returned null for "${name}"`);
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? "(no log)";
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`ShaderLibrary: link failed for "${name}": ${log}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const attribs: Record<string, number> = {};
    for (const attrName of spec.attribs) {
      attribs[attrName] = gl.getAttribLocation(program, attrName);
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const uniformName of spec.uniforms) {
      uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }

    return { program, attribs, uniforms };
  }

  private compileShader(type: number, source: string, label: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error(`ShaderLibrary: gl.createShader returned null for "${label}"`);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? "(no log)";
      gl.deleteShader(shader);
      throw new Error(`ShaderLibrary: compile failed for "${label}": ${log}`);
    }
    return shader;
  }
}
