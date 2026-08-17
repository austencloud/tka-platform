<!--
  One exhibit console: a lectern with three or four buttons on a tilted face.

  It is a real object at a real height, in the form it will be in when it is
  used. There is no zoom, no editor mode and no screen-locked panel — the
  camera is never taken from the visitor. The console's only approach behaviour
  is that its face wakes: dark from across the room, live at arm's length.
  Nothing else in the room dims to make room for it.

  The button count is the design, not a limit worked around. Four large buttons
  readable at arm's length is the whole control tier; any set that needed a
  scrollable list would have stopped being a thing in a room.

  Spec: docs/superpowers/specs/2026-08-16-museum-pedestal-and-console-design.md
-->
<script lang="ts">
  import { T } from "@threlte/core";
  import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
  import {
    CONSOLE_BUTTON_D,
    CONSOLE_FACE_TILT,
    VERB_LABELS,
    type ConsoleVerb,
  } from "$lib/features/museum/domain/exhibit-console";

  interface Props {
    /** Centre of the console in scene space, at its BASE. */
    position: [number, number, number];
    height: number;
    footprint: { x: number; z: number };
    /** The verbs this console offers, in press order. Three, or four on a hybrid. */
    verbs: ConsoleVerb[];
    /** Which of them currently hold the performer away from its bound state. */
    engaged: Record<string, boolean>;
    /** 0 across the room, 1 at arm's length. */
    awake: number;
    /** True when there is something for the restore handle to undo. */
    modified: boolean;
    /** Wing colour. */
    tint: string;
    bodyColor?: string;
  }

  const {
    position,
    height,
    footprint,
    verbs,
    engaged,
    awake,
    modified,
    tint,
    bodyColor = "#2b3a41",
  }: Props = $props();

  /** Along-the-slope length of the control face. */
  const FACE_W = $derived(footprint.x - 0.06);
  const FACE_H = $derived(footprint.z / Math.cos(CONSOLE_FACE_TILT) - 0.04);
  const FACE_T = 0.035;

  /** Where each control sits on the face, in face-local units of its own size. */
  const BUTTON_V = 0.34;
  const LABEL_V = 0.62;
  const RESTORE_V = 0.86;

  const faceY = $derived(height - (footprint.z / 2) * Math.tan(CONSOLE_FACE_TILT));

  function localX(index: number, count: number, width: number): number {
    return ((index + 0.5) / count - 0.5) * width;
  }
  const localY = (v: number, h: number) => h / 2 - v * h;

  /**
   * The face's own graphics.
   *
   * Painted rather than modelled because a label is the one thing on this
   * object that has to be read, and a graybox with unlabelled buttons tests
   * nothing about whether four verbs make the room better.
   */
  function buildFaceTexture(labels: string[]): CanvasTexture | null {
    if (typeof document === "undefined") return null;
    const w = 512;
    const h = Math.round((w * FACE_H) / FACE_W);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#0b1418";
    ctx.fillRect(0, 0, w, h);

    // A recess behind each button, so an unlit console still reads as an
    // object with controls rather than as a blank slab.
    ctx.fillStyle = "#050a0c";
    labels.forEach((_, index) => {
      const cx = ((index + 0.5) / labels.length) * w;
      ctx.beginPath();
      ctx.arc(cx, BUTTON_V * h, (h * 0.2), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = tint;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(h * 0.115)}px system-ui, sans-serif`;
    labels.forEach((label, index) => {
      const cx = ((index + 0.5) / labels.length) * w;
      ctx.fillText(label.toUpperCase(), cx, LABEL_V * h);
    });

    ctx.font = `500 ${Math.round(h * 0.095)}px system-ui, sans-serif`;
    ctx.fillStyle = "#6d8a93";
    ctx.fillText("RESTORE", w / 2, RESTORE_V * h);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  const faceTexture = $derived(buildFaceTexture(verbs.map((v) => VERB_LABELS[v])));

  $effect(() => {
    const texture = faceTexture;
    return () => texture?.dispose();
  });

  /** Body stops short of the face so the slab reads as a separate plate. */
  const bodyH = $derived(faceY - 0.02);
</script>

<T.Group position={[position[0], position[1], position[2]]}>
  <!-- Body. A plain lectern column: this object is furniture, not a machine. -->
  <T.Mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
    <T.BoxGeometry args={[footprint.x, bodyH, footprint.z]} />
    <T.MeshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.08} />
  </T.Mesh>

  <!-- The control face, tilted back toward the visitor who stands south of it.
       Its emissive strength IS the approach behaviour. -->
  <T.Group
    position={[0, faceY, 0]}
    rotation={[CONSOLE_FACE_TILT - Math.PI / 2, 0, 0]}
  >
    <T.Mesh castShadow>
      <T.BoxGeometry args={[FACE_W, FACE_H, FACE_T]} />
      <T.MeshStandardMaterial
        map={faceTexture}
        color="#ffffff"
        emissiveMap={faceTexture}
        emissive={tint}
        emissiveIntensity={0.12 + awake * 1.35}
        roughness={0.42}
        metalness={0.1}
      />
    </T.Mesh>

    {#each verbs as verb, index (verb)}
      <!-- Engaged buttons sit pressed in. The state of a control is a property
           of the control, so it needs no separate indicator lamp. -->
      <T.Mesh
        position={[
          localX(index, verbs.length, FACE_W),
          localY(BUTTON_V, FACE_H),
          FACE_T / 2 + (engaged[verb] ? 0.004 : 0.017),
        ]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <T.CylinderGeometry
          args={[CONSOLE_BUTTON_D / 2, CONSOLE_BUTTON_D / 2, 0.03, 24]}
        />
        <T.MeshStandardMaterial
          color={engaged[verb] ? tint : "#243238"}
          emissive={tint}
          emissiveIntensity={(engaged[verb] ? 0.9 : 0.18) * (0.15 + awake)}
          roughness={0.38}
          metalness={0.15}
        />
      </T.Mesh>
    {/each}

    <!-- Restore: one handle, not a menu. Dull with nothing to undo. -->
    <T.Mesh
      position={[0, localY(RESTORE_V, FACE_H) + FACE_H * 0.1, FACE_T / 2 + 0.012]}
      castShadow
    >
      <T.BoxGeometry args={[FACE_W * 0.34, FACE_H * 0.075, 0.024]} />
      <T.MeshStandardMaterial
        color={modified ? tint : "#1b262b"}
        emissive={tint}
        emissiveIntensity={(modified ? 0.75 : 0.1) * (0.15 + awake)}
        roughness={0.4}
        metalness={0.18}
        side={DoubleSide}
      />
    </T.Mesh>
  </T.Group>
</T.Group>
