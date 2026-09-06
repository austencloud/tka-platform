import {
  DoubleSide,
  Group,
  InstancedMesh,
  DynamicDrawUsage,
  Object3D,
  type Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
} from "three";
import { measureFlowPath, sampleFlowPath } from "./ember-flow-motion";
import type { EmberSceneConfig } from "../../domain/models/scene-configs/ember-scene-config";
import type { EmberWorldElement } from "./ember-lava-features";
import midflank from "../../domain/models/scene-configs/ember-midflank-r5.json";

export function withMidflankAtmosphere(
  base: EmberSceneConfig
): EmberSceneConfig {
  const [sourceX, sourceY, sourceZ] = midflank.sourceWorldXYZ;
  if (sourceX === undefined || sourceY === undefined || sourceZ === undefined) {
    throw new Error("Ember midflank source position is missing coordinates");
  }
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
        position: [sourceX, sourceY + 3, sourceZ],
        color: "#ff6818",
        intensity: 60,
        distance: 48,
        decay: 2,
      },
      heatFields: [],
      plumes: [],
    },
    volcanicHaze: base.volcanicHaze
      ? {
          ...base.volcanicHaze,
          color1: "#4e5355",
          color2: "#242b31",
          opacity: 0.32,
          lightningIntensity: 0,
          innerGlowColor: "#7b3c20",
          underglowColor: "#925330",
          underglowStrength: 0.12,
          underglowDirection: [-34, 0, 132],
        }
      : null,
    embers: { ...base.embers, count: 28 },
    ash: base.ash ? { ...base.ash, count: 55 } : null,
    smoke: base.smoke ? { ...base.smoke, count: 0 } : null,
    // A larger cast must not silently resurrect the superseded circular stage.
    platform: { ...base.platform, enabled: false },
  };
}

