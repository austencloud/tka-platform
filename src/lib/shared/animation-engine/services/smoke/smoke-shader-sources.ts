export const SMOKE_DISPLAY_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_density;
uniform sampler2D u_temperature;
uniform vec3 u_coreColor;
uniform vec3 u_edgeColor;
uniform float u_intensity;
uniform float u_time;
uniform float u_hueShift;

vec3 rotateHue(vec3 color, float angle) {
  const mat3 toYiq = mat3(
    0.299, 0.587, 0.114,
    0.596, -0.274, -0.322,
    0.211, -0.523, 0.312
  );
  const mat3 toRgb = mat3(
    1.0, 0.956, 0.621,
    1.0, -0.272, -0.647,
    1.0, -1.106, 1.703
  );
  vec3 yiq = toYiq * color;
  float hue = atan(yiq.z, yiq.y) + angle;
  float chroma = length(yiq.yz);
  return clamp(toRgb * vec3(yiq.x, chroma * cos(hue), chroma * sin(hue)), 0.0, 1.0);
}

void main() {
  float density = max(texture(u_density, v_uv).r, 0.0);
  float temperature = max(texture(u_temperature, v_uv).r, 0.0);
  float opticalDepth = density * (1.15 + 1.5 * u_intensity);
  float alpha = 1.0 - exp(-opticalDepth);
  float interior = smoothstep(0.04, 0.72, density);
  float warmInterior = smoothstep(0.0, 0.8, temperature);
  vec3 color = mix(u_edgeColor, u_coreColor, interior * 0.78 + warmInterior * 0.22);
  color = mix(color, rotateHue(color, sin(u_time * 0.72) * 0.34), u_hueShift);
  color *= mix(1.08, 0.78, interior);
  color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
  fragColor = vec4(color * alpha, alpha);
}
`;
