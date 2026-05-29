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
// Renders each LED as a motion-streak capsule - a sprite oriented and
// stretched from the LED's previous-frame position to its current-frame
// position. When the trail pass composites this sprite with max() blend,
// the capsule fills the exact region the LED physically passed through
// during the frame, eliminating the chain-of-dots artifact that plagues
// point-sprite-only approaches.
//
// The fragment shader uses a capsule signed-distance field to get a
// smooth glow falloff around the entire segment, not just the endpoints.

export const LED_SPRITE_VERT = `#version 300 es
precision highp float;

// Per-vertex: quad corners (-1 to 1)
in vec2 a_position;

// Per-instance attributes
in vec2 a_ledPos;       // current-frame position in viewbox coords
in vec2 a_ledPrevPos;   // previous-frame position in viewbox coords
in vec3 a_ledColor;     // RGB [0,1]
in float a_brightness;  // [0,1]
in float a_glowRadius;  // viewbox-space glow radius

uniform vec2 u_resolution;  // canvas size in physical pixels
uniform vec2 u_viewboxSize; // viewbox dimensions (e.g. 950x950)

// Pass the fragment's position in viewbox space, plus the capsule
// endpoints and glow radius, so the fragment shader can compute the
// capsule distance field exactly.
out vec2 v_viewboxPos;
flat out vec2 v_capA;
flat out vec2 v_capB;
flat out float v_glowRadius;
flat out vec3 v_color;
flat out float v_brightness;

void main() {
  v_capA = a_ledPrevPos;
  v_capB = a_ledPos;
  v_glowRadius = a_glowRadius;
  v_color = a_ledColor;
  v_brightness = a_brightness;

  // Build a quad oriented along the segment from prev to curr that fully
  // contains the capsule (including soft glow padding on all sides).
  vec2 dir = a_ledPos - a_ledPrevPos;
  float segLen = length(dir);
  vec2 axis = segLen > 1e-4 ? dir / segLen : vec2(1.0, 0.0);
  vec2 perp = vec2(-axis.y, axis.x);

  vec2 center = (a_ledPrevPos + a_ledPos) * 0.5;
  // Oversize slightly past glow radius so the smoothstep edge isn't
  // clipped by the quad boundary.
  float pad = a_glowRadius * 1.05;
  float halfLen = segLen * 0.5 + pad;
  float halfWid = pad;

  // a_position ∈ [-1,1] - use x for along-axis, y for across-axis
  vec2 worldOffset = axis * (a_position.x * halfLen) + perp * (a_position.y * halfWid);
  vec2 worldPos = center + worldOffset;

  v_viewboxPos = worldPos;

  // Transform to clip space (viewbox Y is top-down)
  vec2 clipPos = (worldPos / u_viewboxSize) * 2.0 - 1.0;
  clipPos.y = -clipPos.y;

  gl_Position = vec4(clipPos, 0.0, 1.0);
}
`;

export const LED_SPRITE_FRAG = `#version 300 es
precision highp float;

in vec2 v_viewboxPos;
flat in vec2 v_capA;
flat in vec2 v_capB;
flat in float v_glowRadius;
flat in vec3 v_color;
flat in float v_brightness;

out vec4 fragColor;

void main() {
  // Capsule SDF: distance from this fragment to the nearest point on
  // the prev→curr line segment, in viewbox units.
  vec2 p = v_viewboxPos;
  vec2 a = v_capA;
  vec2 b = v_capB;
  vec2 pa = p - a;
  vec2 ba = b - a;
  float baLenSq = dot(ba, ba);
  float h = baLenSq > 1e-6 ? clamp(dot(pa, ba) / baLenSq, 0.0, 1.0) : 0.0;
  vec2 closest = a + ba * h;
  float dist = length(p - closest);

  // Normalize distance to glow-radius units: 0 on the spine, 1 at the
  // nominal glow edge.
  float nd = dist / v_glowRadius;

  // Soft edge falloff - discard outside the full-glow envelope.
  float edgeFade = 1.0 - smoothstep(0.6, 1.0, nd);
  if (edgeFade < 0.001) discard;

  // Inverse-square glow body - identical visual profile to the original
  // point-sprite shader, just with distance measured to the segment.
  float glow = 1.0 / (1.0 + 7.5 * nd * nd);

  // Bright hot centerline - the filament of the glowing wire.
  float core = exp(-nd * nd * 20.0);

  float combined = (glow + core * 0.5) * edgeFade;

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
uniform float u_threshold; // 0.0 = no prefilter (default for LED / subsequent mips)
uniform float u_knee;      // soft-knee transition width

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

  // Energy-preserving weights (LearnOpenGL PBR Bloom 13-tap)
  // Center: 0.125, Inner diamond: 4×0.125 = 0.5, Edges: 4×0.0625 = 0.25, Corners: 4×0.03125 = 0.125
  // Total: 0.125 + 0.5 + 0.25 + 0.125 = 1.0
  vec4 result = E * 0.125
              + (D + F + I + K) * 0.125
              + (B + G + H + J) * 0.0625
              + (A + C + L + M) * 0.03125;

  // Soft-knee luminance prefilter (UE4/Frostbite method).
  // On the first downsample pass, prevents sub-HDR pixels from entering
  // the bloom mip chain. Without this, faint fire trail pixels accumulate
  // through the additive upsample chain and produce concentric halo rings
  // visible when the fire canvas is composited onto dark backgrounds.
  if (u_threshold > 0.0) {
    float brightness = max(result.r, max(result.g, result.b));
    float soft = brightness - u_threshold + u_knee;
    soft = clamp(soft, 0.0, 2.0 * u_knee);
    soft = soft * soft / (4.0 * u_knee + 0.0001);
    float contribution = max(soft, brightness - u_threshold) / max(brightness, 0.0001);
    result *= max(0.0, contribution);
  }

  fragColor = result;
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

  // Straight alpha output (un-premultiplied RGB).
  // Alpha = peak channel brightness; RGB divided by alpha so the browser's
  // straight-alpha compositor reproduces the correct additive glow.
  float a = max(combined.r, max(combined.g, combined.b));
  vec3 rgb = a > 0.001 ? combined.rgb / a : vec3(0.0);
  fragColor = vec4(rgb, a);
}
`;
