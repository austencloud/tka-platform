import { describe, expect, it } from "vitest";
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { collectCameraColliders } from "../../../packages/camera-3d/src/lib/camera-collider-index";

describe("collectCameraColliders", () => {
  it("indexes nested tagged walls without including unrelated scene objects", () => {
    const scene = new Group();
    const room = new Group();
    const wall = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const floor = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    wall.userData.cameraCollider = true;
    room.add(wall, floor);
    scene.add(room);

    expect(collectCameraColliders(scene)).toEqual([wall]);
  });

  it("returns an empty index when a scene has no opted-in colliders", () => {
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));

    expect(collectCameraColliders(scene)).toEqual([]);
  });
});