const NOISE = /* glsl */ `
varying vec3 vMidflankWorld;
varying vec2 vMidflankFlow;
varying float vMidflankBank;
varying float vMidflankHeat;
varying float vMidflankReflection;
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

/** Animate the authored river network without adding runtime surface geometry. */
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
    roughness: 0.58,
    emissive: "#ffffff",
    side: DoubleSide,
    vertexColors: true,
  });
  material.name = "Ember_Midflank_R5_thermal-crust";
  material.customProgramCacheKey = () => "ember-midflank-flowing-network-v5";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMidflankTime = time;
    shader.vertexShader =
      "varying vec3 vMidflankWorld;\nvarying vec2 vMidflankFlow;\nvarying float vMidflankBank;\nvarying float vMidflankHeat;\nvarying float vMidflankReflection;\nuniform float uMidflankTime;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vMidflankFlow = uv;
      vMidflankBank = color.r;
      vMidflankHeat = color.g / max(color.r, .001);
      vMidflankReflection = color.b / max(color.r, .001);
      float along = uv.y - uMidflankTime * .72;
      float surge = .028 * sin(along * 2.1 + sin(uv.x * 1.8))
                  + .012 * sin(along * 5.3 + uv.x * .9);
      vec3 lavaUp = vec3(modelMatrix[0].y, modelMatrix[1].y, modelMatrix[2].y)
        / vec3(dot(modelMatrix[0].xyz,modelMatrix[0].xyz),
               dot(modelMatrix[1].xyz,modelMatrix[1].xyz),
               dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
      transformed += lavaUp * surge * vMidflankBank;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvMidflankWorld = (modelMatrix * vec4(transformed, 1.)).xyz;"
    );
    shader.fragmentShader = NOISE + shader.fragmentShader;
    // Distant, crust-covered channels must not become white ribbons in the
    // grazing key light. Existing river masks retain their original reflection.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_fragment>",
      `#include <lights_physical_fragment>
      material.specularColor *= vMidflankReflection;
      material.specularColorBlended *= vMidflankReflection;
      material.specularF90 *= vMidflankReflection;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      /* glsl */ `
      #include <emissivemap_fragment>
      vec2 p = vec2(vMidflankFlow.x, vMidflankFlow.y - uMidflankTime*.72);
      vec2 warp = vec2(mfFbm(p*.44),mfFbm(p*.39+9.2));
      float crust = mfFbm(p*vec2(1.5,.68)+warp*1.8);
      float opening = smoothstep(.53,.72,crust);
      float fissure = 1.-smoothstep(.015,.07,abs(mfFbm(p*vec2(1.1,.54)+warp)-.49));
      float heat = max(opening,fissure*.32) * smoothstep(.05,.85,vMidflankBank);
      vec3 mfRadiance = mix(vec3(1.1,.035,.001),vec3(2.8,.32,.008),opening);
      // Subpixel fissures fade to their average coverage instead of sparkling
      // or becoming a giant painted stripe when the camera moves away.
      float footprint = max(length(dFdx(p)),length(dFdy(p)));
      float unresolved = smoothstep(.6,2.8,footprint);
      heat = mix(heat,.16*smoothstep(.05,.85,vMidflankBank),unresolved);
      mfRadiance = mix(mfRadiance,vec3(1.8,.14,.003),unresolved);
      totalEmissiveRadiance = mfRadiance * heat * vMidflankHeat;
      diffuseColor.rgb = mix(vec3(.026,.022,.020),vec3(.035,.008,.002),heat);
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>",
      /* glsl */ `
      #if defined(USE_FOG) && defined(MIDFLANK_REMOTE)
        // The near-field fog would erase a kilometre-long outflow entirely.
        // Ease into the backdrop's atmospheric depth, retaining upstream fog
        // at the join. Heat, crust size, and motion are otherwise identical.
        float remoteDensity = mix(.0038,.0012,
          smoothstep(140.,450.,length(vMidflankWorld.xz)));
        float remoteFog = 1.-exp(-remoteDensity*remoteDensity*vFogDepth*vFogDepth);
        gl_FragColor.rgb = mix(gl_FragColor.rgb,fogColor,remoteFog);
      #else
        #include <fog_fragment>
      #endif
      `
    );
  };
  const distantMaterial = material.clone();
  distantMaterial.name = "Ember_Midflank_thermal-crust-distant";
  distantMaterial.defines = { MIDFLANK_REMOTE: 1 };
  distantMaterial.onBeforeCompile = material.onBeforeCompile;
  distantMaterial.customProgramCacheKey = () =>
    "ember-midflank-flowing-network-v5-remote";
  terrain.traverse((child) => {
    const mesh = child as Mesh;
    if (
      !mesh.isMesh ||
      !(mesh.material instanceof MeshStandardMaterial) ||
      !(
        mesh.name === "EMBER_LavaSimulatorDeposit" ||
        mesh.userData.ember_flow_surface ||
        mesh.userData.ember_distant_flow_surface
      )
    )
      return;
    originals.push({ mesh, material: mesh.material });
    mesh.material = mesh.userData.ember_distant_flow_surface
      ? distantMaterial
      : material;
  });
  const deposit = terrain.getObjectByName("EMBER_LavaSimulatorDeposit") as
    | Mesh
    | undefined;
  const position = deposit?.geometry?.getAttribute("position");
  const template = terrain.getObjectByName("EMBER_FloatingCrustTemplate") as
    | Mesh
    | undefined;
  const rawPaths = deposit?.userData.ember_flow_paths as
    | number[][][]
    | undefined;
  const templateVisible = template?.visible;
  if (template) template.visible = false;
  deposit?.updateWorldMatrix(true, false);
  const paths = (rawPaths ?? [])
    .map((points) =>
      measureFlowPath(
        points.map(
          (point) => new Vector3(...(point as [number, number, number]))
        )
      )
    )
    .filter((path) => path.length > 5);
  const secondaryPaths = originals
    .filter(({ mesh }) => mesh !== deposit)
    .flatMap(
      ({ mesh }) => (mesh.userData.ember_flow_paths ?? []) as number[][][]
    )
    .map((points) =>
      measureFlowPath(points.map((p) => new Vector3(p[0], p[1], p[2])))
    )
    .filter((path) => path.length > 5);
  // Keep the approved close river's 240 rafts and their trajectories intact.
  const raftPaths = paths.length
    ? Array.from({ length: 240 }, (_, index) => paths[index % paths.length])
    : [];
  for (const path of secondaryPaths) {
    raftPaths.push(...Array.from({ length: 32 }, () => path));
  }
  const raftMaterial = new MeshStandardMaterial({
    color: "#292321",
    roughness: 0.82,
    emissive: "#3c0801",
    emissiveIntensity: 0.32,
    side: DoubleSide,
  });
  template?.updateWorldMatrix(true, false);
  // Decode meshopt's node scale and the Blender axis conversion once. Raft
  // transforms then use real metres, independent of how the GLB was quantized.
  const raftGeometry = template?.geometry
    .clone()
    .applyMatrix4(template.matrixWorld)
    .center();
  const rafts =
    raftGeometry && raftPaths.length
      ? new InstancedMesh(raftGeometry, raftMaterial, raftPaths.length)
      : null;
  const dummy = new Object3D();
  const tangent = new Vector3();
  if (rafts) {
    rafts.name = "EmberDriftingCrust";
    rafts.instanceMatrix.setUsage(DynamicDrawUsage);
    // A fixed initial sphere would cull moving rafts when they round the bend.
    rafts.frustumCulled = false;
    object.add(rafts);
  }
  const updateRafts = () => {
    if (!rafts) return;
    for (let index = 0; index < rafts.count; index++) {
      const path = raftPaths[index]!;
      const phase = (index * 0.61803398875) % 1;
      const distance =
        phase * path.length + time.value * (0.62 + (index % 7) * 0.025);
      sampleFlowPath(path, distance, dummy.position, tangent);
      dummy.position.y +=
        0.048 + Math.sin(time.value * 1.7 + phase * 15) * 0.015;
      dummy.rotation.set(
        -Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)),
        Math.atan2(tangent.x, tangent.z) +
          Math.sin(time.value * 0.18 + index) * 0.18,
        Math.sin(time.value * 0.7 + index) * 0.035,
        "YXZ"
      );
      // Crust forms/melts near a path endpoint instead of visibly teleporting.
      const travel = distance % path.length;
      const fade = Math.min(1, travel / 1.8, (path.length - travel) / 1.8);
      const size =
        (0.35 + (index % 11) * 0.08) * fade * (index < 240 ? 1 : 0.55);
      dummy.scale.set(size, 1, size * (1.1 + (index % 3) * 0.2));
      dummy.updateMatrix();
      rafts.setMatrixAt(index, dummy.matrix);
    }
    rafts.instanceMatrix.needsUpdate = true;
  };
  updateRafts();
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
      updateRafts();
    },
    setGroundY(value) {
      object.position.y = value;
    },
    dispose() {
      for (const entry of originals) entry.mesh.material = entry.material;
      material.dispose();
      distantMaterial.dispose();
      rafts?.dispose();
      raftGeometry?.dispose();
      raftMaterial.dispose();
      if (template) template.visible = templateVisible!;
      object.clear();
    },
  };
}
