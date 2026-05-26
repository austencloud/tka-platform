import { Raycaster, Plane, Vector3, Vector2, type Camera } from 'three';

export interface FishScatterState {
  rayPosition: Vector3;
  update(ndcX: number, ndcY: number, camera: Camera, swimPlaneY: number): void;
  clear(): void;
}

export function createFishScatterState(): FishScatterState {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const hitPoint = new Vector3();
  const projPoint = new Vector3();
  const rayPosition = new Vector3(0, -999, 0);

  function update(ndcX: number, ndcY: number, camera: Camera, swimPlaneY: number): void {
    ndc.set(ndcX, ndcY);
    raycaster.setFromCamera(ndc, camera);

    const swimPlane = new Plane(new Vector3(0, 1, 0), -swimPlaneY);
    const planeHit = raycaster.ray.intersectPlane(swimPlane, hitPoint);

    if (planeHit) {
      rayPosition.copy(hitPoint);
    } else {
      // Fallback: project along ray to swimPlaneY
      const camPos = raycaster.ray.origin;
      const dir = raycaster.ray.direction;
      const t = dir.y !== 0 ? (swimPlaneY - camPos.y) / dir.y : 0;
      if (t > 0) {
        projPoint.copy(dir).multiplyScalar(t).add(camPos);
        rayPosition.copy(projPoint);
      } else {
        projPoint.copy(dir).multiplyScalar(30).add(camPos);
        projPoint.y = swimPlaneY;
        rayPosition.copy(projPoint);
      }
    }
  }

  function clear(): void {
    rayPosition.set(0, -999, 0);
  }

  return { rayPosition, update, clear };
}
