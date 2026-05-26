varying float vAlpha;
varying float vScatter;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.2, 0.5, d)) * vAlpha;
  if (a < 0.01) discard;

  vec3 cool = vec3(0.65, 0.78, 0.85);
  vec3 warm = vec3(1.0, 0.9, 0.6);
  vec3 color = mix(cool, warm, vScatter * 0.4);

  gl_FragColor = vec4(color, a * 0.35);
}
