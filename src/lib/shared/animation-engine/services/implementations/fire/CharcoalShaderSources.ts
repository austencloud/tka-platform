/**
 * CharcoalShaderSources
 *
 * GLSL 300 es shaders for the charcoal/steel-wool particle renderer.
 * Renders point sprites as soft circular sparks with temperature-driven
 * color ramp: dark red embers -> bright orange -> white-hot.
 *
 * These shaders operate on a per-particle basis (gl.POINTS) rather than
 * full-screen quads like the fluid simulation shaders. Each particle is
 * uploaded as a vertex with position, temperature, and size attributes.
 */

// ============================================================
// Vertex shader: position + size from particle attributes
// ============================================================

export const CHARCOAL_VERT = `#version 300 es
precision highp float;

in vec2 a_position;      // XY in UV space [0,1]
in float a_temperature;  // normalized 0-1 (1=hot, 0=cold)
in float a_size;         // point size in pixels

uniform float u_displayIntensity;

out float v_temperature;

void main() {
  // Map UV [0,1] -> clip space [-1,1]
  vec2 pos = a_position * 2.0 - 1.0;
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = max(1.0, a_size * u_displayIntensity);
  v_temperature = a_temperature;
}
`;

// ============================================================
// Fragment shader: soft circular spark with temperature color ramp
//
// Color ramp (3 bands):
//   0.0 - 0.3  dark red ember, fading out
//   0.3 - 0.7  deep orange -> bright orange
//   0.7 - 1.0  bright orange -> white-hot
//
// Alpha is driven by both distance-from-center (soft circle) and
// temperature (cold sparks fade out), producing natural ember decay.
// ============================================================

export const CHARCOAL_FRAG = `#version 300 es
precision highp float;

in float v_temperature;
out vec4 fragColor;

void main() {
  // Soft circular point sprite
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  float alpha = smoothstep(0.5, 0.3, dist);

  // Temperature-driven color ramp
  vec3 color;
  if (v_temperature > 0.7) {
    // White-hot band
    float f = (v_temperature - 0.7) / 0.3;
    color = mix(vec3(1.0, 0.5, 0.05), vec3(1.0, 0.85, 0.6), f);
  } else if (v_temperature > 0.3) {
    // Orange band
    float f = (v_temperature - 0.3) / 0.4;
    color = mix(vec3(0.6, 0.08, 0.0), vec3(1.0, 0.5, 0.05), f);
  } else {
    // Dying ember band
    float f = v_temperature / 0.3;
    color = vec3(0.6, 0.08, 0.0) * f;
    alpha *= f;
  }

  // Cold sparks become fully transparent
  alpha *= v_temperature;

  // Premultiplied alpha output for additive blending
  fragColor = vec4(color * alpha, alpha);
}
`;
