<script lang="ts">
  /**
   * ModelFirstPerson
   *
   * First-person controller for model-based museum scenes.
   * Uses Three.js PointerLockControls for mouse look and WASD for movement.
   * Includes raycasting-based collision detection for walls and floor.
   */

  import { T, useThrelte, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
  import { Vector3, Raycaster, MathUtils, type PerspectiveCamera, type Object3D } from "three";
  import { CameraMode } from "$lib/shared/3d/camera/types";
  import { cameraPreferences } from "$lib/shared/3d/camera/camera-preferences.svelte";
  import { SCALE } from "$lib/shared/3d/scale/scale-constants";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    /** Starting position [x, y, z] */
    spawnPosition?: [number, number, number];
    /** Movement speed (units per second) */
    moveSpeed?: number;
    /** Player height (eye level when standing) */
    playerHeight?: number;
    /** Collision radius around player */
    collisionRadius?: number;
    /** Maximum height player can step up (stairs) */
    maxStepHeight?: number;
    /** Sprint speed multiplier */
    sprintMultiplier?: number;
    /** Eye height when crouching */
    crouchHeight?: number;
    /** Initial upward velocity when jumping */
    jumpForce?: number;
    /** Gravity acceleration (units per second squared) */
    gravity?: number;
  }

  let {
    spawnPosition = [0, SCALE.EYE_HEIGHT, 5],
    moveSpeed = SCALE.WALK_SPEED,
    playerHeight = SCALE.PLAYER_HEIGHT,
    collisionRadius = SCALE.PLAYER_RADIUS,
    maxStepHeight = 0.5,
    sprintMultiplier = SCALE.SPRINT_MULTIPLIER,
    crouchHeight = 1.0,
    jumpForce = SCALE.JUMP_VELOCITY,
    gravity = Math.abs(SCALE.GRAVITY) * 2, // Amplified for game feel
  }: Props = $props();

  const { renderer, scene } = useThrelte();

  // Camera mode (1st person <-> 3rd person with V key)
  let cameraMode = $state<CameraMode>(
    cameraPreferences.getModeForDestination("gallery")
  );

  // Third person camera settings
  const THIRD_PERSON_DISTANCE = 5;
  const THIRD_PERSON_HEIGHT = 2;

  // Track player position separately for third-person
  let playerPosition = $state(new Vector3(0, 0, 0));
  $effect.pre(() => { playerPosition = new Vector3(...spawnPosition); });
  let playerYaw = $state(0);
  let playerPitch = $state(0);

  // Camera reference
  let camera: PerspectiveCamera | null = null;
  let controls: PointerLockControls | null = null;
  let isLocked = $state(false);

  // Movement state
  let keys = $state({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
    jump: false,
  });

  // Physics state
  let verticalVelocity = $state(0);
  let isGrounded = $state(true);
  let isCrouching = $state(false);
  let currentHeight = $state<number>(SCALE.PLAYER_HEIGHT);
  $effect.pre(() => { currentHeight = playerHeight; });

  // Raycasters for collision detection
  const floorRaycaster = new Raycaster();
  const wallRaycaster = new Raycaster();
  const ceilingRaycaster = new Raycaster();

  // Reusable vectors
  const direction = new Vector3();
  const moveVector = new Vector3();
  const playerPos = new Vector3();
  const downDirection = new Vector3(0, -1, 0);

  // Handle keyboard input
  function handleKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        keys.forward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.backward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.left = true;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.right = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = true;
        break;
      case "ControlLeft":
      case "ControlRight":
        // Toggle crouch on press
        if (!isCrouching) {
          isCrouching = true;
        } else if (canStandUp()) {
          isCrouching = false;
        }
        break;
      case "Space":
        keys.jump = true;
        break;
      case "KeyV":
        // Toggle between 1st and 3rd person (gallery doesn't have orbit)
        const newMode = cameraMode === CameraMode.FIRST_PERSON
          ? CameraMode.THIRD_PERSON
          : CameraMode.FIRST_PERSON;
        cameraPreferences.setModeForDestination("gallery", newMode);
        cameraMode = newMode;
        break;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        keys.forward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.backward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.left = false;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.right = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.sprint = false;
        break;
      // Note: crouch is toggle, not hold - no keyup handling needed
      // Note: jump is consumed on use, not on keyup
    }
  }

  // Handle click to lock pointer
  function handleClick() {
    if (controls && !controls.isLocked) {
      controls.lock();
    }
  }

  // Check wall collision and return hit info for sliding
  // Returns null if no collision, or the wall normal if collision detected
  function checkWallCollision(position: Vector3, moveDir: Vector3, distance: number): Vector3 | null {
    if (!scene.current) return null;

    const feetY = position.y - currentHeight;

    // Check at multiple heights relative to current height (adjusts for crouch)
    const heightRatio = currentHeight / playerHeight;
    const checkHeights = [0.1, 0.5 * heightRatio, 0.8 * heightRatio, currentHeight - 0.3];

    let closestHit: { distance: number; normal: Vector3 } | null = null;

    for (const heightOffset of checkHeights) {
      playerPos.set(position.x, feetY + heightOffset, position.z);

      wallRaycaster.set(playerPos, moveDir);
      wallRaycaster.far = distance + collisionRadius;

      const intersects = wallRaycaster.intersectObjects(scene.current.children, true);

      for (const hit of intersects) {
        if (hit.distance < distance + collisionRadius && hit.face) {
          if (!closestHit || hit.distance < closestHit.distance) {
            // Get world-space normal from the hit face
            const normal = hit.face.normal.clone();
            // Transform normal from object space to world space
            normal.transformDirection(hit.object.matrixWorld);
            closestHit = { distance: hit.distance, normal };
          }
        }
      }
    }

    return closestHit?.normal ?? null;
  }

  // Check if position is inside a wall (for push-back)
  function getWallPushBack(position: Vector3): Vector3 | null {
    if (!scene.current) return null;

    const feetY = position.y - currentHeight;
    const pushBack = new Vector3();
    let hitCount = 0;

    // Cast rays in 8 directions to detect if we're inside geometry
    const directions = [
      new Vector3(1, 0, 0),
      new Vector3(-1, 0, 0),
      new Vector3(0, 0, 1),
      new Vector3(0, 0, -1),
      new Vector3(0.707, 0, 0.707),
      new Vector3(-0.707, 0, 0.707),
      new Vector3(0.707, 0, -0.707),
      new Vector3(-0.707, 0, -0.707),
    ];

    for (const dir of directions) {
      playerPos.set(position.x, feetY + 1.0, position.z);
      wallRaycaster.set(playerPos, dir);
      wallRaycaster.far = collisionRadius;

      const intersects = wallRaycaster.intersectObjects(scene.current.children, true);

      const firstHit = intersects[0];
      if (intersects.length > 0 && firstHit && firstHit.face) {
        // We're too close - accumulate push direction (opposite of ray direction)
        const pushStrength = collisionRadius - firstHit.distance;
        pushBack.addScaledVector(dir, -pushStrength);
        hitCount++;
      }
    }

    if (hitCount > 0) {
      return pushBack;
    }
    return null;
  }

  // Get floor height at position - only accepts floors within step range
  function getFloorHeight(position: Vector3): number | null {
    if (!scene.current) return null;

    const currentFeetY = position.y - currentHeight;

    // Cast ray downward from current feet position (not from above!)
    // This prevents teleporting up to upper levels
    playerPos.copy(position);
    playerPos.y = currentFeetY + maxStepHeight; // Start just above max step height

    floorRaycaster.set(playerPos, downDirection);
    // Only look for floors within stepping distance below us
    floorRaycaster.far = maxStepHeight + 2; // Can step down ~2 meters (stairs)

    const intersects = floorRaycaster.intersectObjects(scene.current.children, true);

    const floorHit = intersects[0];
    if (intersects.length > 0 && floorHit) {
      const floorY = floorHit.point.y;

      // Only accept floors within our step range
      // Can step UP by maxStepHeight, can step DOWN further (falling/stairs)
      const stepUp = floorY - currentFeetY;

      if (stepUp <= maxStepHeight) {
        return floorY;
      }
      // Floor is too high above us - treat as wall, don't snap
      return null;
    }

    return null;
  }

  // Check if head would hit ceiling (for jump)
  function checkCeilingCollision(): boolean {
    if (!scene.current || !camera) return false;

    ceilingRaycaster.set(camera.position, new Vector3(0, 1, 0));
    ceilingRaycaster.far = 0.3; // Small buffer above head

    const intersects = ceilingRaycaster.intersectObjects(scene.current.children, true);
    return intersects.length > 0;
  }

  // Check if there's clearance to stand up from crouch
  function canStandUp(): boolean {
    if (!scene.current || !camera) return true;

    const heightDifference = playerHeight - crouchHeight;
    const rayOrigin = camera.position.clone();

    ceilingRaycaster.set(rayOrigin, new Vector3(0, 1, 0));
    ceilingRaycaster.far = heightDifference + 0.2; // Need clearance for full height

    const intersects = ceilingRaycaster.intersectObjects(scene.current.children, true);
    return intersects.length === 0;
  }

  // Set up controls when camera is ready
  function setupControls(cam: PerspectiveCamera) {
    camera = cam;

    if (!renderer) return;

    controls = new PointerLockControls(camera, renderer.current.domElement);

    // Track lock state
    controls.addEventListener("lock", () => { isLocked = true; });
    controls.addEventListener("unlock", () => { isLocked = false; });

    // Add click listener to lock pointer
    renderer.current.domElement.addEventListener("click", handleClick);
  }

  // Set up keyboard listeners
  $effect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  // Cleanup on destroy
  onDestroy(() => {
    if (controls) {
      controls.dispose();
    }
    if (renderer.current) {
      renderer.current.domElement.removeEventListener("click", handleClick);
    }
  });

  // Slide movement vector along wall surface
  function slideAlongWall(move: Vector3, wallNormal: Vector3): Vector3 {
    // Project movement onto the wall plane
    // slide = move - (move · normal) * normal
    const dot = move.dot(wallNormal);
    if (dot >= 0) {
      // Moving away from wall, no need to slide
      return move;
    }
    const slide = move.clone();
    slide.addScaledVector(wallNormal, -dot);
    return slide;
  }

  // Update position each frame based on input
  useTask((delta) => {
    if (!controls || !controls.isLocked || !camera) return;

    // Track yaw from camera for third-person
    playerYaw = camera.rotation.y;
    playerPitch = camera.rotation.x;

    // === 1. PUSH-BACK FROM WALLS ===
    // Use playerPosition for physics (updated from camera in first person)
    if (cameraMode === CameraMode.FIRST_PERSON) {
      playerPosition.copy(camera.position);
    }
    const pushBack = getWallPushBack(playerPosition);
    if (pushBack) {
      playerPosition.add(pushBack);
      if (cameraMode === CameraMode.FIRST_PERSON) {
        camera.position.add(pushBack);
      }
    }

    // === 2. CROUCH HEIGHT TRANSITION ===
    const targetHeight = isCrouching ? crouchHeight : playerHeight;
    currentHeight = MathUtils.lerp(currentHeight, targetHeight, delta * 10);

    // === 3. JUMP INITIATION ===
    if (keys.jump && isGrounded && verticalVelocity <= 0) {
      verticalVelocity = jumpForce;
      isGrounded = false;
      keys.jump = false; // Consume the jump input
    } else if (!isGrounded) {
      // Consume jump key if we're in the air (prevents buffering)
      keys.jump = false;
    }

    // === 4. APPLY GRAVITY ===
    verticalVelocity -= gravity * delta;
    verticalVelocity = Math.max(verticalVelocity, SCALE.TERMINAL_VELOCITY);

    // === 5. APPLY VERTICAL MOVEMENT ===
    playerPosition.y += verticalVelocity * delta;
    if (cameraMode === CameraMode.FIRST_PERSON) {
      camera.position.y = playerPosition.y;
    }

    // === 6. CEILING COLLISION ===
    if (verticalVelocity > 0 && checkCeilingCollision()) {
      verticalVelocity = 0; // Bonk - stop rising
    }

    // === 7. HORIZONTAL MOVEMENT ===
    direction.z = Number(keys.forward) - Number(keys.backward);
    direction.x = Number(keys.right) - Number(keys.left);

    if (direction.length() > 0) {
      direction.normalize();

      // Sprint: 2x speed when holding shift (but not while crouching)
      const effectiveSpeed = (keys.sprint && !isCrouching)
        ? moveSpeed * sprintMultiplier
        : (isCrouching ? moveSpeed * 0.5 : moveSpeed); // Crouch is slower

      const speed = effectiveSpeed * delta;

      // Get camera's forward and right vectors (horizontal only)
      const cameraDirection = new Vector3();
      camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0;
      cameraDirection.normalize();

      const cameraRight = new Vector3();
      cameraRight.crossVectors(cameraDirection, new Vector3(0, 1, 0)).normalize();

      // Calculate world-space movement vector
      moveVector.set(0, 0, 0);
      moveVector.addScaledVector(cameraDirection, direction.z * speed);
      moveVector.addScaledVector(cameraRight, direction.x * speed);

      // Check for wall collision and slide if needed
      const moveDir = moveVector.clone().normalize();
      const moveDistance = moveVector.length();

      const wallNormal = checkWallCollision(playerPosition, moveDir, moveDistance);

      if (wallNormal) {
        // Wall detected - slide along it instead of stopping
        const slideMove = slideAlongWall(moveVector, wallNormal);

        if (slideMove.length() > 0.001) {
          const slideDir = slideMove.clone().normalize();
          const slideNormal = checkWallCollision(playerPosition, slideDir, slideMove.length());

          if (!slideNormal) {
            playerPosition.add(slideMove);
            if (cameraMode === CameraMode.FIRST_PERSON) {
              camera.position.add(slideMove);
            }
          }
        }
      } else {
        playerPosition.add(moveVector);
        if (cameraMode === CameraMode.FIRST_PERSON) {
          camera.position.add(moveVector);
        }
      }
    }

    // === 8. FLOOR COLLISION & GROUND CHECK ===
    const floorY = getFloorHeight(playerPosition);
    if (floorY !== null) {
      const feetY = playerPosition.y - currentHeight;

      if (feetY <= floorY) {
        // We're at or below floor level - snap to floor
        playerPosition.y = floorY + currentHeight;
        if (cameraMode === CameraMode.FIRST_PERSON) {
          camera.position.y = playerPosition.y;
        }

        if (verticalVelocity < 0) {
          verticalVelocity = 0;
          isGrounded = true;
        }
      } else if (feetY - floorY < 0.1) {
        // Very close to floor - still grounded
        isGrounded = true;
      } else {
        // In the air
        isGrounded = false;
      }
    } else {
      // No floor found - in the air (or void)
      isGrounded = false;
    }

    // === 9. CAMERA POSITIONING FOR THIRD PERSON ===
    if (cameraMode === CameraMode.THIRD_PERSON) {
      // Position camera behind and above player
      const offsetX = -Math.sin(playerYaw) * THIRD_PERSON_DISTANCE;
      const offsetZ = -Math.cos(playerYaw) * THIRD_PERSON_DISTANCE;
      camera.position.set(
        playerPosition.x + offsetX,
        playerPosition.y + THIRD_PERSON_HEIGHT,
        playerPosition.z + offsetZ
      );
      camera.lookAt(playerPosition.x, playerPosition.y, playerPosition.z);
    }
  });
</script>

<T.PerspectiveCamera
  makeDefault
  position={spawnPosition}
  fov={SCALE.DEFAULT_FOV}
  near={SCALE.NEAR_CLIP}
  far={SCALE.FAR_CLIP}
  oncreate={(ref) => setupControls(ref)}
/>

<!-- Mode indicator (when pointer locked) -->
{#if isLocked}
  <div class="mode-indicator">
    <i class="fas" class:fa-eye={cameraMode === CameraMode.FIRST_PERSON} class:fa-user={cameraMode === CameraMode.THIRD_PERSON}></i>
    <span>{cameraMode === CameraMode.FIRST_PERSON ? t("gallery_camera_first_person") : t("gallery_camera_third_person")}</span>
    <span class="hint">{t("gallery_camera_switch_hint")}</span>
  </div>
{/if}

<style>
  .mode-indicator {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: white;
    font-size: 13px;
    pointer-events: none;
    z-index: 50;
  }

  .mode-indicator i {
    font-size: 14px;
    opacity: 0.9;
  }

  .mode-indicator .hint {
    margin-left: 0.5rem;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
