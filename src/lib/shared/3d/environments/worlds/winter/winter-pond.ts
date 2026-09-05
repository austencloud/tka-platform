import {
  Color,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from "three";
import { createOrganicPondShape } from "../../primitives/organic-pond-shape";
import type { WinterSceneConfig } from "../../domain/models/scene-configs";
import { WINTER_POND_LAYOUT } from "../../scenes/winter/authored/winter-layout";

export interface WinterPondTextures {
  colorMap: Texture;
  roughnessMap: Texture;
  bodyNormal: Texture;
  coatNormal: Texture;
}

export interface WinterPond {
  object: Group;
  setGroundY(groundY: number): void;
  dispose(): void;
}

export function createWinterPond(
  pond: NonNullable<WinterSceneConfig["pond"]>,
  groundY: number,
  surfaceDetail: "full" | "reduced",
  textures: WinterPondTextures
): WinterPond {
  const { colorMap, roughnessMap, bodyNormal, coatNormal } = textures;
  colorMap.colorSpace = SRGBColorSpace;
  roughnessMap.colorSpace = NoColorSpace;
  bodyNormal.colorSpace = NoColorSpace;
  coatNormal.colorSpace = NoColorSpace;

  for (const texture of [colorMap, roughnessMap, bodyNormal, coatNormal]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.anisotropy = surfaceDetail === "full" ? 8 : 4;
  }
  colorMap.repeat.set(0.12, 0.12);
  roughnessMap.repeat.copy(colorMap.repeat);
  bodyNormal.repeat.set(0.42, 0.38);
  coatNormal.repeat.set(0.68, 0.62);
  coatNormal.rotation = 0.38;
  coatNormal.center.set(0.5, 0.5);

  const geometry = new ShapeGeometry(
    createOrganicPondShape({
      radiusX: WINTER_POND_LAYOUT.radiusX,
      radiusZ: WINTER_POND_LAYOUT.radiusZ,
      seed: WINTER_POND_LAYOUT.seed,
      pointCount: 48,
    }),
    48
  );
  const tint = new Color(pond.color).lerp(new Color("#8fa7b8"), 0.18);
  const bodyMaterial = new MeshPhysicalMaterial({
    color: tint,
    map: colorMap,
    roughnessMap,
    roughness: Math.max(0.56, pond.roughness),
    metalness: 0.015,
    normalMap: bodyNormal,
    normalScale:
      surfaceDetail === "full"
        ? new Vector2(0.3, 0.28)
        : new Vector2(0.16, 0.14),
    clearcoat: 0.26,
    clearcoatRoughness: 0.42,
    clearcoatNormalMap: coatNormal,
    clearcoatNormalScale: new Vector2(0.07, 0.07),
    ior: 1.31,
    envMapIntensity: 0.48,
  });
  const clearMaterial = new MeshPhysicalMaterial({
    color: new Color("#9fb8c9"),
    roughness: 0.48,
    metalness: 0,
    transparent: true,
    opacity: surfaceDetail === "full" ? 0.045 : 0.025,
    depthWrite: false,
    clearcoat: 0.18,
    clearcoatRoughness: 0.5,
    normalMap: coatNormal,
    normalScale: new Vector2(0.05, 0.05),
    envMapIntensity: 0.38,
  });

  const object = new Group();
  object.name = "winter-pond";
  object.position.set(
    WINTER_POND_LAYOUT.centerX,
    groundY + WINTER_POND_LAYOUT.waterLevelOffset,
    WINTER_POND_LAYOUT.centerZ
  );
  const body = new Mesh(geometry, bodyMaterial);
  body.name = "winter-pond-body";
  body.rotation.x = -Math.PI / 2;
  body.receiveShadow = true;
  body.renderOrder = 70;
  object.add(body);
  const clear = new Mesh(geometry, clearMaterial);
  clear.name = "winter-pond-clearcoat";
  clear.rotation.x = -Math.PI / 2;
  clear.position.y = 0.018;
  clear.renderOrder = 71;
  object.add(clear);

  return {
    object,
    setGroundY(nextGroundY) {
      object.position.y = nextGroundY + WINTER_POND_LAYOUT.waterLevelOffset;
    },
    dispose() {
      geometry.dispose();
      bodyMaterial.dispose();
      clearMaterial.dispose();
      object.clear();
    },
  };
}
