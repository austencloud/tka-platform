<script module lang="ts">
  import { getAvatarModelPath, prepareSharedGltf } from "@austencloud/scene-3d";

  const preparedModels = new Map<string, Promise<void>>();

  function prepareAvatar(avatarId: string): Promise<void> {
    const url = getAvatarModelPath(avatarId);
    const existing = preparedModels.get(url);
    if (existing) return existing;

    const pending = prepareSharedGltf(url).catch((error) => {
      if (preparedModels.get(url) === pending) preparedModels.delete(url);
      throw error;
    });
    preparedModels.set(url, pending);
    return pending;
  }
</script>

<script lang="ts">
  import { useTask } from "@threlte/core";
  import { T } from "@threlte/core";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import {
    InstancedMesh,
    SphereGeometry,
    MeshBasicMaterial,
    Matrix4,
    Vector3,
    AdditiveBlending,
    Group,
  } from "three";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import { getPerformerColor } from "../constants/performer-colors";

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SWITCH THIS TO COMPARE MODES:
  //   "fade" = opacity crossfade (avatar only, props stay)
  //   "pop"  = instant hide + particle burst
  const MODE: "fade" | "pop" = "pop";
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  interface Props {
    performer: AvatarInstanceState;
    performerIndex: number;
    groundOffset: number;
    children: Snippet<
      [{ onAvatarSwapped: (id: string) => void; avatarOpacity: number }]
    >;
  }

  let { performer, performerIndex, groundOffset, children }: Props = $props();

  const N = 36;
  const FADE_OUT_S = 0.25;
  const FADE_IN_S = 0.25;
  const MAX_HOLD_S = 4;

  type Phase = "idle" | "out" | "hold" | "in";
  let phase = $state<Phase>("idle");
  let elapsed = $state(0);
  let prevAvatarId = $state(performer.avatarModelId);
  let modelReady = $state(false);
  let avatarOpacity = $state(1);

  let wrapperGroup = $state<Group | undefined>(undefined);

  function handleAvatarSwapped(_id: string) {
    modelReady = true;
  }

  // The first rig parses the active avatar into the package's shared cache.
  // New performers can then clone the intended body without ever showing the
  // procedural fallback as an intermediate frame.
  onMount(() => {
    void prepareAvatar(performer.avatarModelId).catch(() => {});
  });

  // ── Particles ──
  const pos: Vector3[] = [];
  const vel: Vector3[] = [];
  const life = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    pos.push(new Vector3());
    vel.push(new Vector3());
  }

  const geo = new SphereGeometry(0.03, 6, 6);
  const performerColor = $derived(getPerformerColor(performerIndex));
  const mat = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  let instMesh = $state<InstancedMesh | undefined>(undefined);
  let particlesActive = $state(false);
  const m4 = new Matrix4();
  const v3 = new Vector3();

  function spawnParticles() {
    particlesActive = true;
    const cx = performer.position.x;
    const cy = groundOffset + 0.8;
    const cz = performer.position.z;
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.5 + Math.random() * 2.5;
      pos[i]!.set(cx, cy, cz);
      vel[i]!.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed * 0.6 + 1.0,
        Math.cos(phi) * speed
      );
      life[i] = 1.0;
    }
  }

  function easeOut(t: number) {
    return 1 - (1 - t) ** 2;
  }

  $effect(() => {
    const id = performer.avatarModelId;
    if (id !== prevAvatarId && phase === "idle") {
      modelReady = false;
      phase = "out";
      elapsed = 0;
      prevAvatarId = id;
    }
  });

  $effect(() => {
    mat.color.set(performerColor);
  });

  function tickParticles(delta: number, decayRate: number, gravity: number) {
    if (!instMesh) return;
    for (let i = 0; i < N; i++) {
      life[i]! -= delta * decayRate;
      const p = pos[i]!;
      const v = vel[i]!;
      p.addScaledVector(v, delta);
      v.y -= delta * gravity;
      const l = Math.max(0, life[i]!);
      m4.makeTranslation(p.x, p.y, p.z);
      m4.scale(v3.setScalar(l * 0.8));
      instMesh.setMatrixAt(i, m4);
    }
    instMesh.instanceMatrix.needsUpdate = true;
  }

  useTask((delta) => {
    // Drain leftover particles in idle
    if (phase === "idle") {
      if (instMesh?.visible) {
        let alive = false;
        for (let i = 0; i < N; i++) {
          if (life[i]! > 0) {
            alive = true;
            life[i]! -= delta * 3;
            pos[i]!.addScaledVector(vel[i]!, delta);
            vel[i]!.y -= delta * 4;
            const s = Math.max(0, life[i]!);
            m4.makeTranslation(pos[i]!.x, pos[i]!.y, pos[i]!.z);
            m4.scale(v3.setScalar(s));
            instMesh.setMatrixAt(i, m4);
          } else {
            m4.makeScale(0, 0, 0);
            instMesh.setMatrixAt(i, m4);
          }
        }
        instMesh.instanceMatrix.needsUpdate = true;
        if (!alive) {
          instMesh.visible = false;
          particlesActive = false;
        }
      }
      return;
    }

    elapsed += delta;
    const g = wrapperGroup;

    if (MODE === "fade") {
      // ── FADE MODE: opacity only, props unaffected ──
      if (phase === "out") {
        const t = Math.min(elapsed / FADE_OUT_S, 1);
        avatarOpacity = 1 - t;
        if (t >= 1) {
          avatarOpacity = 0;
          if (g) g.visible = false;
          phase = "hold";
          elapsed = 0;
          spawnParticles();
          if (instMesh) instMesh.visible = true;
        }
      } else if (phase === "hold") {
        avatarOpacity = 0;
        if (g) g.visible = false;
        tickParticles(delta, 2.5, 3);
        if (modelReady || elapsed >= MAX_HOLD_S) {
          if (g) g.visible = true;
          phase = "in";
          elapsed = 0;
        }
      } else if (phase === "in") {
        const t = Math.min(elapsed / FADE_IN_S, 1);
        avatarOpacity = t;
        tickParticles(delta, 1.5, 2);
        if (t >= 1) {
          avatarOpacity = 1;
          phase = "idle";
        }
      }
    } else {
      // ── POP MODE: instant hide, particles, instant show ──
      if (phase === "out") {
        // Instant hide
        if (g) g.visible = false;
        spawnParticles();
        if (instMesh) instMesh.visible = true;
        phase = "hold";
        elapsed = 0;
      } else if (phase === "hold") {
        if (g) g.visible = false;
        tickParticles(delta, 2.5, 3);
        if (modelReady || elapsed >= MAX_HOLD_S) {
          if (g) g.visible = true;
          avatarOpacity = 1;
          phase = "idle";
        }
      }
    }
  });
</script>

<T.Group bind:ref={wrapperGroup}>
  {@render children({ onAvatarSwapped: handleAvatarSwapped, avatarOpacity })}
</T.Group>

{#if phase !== "idle" || particlesActive}
  <T.InstancedMesh
    bind:ref={instMesh}
    args={[geo, mat, N]}
    frustumCulled={false}
    visible={false}
  />
{/if}
