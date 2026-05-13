<script lang="ts">
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import {
    SphereGeometry,
    CircleGeometry,
    ShaderMaterial,
    AdditiveBlending,
    BackSide,
    FogExp2,
    Color,
  } from "three";
  import { onDestroy, untrack } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";

  const sceneFeatures = getSceneFeatureContext();
  $effect(() => {
    sceneFeatures?.reportReady("environment");
  });

  const { scene } = useThrelte();
  const groundY = $derived(userProportionsState.groundY);

  // ── Fog ───────────────────────────────────────────────────────────────

  $effect(() => {
    if (!scene.current) return;
    scene.current.fog = new FogExp2(new Color("#08001a"), 0.010);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  // ── Shared GLSL ──────────────────────────────────────────────────────

  const SIMPLEX_GLSL = /* glsl */ `
    vec3 mod289v3(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289v4(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289v4(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0);
      const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy));
      vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);
      vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);
      vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;
      vec3 x2=x0-i2+C.yyy;
      vec3 x3=x0-D.yyy;
      i=mod289v3(i);
      vec4 p=permute(permute(permute(
        i.z+vec4(0.0,i1.z,i2.z,1.0))
        +i.y+vec4(0.0,i1.y,i2.y,1.0))
        +i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857;
      vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z);
      vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy;
      vec4 y=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy);
      vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0;
      vec4 s1=floor(b1)*2.0+1.0;
      vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
      vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);
      vec3 p1=vec3(a0.zw,h.y);
      vec3 p2=vec3(a1.xy,h.z);
      vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
      m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
  `;

  const RAINBOW_GLSL = /* glsl */ `
    vec3 getRainbow(float t){
      t=clamp(t,0.0,1.0)*6.0;
      int i=int(floor(t));
      float f=fract(t);
      vec3 a,b;
      if(i==0)     {a=vec3(1.0,0.09,0.27);b=vec3(1.0,0.57,0.0);}
      else if(i==1){a=vec3(1.0,0.57,0.0); b=vec3(1.0,0.92,0.0);}
      else if(i==2){a=vec3(1.0,0.92,0.0); b=vec3(0.0,0.90,0.46);}
      else if(i==3){a=vec3(0.0,0.90,0.46);b=vec3(0.16,0.47,1.0);}
      else if(i==4){a=vec3(0.16,0.47,1.0);b=vec3(0.40,0.12,1.0);}
      else         {a=vec3(0.40,0.12,1.0);b=vec3(0.83,0.0,0.98);}
      return mix(a,b,f);
    }
  `;

  // ── Aurora curtain dome ──────────────────────────────────────────────

  const auroraDomeGeometry = untrack(() => new SphereGeometry(70, 48, 48));

  const auroraMaterial = untrack(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main(){
        vec4 wp=modelMatrix*vec4(position,1.0);
        vWorldPosition=wp.xyz;
        gl_Position=projectionMatrix*viewMatrix*wp;
      }
    `,
        fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPosition;
      ${SIMPLEX_GLSL}
      ${RAINBOW_GLSL}

      void main(){
        vec3 dir=normalize(vWorldPosition);
        float h=dir.y;

        // Only render above horizon
        float horizonMask=smoothstep(-0.02,0.10,h);
        if(horizonMask<0.001) discard;

        float angle=atan(dir.x,dir.z);

        vec3 totalColor=vec3(0.0);

        // 3 curtain layers at different scales
        for(int layer=0;layer<3;layer++){
          float fl=float(layer);

          // Each layer: different fold count
          float freq=3.0+fl*1.5;

          // Horizontal ripple via 3D noise
          float ripple=snoise(vec3(
            angle*1.5+fl*7.0,
            h*2.0+uTime*(0.08+fl*0.03),
            uTime*0.05+fl*3.0
          ));

          // Curtain band shape — sharp peaks
          float curtainAngle=angle*freq+ripple*1.2+fl*2.3;
          float band=sin(curtainAngle);
          band=pow(max(band,0.0),5.0);

          // Height profile: bright near horizon, fade toward zenith
          float heightProfile=exp(-h*2.8)*smoothstep(0.0,0.08,h);

          // Vertical ray striations within each curtain
          float rays=0.6+0.4*sin(h*25.0+angle*5.0+uTime*0.4+fl*4.0);
          rays*=rays;

          // Rainbow color: spatial + per-layer offset + time drift
          float colorT=fract(
            (angle+3.14159)/(2.0*3.14159)
            +fl*0.33
            +uTime*0.015
            +ripple*0.08
          );
          vec3 color=getRainbow(colorT);

          // Layer contribution (farther layers slightly fainter)
          float layerAlpha=band*heightProfile*rays*(0.85-fl*0.15);
          totalColor+=color*layerAlpha;
        }

        gl_FragColor=vec4(totalColor*1.4, horizonMask*0.40);
      }
    `,
        side: BackSide,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      })
  );

  // ── Rainbow caustic ground ───────────────────────────────────────────

  const groundGeometry = untrack(() => new CircleGeometry(22, 64));

  const groundMaterial = untrack(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main(){
        vec4 wp=modelMatrix*vec4(position,1.0);
        vWorldPos=wp.xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
        fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      ${RAINBOW_GLSL}

      void main(){
        vec2 p=vWorldPos.xz;
        float dist=length(p);

        // Three-directional wave interference → caustic shape
        float caustic1=0.0;
        for(int i=0;i<3;i++){
          float fi=float(i);
          float a=fi*2.094395; // 120 deg apart
          vec2 d=vec2(cos(a),sin(a));
          caustic1+=sin(dot(p,d)*3.5+uTime*(0.3+fi*0.15));
        }
        caustic1=pow(abs(caustic1)/3.0,1.5);

        // Second layer offset for richer interference
        float caustic2=0.0;
        for(int i=0;i<3;i++){
          float fi=float(i);
          float a=fi*2.094395+0.523; // 30 deg offset
          vec2 d=vec2(cos(a),sin(a));
          caustic2+=sin(dot(p*0.7,d)*4.2+uTime*(0.22+fi*0.12)+5.0);
        }
        caustic2=pow(abs(caustic2)/3.0,1.5);

        float caustic=caustic1*0.6+caustic2*0.4;

        // Rainbow color: radial angle + time drift + caustic variation
        float angle=atan(p.y,p.x);
        float colorT=fract(
          (angle+3.14159)/(2.0*3.14159)
          +uTime*0.02
          +caustic1*0.12
        );
        vec3 rainbow=getRainbow(colorT);

        // Dark obsidian base
        vec3 base=vec3(0.025,0.005,0.05);

        // Caustic overlay — fade near edges, concentrate near center
        float centerFade=smoothstep(20.0,4.0,dist);
        vec3 color=base+rainbow*caustic*0.40*centerFade;

        // Edge fade out
        float edgeAlpha=smoothstep(22.0,18.0,dist);

        gl_FragColor=vec4(color,edgeAlpha*0.95);
      }
    `,
        transparent: true,
        side: 2, // DoubleSide
        depthWrite: false,
      })
  );

  // ── Rainbow point lights ─────────────────────────────────────────────

  const RAINBOW_LIGHTS: { color: string; angle: number }[] = [
    { color: "#ff1744", angle: 0 },
    { color: "#ff9100", angle: Math.PI / 6 },
    { color: "#ffea00", angle: Math.PI / 3 },
    { color: "#00e676", angle: Math.PI / 2 },
    { color: "#2979ff", angle: (Math.PI * 2) / 3 },
    { color: "#651fff", angle: (Math.PI * 5) / 6 },
    { color: "#d500f9", angle: Math.PI },
  ];

  const LIGHT_RADIUS = 7;
  const LIGHT_HEIGHT = 3.5;

  // ── Animation ────────────────────────────────────────────────────────

  useTask((delta) => {
    auroraMaterial.uniforms.uTime!.value += delta;
    groundMaterial.uniforms.uTime!.value += delta;
  });

  // ── Cleanup ──────────────────────────────────────────────────────────

  onDestroy(() => {
    auroraDomeGeometry.dispose();
    auroraMaterial.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
  });
</script>

<!-- Deep violet-black sky base -->
<SkyGradient topColor="#050012" midColor="#0e0028" bottomColor="#08001a" />

<!-- Aurora curtains — the hero element -->
<T.Mesh
  geometry={auroraDomeGeometry}
  material={auroraMaterial}
  renderOrder={-0.5}
  frustumCulled={false}
/>

<!-- Rainbow caustic ground -->
<T.Group position={[0, groundY, 0]}>
  <T.Mesh
    rotation.x={-Math.PI / 2}
    geometry={groundGeometry}
    material={groundMaterial}
  />
</T.Group>

<!-- 7 rainbow point lights — semicircle behind performer for color wash -->
{#each RAINBOW_LIGHTS as light}
  <T.PointLight
    color={light.color}
    intensity={15}
    distance={20}
    decay={1.6}
    position.x={Math.cos(light.angle) * LIGHT_RADIUS}
    position.y={groundY + LIGHT_HEIGHT}
    position.z={-3 - Math.sin(light.angle) * 3}
  />
{/each}

<!-- Warm purple hemisphere ambient -->
<T.HemisphereLight color="#3a1870" groundColor="#0c0620" intensity={0.65} />

<!-- Subtle directional cold fill (from above-left) -->
<T.DirectionalLight
  color="#6644aa"
  intensity={0.5}
  position.x={-15}
  position.y={20}
  position.z={10}
/>

<!-- Rainbow glow orbs drifting lazily -->
<FallingParticles
  type="fireflies"
  count={80}
  area={{ width: 10, height: 5, depth: 10 }}
  speed={0.005}
  colors={["#ff4466", "#ffaa22", "#44ff66", "#4488ff"]}
  sizeRange={[0.10, 0.26]}
  spin={false}
/>

<!-- Rising prismatic embers -->
<FallingParticles
  type="embers"
  count={50}
  area={{ width: 6, height: 4, depth: 6 }}
  speed={0.06}
  colors={["#ff2255", "#ff8800", "#ffee00", "#00cc55"]}
  sizeRange={[0.015, 0.045]}
  spin={false}
/>

<!-- Distant rainbow star sparkles -->
<FallingParticles
  type="stars"
  count={150}
  area={{ width: 25, height: 12, depth: 25 }}
  speed={0.004}
  colors={["#ff6688", "#ffcc44", "#44ffaa", "#8866ff"]}
  sizeRange={[0.012, 0.055]}
  spin={false}
/>
