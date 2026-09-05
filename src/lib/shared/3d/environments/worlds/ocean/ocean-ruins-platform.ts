import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  type BufferGeometry,
} from "three";
import {
  advanceDaisTime,
  applyDaisConfig,
  createBodyMaterial,
  createTopMaterial,
} from "../../scenes/ocean/runtime/ruins-shaders";
import { patchCausticsMaterial } from "../../scenes/ocean/runtime/atmosphere/seabed-caustics";

export interface OceanRuinsPlatformConfig {
  enabled: boolean;
  width: number;
  depth: number;
  height: number;
  elevation?: number;
  stoneColor: string;
  runeGlowColor: string;
  glowIntensity: number;
  mossIntensity: number;
  columnCount: number;
  zOffset?: number;
  groundOffset?: number;
}

export interface OceanRuinsPlatform {
  object: Group;
  update(delta: number): void;
  setConfig(config: OceanRuinsPlatformConfig): void;
  setGroundY(groundY: number): void;
  dispose(): void;
}

interface PlatformGeometrySet {
  body: BoxGeometry;
  top: PlaneGeometry;
  column: CylinderGeometry;
  support?: CylinderGeometry;
}

function disposeGeometries(geometries: PlatformGeometrySet | null): void {
  if (!geometries) return;
  geometries.body.dispose();
  geometries.top.dispose();
  geometries.column.dispose();
  geometries.support?.dispose();
}

function removeMeshes(root: Group): void {
  const children = [...root.children];
  for (const child of children) root.remove(child);
}

function addMesh(
  root: Group,
  geometry: BufferGeometry,
  material: import("three").Material,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

/**
 * Exact renderer-neutral owner for Ocean's procedural ruins dais.
 *
 * The Svelte scene and worker renderer both mount this same object graph, shader
 * patches, dimensions, and placement. Configuration changes rebuild only the
 * inexpensive primitive geometry; the three shader materials remain stable.
 */
export function createOceanRuinsPlatform(
  initialConfig: OceanRuinsPlatformConfig,
  initialGroundY: number,
): OceanRuinsPlatform {
  const root = new Group();
  root.name = "OceanRuinsPlatform";

  let config = initialConfig;
  let groundY = initialGroundY;
  let geometries: PlatformGeometrySet | null = null;

  const materialConfig = {
    stoneColor: config.stoneColor,
    runeGlowColor: config.runeGlowColor,
    glowIntensity: config.glowIntensity,
    mossIntensity: config.mossIntensity,
  };
  const bodyMaterial = createBodyMaterial(materialConfig);
  const topMaterial = createTopMaterial(materialConfig, config.width, config.depth);
  patchCausticsMaterial(topMaterial);
  const columnMaterial = createBodyMaterial(materialConfig);

  function rebuild(): void {
    removeMeshes(root);
    disposeGeometries(geometries);

    const elevation = config.elevation ?? 0;
    const groundOffset = config.groundOffset ?? 0;
    const baseY = groundY + groundOffset;

    geometries = {
      body: new BoxGeometry(config.width, config.height, config.depth),
      top: new PlaneGeometry(config.width, config.depth),
      column: new CylinderGeometry(0.12, 0.15, 0.6, 8),
      support:
        elevation > 0
          ? new CylinderGeometry(0.2, 0.35, elevation, 8)
          : undefined,
    };

    root.visible = config.enabled;
    root.position.z = config.zOffset ?? 0;

    const body = addMesh(root, geometries.body, bodyMaterial);
    body.position.y = baseY + elevation + config.height / 2;

    const top = addMesh(root, geometries.top, topMaterial);
    top.castShadow = false;
    top.rotation.x = -Math.PI / 2;
    top.position.y = baseY + elevation + config.height + 0.001;

    const hw = config.width * 0.46;
    const hd = config.depth * 0.46;
    const columnPositions: [number, number][] = [
      [-hw, -hd],
      [-hw, hd],
      [hw, -hd],
      [hw, hd],
    ];
    const midpoints: [number, number][] = [
      [0, -hd],
      [0, hd],
      [-hw, 0],
      [hw, 0],
      [-hw * 0.5, -hd],
      [hw * 0.5, -hd],
      [-hw * 0.5, hd],
      [hw * 0.5, hd],
    ];
    for (let i = 0; i < Math.min(config.columnCount, 12); i += 1) {
      const position = i < 4 ? columnPositions[i]! : midpoints[i - 4]!;
      const scaleY =
        i < 4
          ? (0.3 + ((i * 0.17) % 0.4)) / 0.6
          : (0.25 + (((i - 4) * 0.13) % 0.35)) / 0.6;
      const column = addMesh(root, geometries.column, columnMaterial);
      column.position.set(
        position[0],
        baseY + elevation + config.height + scaleY * 0.3,
        position[1],
      );
      column.scale.y = scaleY;
    }

    if (geometries.support) {
      const supportWidth = config.width * 0.4;
      const supportDepth = config.depth * 0.4;
      const supports: [number, number][] = [
        [-supportWidth, -supportDepth],
        [-supportWidth, supportDepth],
        [supportWidth, -supportDepth],
        [supportWidth, supportDepth],
        [0, -supportDepth],
        [0, supportDepth],
      ];
      for (const [x, z] of supports) {
        const support = addMesh(root, geometries.support, bodyMaterial);
        support.position.set(x, baseY + elevation / 2, z);
      }
    }
  }

  function setConfig(next: OceanRuinsPlatformConfig): void {
    config = next;
    const shaderConfig = {
      stoneColor: config.stoneColor,
      runeGlowColor: config.runeGlowColor,
      glowIntensity: config.glowIntensity,
      mossIntensity: config.mossIntensity,
    };
    applyDaisConfig(bodyMaterial, shaderConfig);
    applyDaisConfig(topMaterial, shaderConfig, {
      width: config.width,
      depth: config.depth,
    });
    applyDaisConfig(columnMaterial, shaderConfig);
    rebuild();
  }

  rebuild();

  return {
    object: root,
    update(delta) {
      const dt = delta * 0.8;
      advanceDaisTime(bodyMaterial, dt);
      advanceDaisTime(topMaterial, dt);
      advanceDaisTime(columnMaterial, dt);
    },
    setConfig,
    setGroundY(nextGroundY) {
      if (groundY === nextGroundY) return;
      groundY = nextGroundY;
      rebuild();
    },
    dispose() {
      removeMeshes(root);
      disposeGeometries(geometries);
      geometries = null;
      bodyMaterial.dispose();
      topMaterial.dispose();
      columnMaterial.dispose();
    },
  };
}
