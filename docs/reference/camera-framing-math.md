# Camera Framing Math Reference

How to position a perspective camera so that 1..N characters fit inside the frustum with configurable padding.

## Two Geometries: Box vs Sphere

| Geometry | Formula | Use When |
|---|---|---|
| Flat rectangle (AABB) | `d = halfExtent / tan(halfFov)` | Characters on a stage facing camera |
| Bounding sphere | `d = radius / sin(halfFov)` | Volumetric objects, arbitrary view angles |
| Box with depth | `d = halfHeight / tan(halfFov) + depth/2` | camera-controls `fitToBox` |

Using `sin` for a flat plane wastes ~10% screen space. Using `tan` for a sphere clips edges. At FOV=50: `1/tan(25°) = 2.145`, `1/sin(25°) = 2.366`.

## AABB Framing (Characters on Stage)

```
halfFovV = (fovDeg / 2) * PI / 180
halfFovH = atan(tan(halfFovV) * aspect)       // NOT halfFovV * aspect

distY = halfHeight / tan(halfFovV)
distX = halfWidth / tan(halfFovH)
distance = max(distY, distX) + halfDepth
```

### Performer Bounding Box

Rig origin sits at shoulder height. `userProportionsState.groundY ≈ -1.56` (negative = feet below origin).

```
absGroundY = -groundY                          // ~1.56m feet-to-shoulders
feetY = groundOffset - absGroundY              // feet on platform
topY = groundOffset + PER_PERFORMER_EXTENT     // props above shoulders
centerY = (feetY + topY) / 2
halfHeight = (topY - feetY) / 2
```

**Bug that burned us:** Setting `feetY = groundOffset` treats the rig origin (shoulders) as the feet. Makes centerY ~1.5m too high — performer appears in upper portion of frame with empty space below.

### Multi-Performer Groups

```
cx = mean(performer.x for all)
cz = mean(performer.z for all)
groupRadius = max(distance(p, center) for all p) + PER_PERFORMER_EXTENT
```

## Elevation Angle

Camera slightly above horizontal for natural viewing. Decompose distance:

```
horizDist = distance * cos(elevationRad)
vertOffset = distance * sin(elevationRad)

eye.y = centerY + vertOffset
eye.z = centerZ - horizDist     // wall plane
```

At 12-15°, vertical compression < 3% — negligible.

## Aspect Ratio Handling (camera-controls source)

From `yomotsu/camera-controls` v3.1.2 `getDistanceToFitBox`:

```typescript
const boundingRectAspect = width / height;
const fov = camera.getEffectiveFOV() * DEG2RAD;
const aspect = camera.aspect;
const heightToFit = (boundingRectAspect < aspect) ? height : width / aspect;
return heightToFit * 0.5 / Math.tan(fov * 0.5) + depth * 0.5;
```

When bounding rect is wider than viewport (`rectAspect > cameraAspect`), converts width to equivalent height via `width / aspect`.

From `getDistanceToFitSphere`:

```typescript
const vFOV = camera.getEffectiveFOV() * DEG2RAD;
const hFOV = Math.atan(Math.tan(vFOV * 0.5) * camera.aspect) * 2;
const fov = 1 < camera.aspect ? vFOV : hFOV;
return radius / Math.sin(fov * 0.5);
```

## Common Pitfalls

1. **sin/tan confusion** — tan for box, sin for sphere. Never mix.
2. **Full FOV instead of half** — always halve before trig.
3. **Wrong horizontal FOV** — `atan(tan(halfFovV) * aspect)`, NOT `halfFovV * aspect`.
4. **Missing depth offset** — add `halfDepth` for boxes with Z extent.
5. **Degrees in trig** — Three.js `camera.fov` is degrees; trig needs radians.
6. **`feetY = groundOffset`** — that's the rig origin (shoulders), not feet.

## Quick Reference

```
tan(halfFov) = halfExtent / distance        (box)
sin(halfFov) = radius / distance            (sphere)
halfFovH = atan(tan(halfFovV) * aspect)     (horizontal FOV)

Target = AABB center = (min + max) / 2
Camera = target - viewDir * distance
```

## Sources

- [camera-controls source](https://github.com/yomotsu/camera-controls/blob/dev/src/CameraControls.ts)
- [Cracking the three.js object fitting nut](https://wejn.org/2020/12/cracking-the-threejs-object-fitting-nut/)
- [Unity: Fit object into perspective camera FOV](https://discussions.unity.com/t/fit-object-exactly-into-perspective-cameras-field-of-view-focus-the-object/677696)
