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
  /** Attribute locations, keyed by attribute name. */
  attribs: Record<string, number>;
  /** Uniform locations, keyed by uniform name. Null means uniform was optimized out. */
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
 * Decay shader. FBO holds premultiplied RGBA; multiplying all four
 * channels by u_alphaFactor decays both the color contribution and
 * the alpha, matching Canvas2D destination-out fade behavior.
 */
const DECAY_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform float u_alphaFactor;
out vec4 fragColor;
void main() {
  fragColor = texture(u_src, v_uv) * u_alphaFactor;
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
 * Trail mesh vertex shader.
 *
 * Interleaved input: (x, y, edge_t, alpha).
 *   - edge_t: −1 at left polygon edge, +1 at right edge
 *   - alpha:  head→tail opacity ramp already embedded by mesh builder
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
 * Trail mesh fragment shader — anti-aliased core + halo glow.
 *
 * The mesh carries a total half-width of (thickness/2 + glow). The
 * uniform u_coreRatio says where the solid core ends; outside that
 * is the halo region, whose alpha falls off quadratically toward the
 * outer edge and is scaled by u_glowStrength.
 *
 * Output is premultiplied (rgb * a, a) — compositing pass uses
 * blendFunc(ONE, ONE_MINUS_SRC_ALPHA) to stack correctly.
 */
const TRAIL_MESH_FRAG = `#version 300 es
precision highp float;
in float v_edge_t;
in float v_alpha;
uniform vec3 u_color;
uniform float u_coreRatio;
uniform float u_glowStrength;
uniform float u_aaWidth;
out vec4 fragColor;
void main() {
  float t = abs(v_edge_t);
  // Anti-aliased solid core.
  float core = 1.0 - smoothstep(u_coreRatio - u_aaWidth, u_coreRatio, t);
  // Halo: soft falloff from the core edge to the outer boundary.
  float haloBase = 1.0 - smoothstep(u_coreRatio, 1.0, t);
  float halo = haloBase * haloBase * u_glowStrength;
  float a = (core + (1.0 - core) * halo) * v_alpha;
  fragColor = vec4(u_color * a, a);
}
`;

const PROGRAMS: Record<string, ProgramSpec> = {
  decay: {
    vertex: FULLSCREEN_VERT,
    fragment: DECAY_FRAG,
    attribs: [],
    uniforms: ["u_src", "u_alphaFactor"],
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
    uniforms: ["u_color", "u_coreRatio", "u_glowStrength", "u_aaWidth"],
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
