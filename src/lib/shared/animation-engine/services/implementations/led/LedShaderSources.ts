/**
 * LED Shader Sources
 *
 * GLSL shader programs for the LED rendering pipeline:
 * 1. LED Sprite - Radial glow quad with additive blending
 * 2. Trail Accumulate - max() blend with temporal fade
 * 3. Bloom Downsample - 13-tap energy-preserving mip-chain
 * 4. Bloom Upsample - 3x3 tent filter additive
 * 5. Display - Final composite to screen
 */

// ─── Shared Vertex Shader (fullscreen quad) ───────────────────────────────────

export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ─── LED Sprite Shader ────────────────────────────────────────────────────────
// Renders individual LED glow quads with inverse-square radial falloff.

export const LED_SPRITE_VERT = `#version 300 es
precision highp float;

// Per-vertex: quad corners (-1 to 1)
in vec2 a_position;

// Per-instance: LED world position, color, brightness, glow radius
in vec2 a_ledPos;      // viewbox coords
in vec3 a_ledColor;    // RGB [0,1]
in float a_brightness; // [0,1]
in float a_glowRadius; // world-space radius

uniform vec2 u_resolution; // canvas size in pixels

out vec2 v_uv;
out vec3 v_color;
out float v_brightness;

void main() {
  v_uv = a_position * 0.5 + 0.5; // quad UV [0,1]
  v_color = a_ledColor;
  v_brightness = a_brightness;

  // Transform LED position from viewbox coords to clip space
  vec2 clipPos = (a_ledPos / u_resolution) * 2.0 - 1.0;
  clipPos.y = -clipPos.y; // flip Y (viewbox Y is top-down)

  // Scale quad by glow radius
  vec2 scaledOffset = a_position * (a_glowRadius / u_resolution);

  gl_Position = vec4(clipPos + scaledOffset, 0.0, 1.0);
}
`;

export const LED_SPRITE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_color;
in float v_brightness;

out vec4 fragColor;

void main() {
  // Distance from center of quad
  vec2 centered = v_uv - 0.5;
  float dist = length(centered);

  // Inverse-square radial falloff with soft edge
  float glow = 1.0 / (1.0 + 30.0 * dist * dist);

  // Discard fragments beyond visible range
  if (glow < 0.005) discard;

  // Core hotspot: brighter center for LED look
  float core = exp(-dist * dist * 80.0);
  float combined = glow + core * 0.5;

  vec3 color = v_color * combined * v_brightness;
  fragColor = vec4(color, combined * v_brightness);
}
`;

// ─── Trail Accumulation Shader ────────────────────────────────────────────────
// Composites current frame with previous trail using max() blend + temporal fade.

export const TRAIL_ACCUMULATE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_currentFrame;
uniform sampler2D u_previousTrail;
uniform float u_fadeRate; // 0.80-0.98

out vec4 fragColor;

void main() {
  vec4 current = texture(u_currentFrame, v_uv);
  vec4 trail = texture(u_previousTrail, v_uv);

  // Fade previous trail, then take max with current frame
  // max() prevents dark fragments from bleeding over lit LEDs
  fragColor = max(current, trail * u_fadeRate);
}
`;

// ─── PBR Bloom Downsample ─────────────────────────────────────────────────────
// 13-tap energy-preserving kernel from LearnOpenGL PBR Bloom (2022).

export const BLOOM_DOWNSAMPLE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texelSize;

out vec4 fragColor;

void main() {
  // 13-tap downsample with energy-preserving weights
  vec4 A = texture(u_source, v_uv + u_texelSize * vec2(-1.0, -1.0));
  vec4 B = texture(u_source, v_uv + u_texelSize * vec2( 0.0, -1.0));
  vec4 C = texture(u_source, v_uv + u_texelSize * vec2( 1.0, -1.0));
  vec4 D = texture(u_source, v_uv + u_texelSize * vec2(-0.5, -0.5));
  vec4 E = texture(u_source, v_uv);
  vec4 F = texture(u_source, v_uv + u_texelSize * vec2( 0.5, -0.5));
  vec4 G = texture(u_source, v_uv + u_texelSize * vec2(-1.0,  0.0));
  vec4 H = texture(u_source, v_uv + u_texelSize * vec2( 1.0,  0.0));
  vec4 I = texture(u_source, v_uv + u_texelSize * vec2(-0.5,  0.5));
  vec4 J = texture(u_source, v_uv + u_texelSize * vec2( 0.0,  1.0));
  vec4 K = texture(u_source, v_uv + u_texelSize * vec2( 0.5,  0.5));
  vec4 L = texture(u_source, v_uv + u_texelSize * vec2(-1.0,  1.0));
  vec4 M = texture(u_source, v_uv + u_texelSize * vec2( 1.0,  1.0));

  // Energy-preserving weights
  vec4 d4 = (D + F + I + K) * 0.25;     // Inner diamond
  vec4 d8 = (A + B + C + G + H + J + L + M) * 0.125; // Outer ring
  fragColor = d4 * 0.5 + d8 * 0.5;
}
`;

// ─── PBR Bloom Upsample ──────────────────────────────────────────────────────
// 3x3 tent filter for progressive upsampling with additive accumulation.

export const BLOOM_UPSAMPLE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texelSize;
uniform float u_bloomRadius; // controls spread (default 1.0)

out vec4 fragColor;

void main() {
  vec2 ts = u_texelSize * u_bloomRadius;

  // 3x3 tent filter (weights: 1,2,1 / 2,4,2 / 1,2,1) normalized by 16
  vec4 sum = vec4(0.0);
  sum += texture(u_source, v_uv + vec2(-ts.x, -ts.y)) * 1.0;
  sum += texture(u_source, v_uv + vec2( 0.0,  -ts.y)) * 2.0;
  sum += texture(u_source, v_uv + vec2( ts.x, -ts.y)) * 1.0;
  sum += texture(u_source, v_uv + vec2(-ts.x,  0.0))  * 2.0;
  sum += texture(u_source, v_uv)                       * 4.0;
  sum += texture(u_source, v_uv + vec2( ts.x,  0.0))  * 2.0;
  sum += texture(u_source, v_uv + vec2(-ts.x,  ts.y)) * 1.0;
  sum += texture(u_source, v_uv + vec2( 0.0,   ts.y)) * 2.0;
  sum += texture(u_source, v_uv + vec2( ts.x,  ts.y)) * 1.0;

  fragColor = sum / 16.0;
}
`;

// ─── Display Composite Shader ─────────────────────────────────────────────────
// Combines the trail-accumulated LED output with bloom and renders to screen.

export const LED_DISPLAY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_ledTrail;    // Trail-accumulated LED output
uniform sampler2D u_bloom;       // Final bloom texture (upsampled)
uniform float u_bloomIntensity;  // Bloom mix weight (0.01-0.15)

out vec4 fragColor;

void main() {
  vec4 led = texture(u_ledTrail, v_uv);
  vec4 bloom = texture(u_bloom, v_uv);

  // Additive bloom on top of LED output
  vec4 combined = led + bloom * u_bloomIntensity;

  // Premultiplied alpha output
  fragColor = vec4(combined.rgb, max(combined.r, max(combined.g, combined.b)));
}
`;
