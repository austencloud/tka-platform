import {
  DoubleSide,
  Group,
  type Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
  type Object3D,
} from "three";
import type { EmberSceneConfig } from "../../domain/models/scene-configs/ember-scene-config";
import type { EmberWorldElement } from "./ember-lava-features";
import midflank from "../../domain/models/scene-configs/ember-midflank-r5.json";

export function withMidflankAtmosphere(
  base: EmberSceneConfig
): EmberSceneConfig {
  return {
    ...base,
    fog: { color: "#42494a", density: 0.0038 },
    sky: {
      topColor: "#171e24",
      midColor: "#434a4d",
      bottomColor: "#737675",
      horizonGlow: {
        color: "#c46c3b",
        direction: [-34, 0, 132],
        height: 0.15,
        spread: 0.22,
        intensity: 0.16,
      },
    },
    hemisphereLight: {
      skyColor: "#becbd2",
      groundColor: "#262727",
      intensity: 0.5,
    },
    skyLight: {
      enabled: true,
      color: "#e3ded0",
      intensity: 3.1,
      position: [-28, 24, 10],
    },
    atmosphere: {
      ...base.atmosphere,
      label: "Midflank — cold basalt and live fracture",
      directionals: [
        { position: [35, 40, 45], color: "#899bab", intensity: 0.2 },
      ],
      points: [],
      calderaLight: {
        position: [
          midflank.sourceWorldXYZ[0],
          midflank.sourceWorldXYZ[1] + 3,
          midflank.sourceWorldXYZ[2],
        ],
        color: "#ff6818",
        intensity: 60,
        distance: 48,
        decay: 2,
      },
      heatFields: [],
      plumes: [],
    },
    volcanicHaze: {
      ...base.volcanicHaze,
      color1: "#4e5355",
      color2: "#242b31",
      opacity: 0.32,
      lightningIntensity: 0,
      innerGlowColor: "#7b3c20",
      underglowColor: "#925330",
      underglowStrength: 0.12,
      underglowDirection: [-34, 0, 132],
    },
    embers: { ...base.embers, count: 28 },
    ash: { ...base.ash, count: 55 },
    smoke: { ...base.smoke, count: 0 },
    // A larger cast must not silently resurrect the superseded circular stage.
    platform: { ...base.platform, enabled: false },
  };
}

const NOISE = /* glsl */ `
varying vec3 vMidflankWorld;
uniform float uMidflankTime;
float mfHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float mfNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mfHash(i),mfHash(i+vec2(1,0)),f.x),
             mix(mfHash(i+vec2(0,1)),mfHash(i+vec2(1,1)),f.x),f.y);
}
float mfFbm(vec2 p) {
  return .55*mfNoise(p)+.28*mfNoise(p*2.07+3.2)+.17*mfNoise(p*4.31-5.8);
}
`;

/** Animate only the authored simulator surface; never draw a second river. */
export function createMidflankLava(
  terrain: Object3D,
  groundY: number
): EmberWorldElement {
  const object = new Group();
  object.name = "EmberMidflankThermalFinish";
  object.position.y = groundY;
  const time = { value: 0 };
  const originals: Array<{ mesh: Mesh; material: MeshStandardMaterial }> = [];
  const material = new MeshStandardMaterial({
    color: "#191714",
    roughness: 0.86,
    emissive: "#ffffff",
    side: DoubleSide,
  });
  material.name = "Ember_Midflank_R5_thermal-crust";
  material.customProgramCacheKey = () => "ember-midflank-simulator-crust-v1";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMidflankTime = time;
    shader.vertexShader =
      "varying vec3 vMidflankWorld;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvMidflankWorld = (modelMatrix * vec4(transformed, 1.)).xyz;"
    );
    shader.fragmentShader = NOISE + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      /* glsl */ `
      #include <emissivemap_fragment>
      vec2 p = vMidflankWorld.xz + vec2(0., uMidflankTime*.045);
      vec2 warp = vec2(mfFbm(p*.37),mfFbm(p*.43+9.2));
      float crust = mfFbm(p*1.35+warp*2.8);
      float opening = smoothstep(.64,.79,crust);
      float fissure = 1.-smoothstep(.008,.025,abs(mfFbm(p*1.8+warp)-.49));
      float heat = max(opening,fissure*.28);
      vec3 mfRadiance = mix(vec3(.9,.025,.001),vec3(3.1,.4,.009),opening);
      totalEmissiveRadiance = mfRadiance * heat;
      diffuseColor.rgb = mix(vec3(.012,.014,.014),vec3(.025,.008,.002),heat);
    `
    );
  };
  for (const name of ["EMBER_LavaSimulatorDeposit", "EMBER_SourceFissure"]) {
    const source = terrain.getObjectByName(name);
    source?.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || !(mesh.material instanceof MeshStandardMaterial))
        return;
      originals.push({ mesh, material: mesh.material });
      mesh.material = material;
    });
  }
  const deposit = terrain.getObjectByName("EMBER_LavaSimulatorDeposit") as
    | Mesh
    | undefined;
  const position = deposit?.geometry?.getAttribute("position");
  if (deposit && position) {
    deposit.updateWorldMatrix(true, false);
    const point = new Vector3();
    // Light the actual passing channel at three elevations, not a guessed spline.
    for (const z of [-30, 0, 35]) {
      let best = Infinity;
      const nearest = new Vector3();
      for (let index = 0; index < position.count; index++) {
        point
          .fromBufferAttribute(position, index)
          .applyMatrix4(deposit.matrixWorld);
        const distance = Math.abs(point.z - z);
        if (distance < best) {
          best = distance;
          nearest.copy(point);
        }
      }
      const light = new PointLight("#ff6417", 32, 20, 2);
      light.position.copy(nearest);
      light.position.y += 2.8 - groundY;
      object.add(light);
    }
  }
  return {
    object,
    update(deltaSeconds) {
      time.value += Math.min(Math.max(deltaSeconds, 0), 1 / 15);
    },
    setGroundY(value) {
      object.position.y = value;
    },
    dispose() {
      for (const entry of originals) entry.mesh.material = entry.material;
      material.dispose();
      object.clear();
    },
  };
}
