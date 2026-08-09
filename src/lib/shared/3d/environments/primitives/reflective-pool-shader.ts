/**
 * Water optics for a horizontal planar surface, written as a Reflector shader.
 *
 * Reflector takes `options.shader` — its documented extension point — so this
 * reuses the whole mirror pipeline (virtual camera, oblique clip plane, texture
 * matrix) and changes only how the reflected image is resolved onto the plane.
 *
 * A raw mirror reads as a hole in the floor, which is exactly what the grotto
 * looked like: reflection at full strength from every angle, and no body to the
 * liquid. Real water is view-dependent. The four things that make it read as
 * water rather than as an opening, in order of how much they carry:
 *
 * 1. Fresnel (Schlick, F0 = 0.02). Looking down you see the water's own colour;
 *    only at grazing angles does it become a mirror. This is the whole fix.
 * 2. Ripple normals perturbing both the reflection lookup and the specular, so
 *    the surface has a texture that moves.
 * 3. Depth absorption — shallow near the rim, saturated toward the middle —
 *    which is what gives a pool its volume.
 * 4. A foam line where the water meets its edge, so the boundary is a shoreline
 *    and not a cut.
 *
 * Horizontal only: the ripple frame assumes a world +Y normal.
 */
import { Color, Vector2, Vector3 } from "three";

export interface ReflectivePoolUniformValues {
  /** Colour toward the middle of the body, where light has been absorbed. */
  deepColor: Color;
  /** Colour at the rim, where the bottom is close enough to bounce light back. */
  shallowColor: Color;
  /** Tint multiplied into the reflected image. */
  reflectionTint: Color;
  /** Plane size in metres, so ripples keep a physical scale on any basin. */
  size: Vector2;
  /** Direction the key light travels toward the surface. */
  sunDirection: Vector3;
  sunColor: Color;
  /** Ripples per metre. */
  rippleScale: number;
  /** How far ripple normals bend the reflection lookup. */
  rippleStrength: number;
  /** Metres of foam at the rim. */
  foamWidth: number;
  /** Metres over which the rim colour gives way to the deep colour. */
  shoreFade: number;
}

export const REFLECTIVE_POOL_DEFAULTS: ReflectivePoolUniformValues = {
  deepColor: new Color(0x0a2f3a),
  shallowColor: new Color(0x2f8ea0),
  reflectionTint: new Color(0x9fbcc2),
  size: new Vector2(10, 10),
  sunDirection: new Vector3(-0.35, -0.85, -0.4).normalize(),
  sunColor: new Color(0xdff2ff),
  rippleScale: 1.4,
  rippleStrength: 0.09,
  foamWidth: 0.22,
  shoreFade: 2.2,
};

