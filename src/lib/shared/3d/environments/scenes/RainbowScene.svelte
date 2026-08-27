<script lang="ts">
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import { resolveCircularStageRadius } from "../domain/performer-stage-bounds";
  import {
    SphereGeometry,
    CircleGeometry,
    RingGeometry,
    CylinderGeometry,
    ShaderMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    AdditiveBlending,
    BackSide,
    DoubleSide,
    FogExp2,
    Color,
    Group,
    Mesh,
  } from "three";
  import { onDestroy, untrack } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import PrismPlatform from "./rainbow/PrismPlatform.svelte";
  import {
    type RainbowSceneConfig,
    createDefaultRainbowConfig,
  } from "../domain/models/scene-configs";

  interface Props {
    config?: RainbowSceneConfig;
    stageRadius?: number;
    stageRadiusGrowth?: number;
  }

  let { config, stageRadius = 3, stageRadiusGrowth = 0 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultRainbowConfig());

  const activeConfig = $derived.by(() => {
    const r = resolveCircularStageRadius(
      stageRadius,
      baseConfig.platform.radius,
      undefined,
      stageRadiusGrowth
    );
    if (r <= baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius: r },
    };
  });

  const sceneFeatures = getSceneFeatureContext();
  const { scene, renderer, camera } = useThrelte();
  $effect(() => {
    if (renderer.current && camera.current && scene.current) {
      renderer.current.compile(scene.current, camera.current);
    }
    sceneFeatures?.reportReady("environment");
  });
  const groundY = $derived(userProportionsState.groundY);


  let fogInstance: FogExp2 | null = null;
  $effect(() => {
    if (!scene.current) return;
    if (!fogInstance) {
      fogInstance = new FogExp2("#08001a", 0.008);
      scene.current.fog = fogInstance;
    }
    return () => {
      if (scene.current) scene.current.fog = null;
      fogInstance = null;
    };
  });


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

        float horizonMask=smoothstep(-0.02,0.10,h);
        if(horizonMask<0.001) discard;

        float angle=atan(dir.x,dir.z);

        vec3 totalColor=vec3(0.0);

        for(int layer=0;layer<3;layer++){
          float fl=float(layer);

          float freq=3.0+fl*1.5;

          float ripple=snoise(vec3(
            angle*1.5+fl*7.0,
            h*2.0+uTime*(0.08+fl*0.03),
            uTime*0.05+fl*3.0
          ));

          float curtainAngle=angle*freq+ripple*1.2+fl*2.3;
          float band=sin(curtainAngle);
          band=pow(max(band,0.0),5.0);

          float heightProfile=exp(-h*2.8)*smoothstep(0.0,0.08,h);

          float rays=0.6+0.4*sin(h*25.0+angle*5.0+uTime*0.4+fl*4.0);
          rays*=rays;

          float colorT=fract(
            (angle+3.14159)/(2.0*3.14159)
            +fl*0.33
            +uTime*0.015
            +ripple*0.08
          );
          vec3 color=getRainbow(colorT);

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

        float caustic1=0.0;
        for(int i=0;i<3;i++){
          float fi=float(i);
          float a=fi*2.094395;
          vec2 d=vec2(cos(a),sin(a));
          caustic1+=sin(dot(p,d)*3.5+uTime*(0.3+fi*0.15));
        }
        caustic1=pow(abs(caustic1)/3.0,1.5);

        float caustic2=0.0;
        for(int i=0;i<3;i++){
          float fi=float(i);
          float a=fi*2.094395+0.523;
          vec2 d=vec2(cos(a),sin(a));
          caustic2+=sin(dot(p*0.7,d)*4.2+uTime*(0.22+fi*0.12)+5.0);
        }
        caustic2=pow(abs(caustic2)/3.0,1.5);

        float caustic=caustic1*0.6+caustic2*0.4;

        float angle=atan(p.y,p.x);
        float colorT=fract(
          (angle+3.14159)/(2.0*3.14159)
          +uTime*0.02
          +caustic1*0.12
        );
        vec3 rainbow=getRainbow(colorT);

        vec3 base=vec3(0.025,0.005,0.05);

        float centerFade=smoothstep(20.0,4.0,dist);
        vec3 color=base+rainbow*caustic*0.40*centerFade;

        float edgeAlpha=smoothstep(22.0,18.0,dist);

        gl_FragColor=vec4(color,edgeAlpha*0.95);
      }
    `,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      })
  );

  // ── Ground accent ring ───────────────────────────────────────────────

  const accentRingGeometry = untrack(() => new RingGeometry(4.8, 5.3, 128));

  const accentRingMaterial = untrack(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      ${RAINBOW_GLSL}

      void main(){
        float angle = atan(vWorldPos.z, vWorldPos.x);
        float t = fract((angle + 3.14159) / (2.0 * 3.14159) + uTime * 0.04);
        vec3 color = getRainbow(t);

        // Pulse brightness
        float pulse = 0.7 + 0.3 * sin(uTime * 1.5 + angle * 3.0);

        // Ring cross-section falloff (brighter at center of ring width)
        float ringFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
        ringFade = pow(ringFade, 0.5);

        gl_FragColor = vec4(color * pulse * 1.8, ringFade * 0.85);
      }
    `,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        blending: AdditiveBlending,
      })
  );

  // ── Accent ring dot lights ───────────────────────────────────────────

  const RING_COLORS = [
    "#ff1744",
    "#ff9100",
    "#ffea00",
    "#00e676",
    "#2979ff",
    "#651fff",
    "#d500f9",
  ];

  const RING_RADIUS = 5.05;

  const dotGeometry = untrack(() => new SphereGeometry(0.05, 8, 8));

  const ringDotLights = RING_COLORS.map((color, i) => {
    const angle = (i / RING_COLORS.length) * Math.PI * 2;
    return {
      color,
      x: Math.cos(angle) * RING_RADIUS,
      z: Math.sin(angle) * RING_RADIUS,
    };
  });

  // ── Floating prismatic orbs ──────────────────────────────────────────

  interface PrismaticOrb {
    group: Group;
    baseY: number;
    baseX: number;
    baseZ: number;
    speed: number;
    phase: number;
    bobAmplitude: number;
    driftRadius: number;
    color: string;
  }

  const ORB_CONFIGS = [
    { color: "#ff4466", angle: 0.3, radius: 6, height: 2.8, scale: 0.18 },
    { color: "#ffaa22", angle: 1.1, radius: 7.5, height: 3.5, scale: 0.22 },
    { color: "#44ff66", angle: 2.0, radius: 5.5, height: 1.8, scale: 0.15 },
    { color: "#4488ff", angle: 2.9, radius: 8, height: 4.2, scale: 0.2 },
    { color: "#aa44ff", angle: 3.7, radius: 6.5, height: 2.2, scale: 0.16 },
    { color: "#ff44aa", angle: 4.5, radius: 7, height: 3.0, scale: 0.19 },
    { color: "#ffee44", angle: 5.3, radius: 5.8, height: 3.8, scale: 0.14 },
  ];

  // Shared unit-sphere geometries for all orbs — scaled per-mesh instead of baking radius
  const sharedCoreGeo = untrack(() => new SphereGeometry(1, 24, 24));
  const sharedGlowGeo = untrack(() => new SphereGeometry(1, 16, 16));

  function createPrismaticOrb(color: string, scale: number): Group {
    const group = new Group();

    const coreMat = new MeshPhysicalMaterial({
      color: new Color(color),
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.8,
      emissive: new Color(color),
      emissiveIntensity: 0.8,
      side: DoubleSide,
    });
    const core = new Mesh(sharedCoreGeo, coreMat);
    core.scale.setScalar(scale);
    group.add(core);

    const glowMat = new MeshStandardMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.12,
      emissive: new Color(color),
      emissiveIntensity: 1.2,
      side: BackSide,
      depthWrite: false,
    });
    const glow = new Mesh(sharedGlowGeo, glowMat);
    glow.scale.setScalar(scale * 2.2);
    group.add(glow);

    return group;
  }

  const prismaticOrbs: PrismaticOrb[] = untrack(() =>
    ORB_CONFIGS.map((cfg, i) => ({
      group: createPrismaticOrb(cfg.color, cfg.scale),
      baseX: Math.cos(cfg.angle) * cfg.radius,
      baseZ: Math.sin(cfg.angle) * cfg.radius,
      baseY: cfg.height,
      speed: 0.15 + i * 0.04,
      phase: i * 1.3,
      bobAmplitude: 0.4 + i * 0.08,
      driftRadius: 0.6 + i * 0.1,
      color: cfg.color,
    }))
  );

  // ── Light shafts ─────────────────────────────────────────────────────

  const SHAFT_COUNT = 5;

  interface LightShaft {
    angle: number;
    color: string;
    height: number;
    radius: number;
    topRadius: number;
  }

  const lightShafts: LightShaft[] = [
    { angle: 0.4, color: "#ff2255", height: 12, radius: 0.3, topRadius: 1.2 },
    { angle: 1.6, color: "#ffcc00", height: 14, radius: 0.25, topRadius: 1.0 },
    { angle: 2.8, color: "#00dd66", height: 11, radius: 0.28, topRadius: 1.1 },
    { angle: 4.0, color: "#3366ff", height: 13, radius: 0.22, topRadius: 0.9 },
    { angle: 5.2, color: "#9933ff", height: 12, radius: 0.26, topRadius: 1.0 },
  ];

  const shaftGeometries = untrack(() =>
    lightShafts.map(
      (s) => new CylinderGeometry(s.topRadius, s.radius, s.height, 12, 1, true)
    )
  );

  const shaftMaterials = untrack(() =>
    lightShafts.map(
      (s) =>
        new ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uColor: { value: new Color(s.color) },
          },
          vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vPos;
        void main(){
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
          fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vPos;

        void main(){
          // Fade from bottom (bright) to top (dim)
          float heightFade = pow(1.0 - vUv.y, 1.5);
          // Fade at edges of cylinder
          float edgeFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
          edgeFade = pow(max(edgeFade, 0.0), 2.0);

          float shimmer = 0.7 + 0.3 * sin(vPos.y * 3.0 + uTime * 2.0);

          float alpha = heightFade * edgeFade * shimmer * 0.18;
          gl_FragColor = vec4(uColor * 2.0, alpha);
        }
      `,
          transparent: true,
          side: DoubleSide,
          depthWrite: false,
          blending: AdditiveBlending,
        })
    )
  );

  const shaftPositions = lightShafts.map((s) => ({
    x: Math.cos(s.angle) * 8,
    z: Math.sin(s.angle) * 8 - 2,
  }));

  // ── Rainbow point lights (semicircle behind performer) ───────────────

  const RAINBOW_LIGHTS: { color: string; angle: number }[] = [
    { color: "#ff3333", angle: Math.PI / 8 },
    { color: "#ffdd00", angle: (Math.PI * 3) / 8 },
    { color: "#00cc66", angle: (Math.PI * 5) / 8 },
    { color: "#6633ff", angle: (Math.PI * 7) / 8 },
  ];

  const LIGHT_RADIUS = 7;
  const LIGHT_HEIGHT = 3.5;

  // ── Animation ────────────────────────────────────────────────────────

  let elapsed = 0;

  useTask((delta) => {
    elapsed += delta;
    auroraMaterial.uniforms.uTime!.value += delta;
    groundMaterial.uniforms.uTime!.value += delta;
    accentRingMaterial.uniforms.uTime!.value += delta;

    for (const mat of shaftMaterials) {
      mat.uniforms.uTime!.value += delta;
    }

    for (const orb of prismaticOrbs) {
      const t = elapsed * orb.speed + orb.phase;
      orb.group.position.set(
        orb.baseX + Math.sin(t * 0.7) * orb.driftRadius,
        orb.baseY + Math.sin(t) * orb.bobAmplitude,
        orb.baseZ + Math.cos(t * 0.5) * orb.driftRadius
      );
      orb.group.rotation.y = t * 0.3;
    }
  });

  // ── Cleanup ──────────────────────────────────────────────────────────

  onDestroy(() => {
    auroraDomeGeometry.dispose();
    auroraMaterial.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
    accentRingGeometry.dispose();
    accentRingMaterial.dispose();
    dotGeometry.dispose();
    sharedCoreGeo.dispose();
    sharedGlowGeo.dispose();

    for (const geo of shaftGeometries) geo.dispose();
    for (const mat of shaftMaterials) mat.dispose();

    for (const orb of prismaticOrbs) {
      orb.group.traverse((child) => {
        if (child instanceof Mesh) {
          // Geometries are shared — don't dispose per-orb; only dispose materials
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
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

<!-- Ground accent ring — rainbow gradient emissive halo -->
<T.Group position={[0, groundY + 0.02, 0]}>
  <T.Mesh
    rotation.x={-Math.PI / 2}
    geometry={accentRingGeometry}
    material={accentRingMaterial}
  />
</T.Group>

<!-- Accent ring dot lights — 7 rainbow colors around the ring -->
{#each ringDotLights as dot}
  <T.PointLight
    color={dot.color}
    intensity={8}
    distance={6}
    decay={2}
    position.x={dot.x}
    position.y={groundY + 0.15}
    position.z={dot.z}
  />
  <T.Mesh
    position.x={dot.x}
    position.y={groundY + 0.05}
    position.z={dot.z}
    geometry={dotGeometry}
  >
    <T.MeshStandardMaterial
      color={dot.color}
      emissive={dot.color}
      emissiveIntensity={3}
    />
  </T.Mesh>
{/each}

<!-- Floating prismatic orbs — 7 rainbow-colored emissive spheres -->
{#each prismaticOrbs as orb}
  <T
    is={orb.group}
    position.x={orb.baseX}
    position.y={orb.baseY}
    position.z={orb.baseZ}
  >
    <T.PointLight color={orb.color} intensity={12} distance={8} decay={2} />
  </T>
{/each}

<!-- Light shafts — colored volumetric beams from sky to ground -->
{#each lightShafts as shaft, i}
  <T.Mesh
    geometry={shaftGeometries[i]}
    material={shaftMaterials[i]}
    position.x={shaftPositions[i]?.x ?? 0}
    position.y={groundY + shaft.height / 2}
    position.z={shaftPositions[i]?.z ?? 0}
  />
{/each}

<!-- 4 rainbow point lights — semicircle behind performer for color wash -->
{#each RAINBOW_LIGHTS as light}
  <T.PointLight
    color={light.color}
    intensity={22}
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

<!-- Warm directional from below-right for orb rim lighting -->
<T.DirectionalLight
  color="#ff6644"
  intensity={0.25}
  position.x={10}
  position.y={-5}
  position.z={-8}
/>

<!-- Rainbow glow orbs drifting lazily -->
<FallingParticles
  type="fireflies"
  count={80}
  area={{ width: 10, height: 5, depth: 10 }}
  speed={0.005}
  colors={["#ff4466", "#ffaa22", "#44ff66", "#4488ff"]}
  sizeRange={[0.1, 0.26]}
  spin={false}
/>

<!-- Rising prismatic embers -->
<FallingParticles
  type="embers"
  count={60}
  area={{ width: 8, height: 5, depth: 8 }}
  speed={0.06}
  colors={["#ff2255", "#ff8800", "#ffee00", "#00cc55", "#4466ff", "#aa44ff"]}
  sizeRange={[0.015, 0.05]}
  spin={false}
/>

<!-- Distant rainbow star sparkles -->
<FallingParticles
  type="stars"
  count={180}
  area={{ width: 30, height: 15, depth: 30 }}
  speed={0.004}
  colors={["#ff6688", "#ffcc44", "#44ffaa", "#8866ff", "#ff44cc"]}
  sizeRange={[0.012, 0.06]}
  spin={false}
/>

<!-- Low-level dust motes catching rainbow light -->
<FallingParticles
  type="dust"
  count={100}
  area={{ width: 14, height: 3, depth: 14 }}
  speed={0.008}
  colors={["#ff88aa", "#ffdd66", "#88ffcc", "#aabbff"]}
  sizeRange={[0.008, 0.025]}
  spin={false}
/>

<PrismPlatform config={activeConfig.platform} />
