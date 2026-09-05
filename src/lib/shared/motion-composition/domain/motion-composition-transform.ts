import { Matrix4, Quaternion, Vector3 } from "three";
import type {
  Matrix4Tuple,
  QuaternionTuple,
  SpatialEndpoint,
  SpatialTransform,
  Vector3Tuple,
} from "./motion-composition-types";

export const IDENTITY_TRANSFORM: SpatialTransform = {
  translation: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function vector3(value: Vector3Tuple): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}

function quaternion(value: QuaternionTuple): Quaternion {
  return new Quaternion(value[0], value[1], value[2], value[3]).normalize();
}

function vectorTuple(value: Vector3): Vector3Tuple {
  return [value.x, value.y, value.z];
}

function quaternionTuple(value: Quaternion): QuaternionTuple {
  return [value.x, value.y, value.z, value.w];
}

export function composeSpatialTransform(transform: SpatialTransform): Matrix4 {
  return new Matrix4().compose(
    vector3(transform.translation),
    quaternion(transform.rotation),
    vector3(transform.scale)
  );
}

export function decomposeSpatialTransform(matrix: Matrix4): SpatialTransform {
  const translation = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(translation, rotation, scale);
  return {
    translation: vectorTuple(translation),
    rotation: quaternionTuple(rotation.normalize()),
    scale: vectorTuple(scale),
  };
}

export function matrix4Tuple(matrix: Matrix4): Matrix4Tuple {
  return matrix.elements.slice(0, 16) as unknown as Matrix4Tuple;
}

export function transformPoint(
  matrix: Matrix4,
  position: Vector3Tuple
): Vector3Tuple {
  return vectorTuple(vector3(position).applyMatrix4(matrix));
}

export function transformEndpoint(
  matrix: Matrix4,
  endpoint: SpatialEndpoint
): SpatialEndpoint {
  return {
    id: endpoint.id,
    position: transformPoint(matrix, endpoint.position),
  };
}

export function interpolateVector3(
  from: Vector3Tuple,
  to: Vector3Tuple,
  progress: number
): Vector3Tuple {
  return vectorTuple(vector3(from).lerp(vector3(to), progress));
}

export function interpolateQuaternion(
  from: QuaternionTuple,
  to: QuaternionTuple,
  progress: number
): QuaternionTuple {
  return quaternionTuple(quaternion(from).slerp(quaternion(to), progress));
}

export function interpolateSpatialTransform(
  from: SpatialTransform,
  to: SpatialTransform,
  progress: number
): SpatialTransform {
  return {
    translation: interpolateVector3(from.translation, to.translation, progress),
    rotation: interpolateQuaternion(from.rotation, to.rotation, progress),
    scale: interpolateVector3(from.scale, to.scale, progress),
  };
}

export function quaternionFromUpDirection(
  direction: Vector3Tuple,
  fallback: QuaternionTuple
): QuaternionTuple {
  const target = vector3(direction);
  if (target.lengthSq() < 1e-12) return fallback;
  target.normalize();
  return quaternionTuple(
    new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), target)
  );
}

export function worldLockedLocalTransform(
  parentWorld: Matrix4,
  sampled: SpatialTransform
): SpatialTransform {
  const parent = decomposeSpatialTransform(parentWorld);
  const localRotation = quaternion(parent.rotation)
    .invert()
    .multiply(quaternion(sampled.rotation))
    .normalize();
  const safeDivide = (value: number, divisor: number): number =>
    Math.abs(divisor) < 1e-12 ? value : value / divisor;

  return {
    translation: sampled.translation,
    rotation: quaternionTuple(localRotation),
    scale: [
      safeDivide(sampled.scale[0], parent.scale[0]),
      safeDivide(sampled.scale[1], parent.scale[1]),
      safeDivide(sampled.scale[2], parent.scale[2]),
    ],
  };
}