export const ReflectivePoolShader = {
  name: "ReflectivePoolShader",

  uniforms: {
    // Reflector owns these three and writes them every frame.
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },

    uTime: { value: 0 },
    uDeepColor: { value: REFLECTIVE_POOL_DEFAULTS.deepColor.clone() },
    uShallowColor: { value: REFLECTIVE_POOL_DEFAULTS.shallowColor.clone() },
    uSize: { value: REFLECTIVE_POOL_DEFAULTS.size.clone() },
    uSunDirection: { value: REFLECTIVE_POOL_DEFAULTS.sunDirection.clone() },
    uSunColor: { value: REFLECTIVE_POOL_DEFAULTS.sunColor.clone() },
    uRippleScale: { value: REFLECTIVE_POOL_DEFAULTS.rippleScale },
    uRippleStrength: { value: REFLECTIVE_POOL_DEFAULTS.rippleStrength },
    uFoamWidth: { value: REFLECTIVE_POOL_DEFAULTS.foamWidth },
    uShoreFade: { value: REFLECTIVE_POOL_DEFAULTS.shoreFade },
  },

  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;

    varying vec4 vProjectedUv;
    varying vec2 vPlaneUv;
    varying vec3 vWorldPosition;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vProjectedUv = textureMatrix * vec4( position, 1.0 );
      vPlaneUv = uv;
      vWorldPosition = ( modelMatrix * vec4( position, 1.0 ) ).xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

      #include <logdepthbuf_vertex>
    }`,

  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;

    uniform float uTime;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec2 uSize;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform float uRippleScale;
    uniform float uRippleStrength;
    uniform float uFoamWidth;
    uniform float uShoreFade;

    varying vec4 vProjectedUv;
    varying vec2 vPlaneUv;
    varying vec3 vWorldPosition;

    #include <logdepthbuf_pars_fragment>

    // Four drifting sine trains. Cheaper than a normal map and it needs no
    // asset, which matters for a graybox that has to load in one request.
    float waveHeight( vec2 p, float t ) {
      return sin( p.x * 1.3 + t * 0.62 ) * 0.50
           + sin( p.y * 1.7 - t * 0.44 ) * 0.44
           + sin( ( p.x + p.y ) * 2.3 + t * 0.91 ) * 0.24
           + sin( ( p.x - p.y ) * 3.1 - t * 0.73 ) * 0.16;
    }

    void main() {
      #include <logdepthbuf_fragment>

      // Metres across the surface, so ripple size is physical.
      vec2 metres = ( vPlaneUv - 0.5 ) * uSize;
      vec2 rippleP = metres * uRippleScale;

      const float EPS = 0.06;
      float h = waveHeight( rippleP, uTime );
      float dx = waveHeight( rippleP + vec2( EPS, 0.0 ), uTime ) - h;
      float dz = waveHeight( rippleP + vec2( 0.0, EPS ), uTime ) - h;

      // Horizontal surface: the ripple frame is world XZ around a +Y normal.
      // The XZ scale is deliberately small. Real ripples on an indoor pool tilt
      // the surface by a few degrees; steeper than that and the reflection
      // lookup smears into blobs that read as an oil slick, not water.
      vec3 normal = normalize( vec3( -dx * 0.7, 1.0, -dz * 0.7 ) );
      vec3 viewDir = normalize( cameraPosition - vWorldPosition );

      // Distance to the nearest rim, in metres — drives both depth and foam.
      vec2 toEdge = ( 0.5 - abs( vPlaneUv - 0.5 ) ) * uSize;
      float edgeDistance = min( toEdge.x, toEdge.y );
      // Ripples wander the shoreline so it is never a ruler-straight band.
      float wobbled = edgeDistance + h * 0.06;

      // Absorption: rim colour gives way to the deep colour going inward.
      float depth = smoothstep( 0.0, uShoreFade, wobbled );
      vec3 bodyColor = mix( uShallowColor, uDeepColor, depth );

      // Schlick. F0 = 0.02 is water against air; this is what stops the
      // surface reading as an opening when you stand over it.
      float cosTheta = clamp( dot( normal, viewDir ), 0.0, 1.0 );
      float fresnel = 0.02 + 0.98 * pow( 1.0 - cosTheta, 5.0 );

      vec2 distortion = normal.xz * uRippleStrength * vProjectedUv.w;
      vec4 reflected = texture2DProj(
        tDiffuse,
        vec4( vProjectedUv.xy + distortion, vProjectedUv.zw )
      );
      vec3 reflectionColor = reflected.rgb * color;

      vec3 surface = mix( bodyColor, reflectionColor, fresnel );

      // Specular off the ripple normals — the moving highlights that say liquid.
      vec3 halfway = normalize( viewDir - uSunDirection );
      float glint = pow( max( dot( normal, halfway ), 0.0 ), 220.0 );
      surface += uSunColor * glint * 0.85;

      // Shoreline. Water meeting an edge foams; a hard cut reads as geometry.
      float foam = 1.0 - smoothstep( 0.0, uFoamWidth, wobbled );
      surface = mix( surface, vec3( 0.86, 0.92, 0.94 ), foam * 0.55 );

      gl_FragColor = vec4( surface, 1.0 );

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
