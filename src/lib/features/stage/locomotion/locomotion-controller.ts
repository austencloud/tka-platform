import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  LOCOMOTION_CLIPS,
  computeBlendWeights,
  computeTimeScale,
} from "./clip-registry";

export interface LocomotionState {
  position: THREE.Vector3;
  facing: number;
  speed: number;
  isMoving: boolean;
}

export class LocomotionController {
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<string, THREE.AnimationAction> = {};
  private clips: Record<string, THREE.AnimationClip> = {};
  private _state: LocomotionState = {
    position: new THREE.Vector3(),
    facing: 0,
    speed: 0,
    isMoving: false,
  };
  private targetPosition = new THREE.Vector3();
  private targetFacing = 0;
  private readonly rotationSpeed = 8;

  get state(): LocomotionState {
    return this._state;
  }

  async initialize(scene: THREE.Object3D): Promise<void> {
    this.mixer = new THREE.AnimationMixer(scene);
    const loader = new GLTFLoader();

    for (const [name, meta] of Object.entries(LOCOMOTION_CLIPS)) {
      try {
        const gltf = await loader.loadAsync(meta.path);
        if (gltf.animations.length > 0) {
          const clip = gltf.animations[0]!;
          this.clips[name] = clip;
          const action = this.mixer!.clipAction(clip);
          action.play();
          action.setEffectiveWeight(name === "idle" ? 1 : 0);
          action.setLoop(THREE.LoopRepeat, Infinity);
          this.actions[name] = action;
        }
      } catch (e) {
        console.warn(`[Locomotion] Failed to load clip: ${meta.path}`, e);
      }
    }
  }

  setTarget(x: number, z: number, facing: number): void {
    this.targetPosition.set(x, 0, z);
    this.targetFacing = facing;
  }

  update(dt: number, currentSpeed: number): void {
    if (!this.mixer) return;

    this._state.speed = currentSpeed;
    this._state.isMoving = currentSpeed > 0.01;

    const weights = computeBlendWeights(currentSpeed);
    if (this.actions.idle) this.actions.idle.setEffectiveWeight(weights.idle);
    if (this.actions.walk) {
      this.actions.walk.setEffectiveWeight(weights.walk);
      if (weights.walk > 0) {
        this.actions.walk.setEffectiveTimeScale(
          computeTimeScale(currentSpeed, LOCOMOTION_CLIPS.walk!.speedMs)
        );
      }
    }
    if (this.actions.run) {
      this.actions.run.setEffectiveWeight(weights.run);
      if (weights.run > 0) {
        this.actions.run.setEffectiveTimeScale(
          computeTimeScale(currentSpeed, LOCOMOTION_CLIPS.run!.speedMs)
        );
      }
    }

    let facingDelta =
      ((this.targetFacing - this._state.facing + Math.PI) % (Math.PI * 2)) -
      Math.PI;
    if (facingDelta < -Math.PI) facingDelta += Math.PI * 2;
    const maxRotation = this.rotationSpeed * dt;
    this._state.facing += Math.sign(facingDelta) * Math.min(Math.abs(facingDelta), maxRotation);

    this._state.position.copy(this.targetPosition);

    this.mixer.update(dt);
  }

  dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
    }
    this.actions = {};
    this.clips = {};
  }
}
