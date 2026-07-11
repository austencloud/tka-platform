<!--
  DeckTurntableCard — the card object itself, rendered INSIDE a Threlte <Canvas>
  (so it can call useThrelte). A thin rounded-box card body (real thickness +
  bevel + back = reads as an object, not a decal) with the REAL printed front
  art on a plane across its front face. The art comes through the exact same
  print pipeline the fan uses (renderCoverFront → object URL → THREE texture),
  cover-mapped to the 5:7 cut-card frame so what spins is what prints.

  Image-based lighting (a cheap RoomEnvironment PMREM, same trick as OceanScene)
  activates the MeshPhysicalMaterial clearcoat/iridescence — without it the
  material is flat. Rotation is driven by the parent's springs (rotY/rotX
  props); an $effect on them calls invalidate() so on-demand rendering redraws
  while the card moves and idles to zero when it settles.
-->
<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import {
    TextureLoader,
    SRGBColorSpace,
    PMREMGenerator,
    Texture,
    Group,
  } from "three";
  import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
  import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
  import { renderCoverFront } from "../services/cover-front-renderer";
  import { bakedCoverUrl } from "../domain/shop-prop-options";
  import type { CoverCard } from "../domain/models/product";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  interface Props {
    card: CoverCard | null;
    deckId?: string;
    deckName?: string;
    propType: PropType;
    /** Yaw target (rad) — primary spin, set by the parent's drag/flick. */
    targetYaw: number;
    /** Pitch target (rad) — the foil-catch tilt, self-rights to 0. */
    targetPitch: number;
    /** Iridescence strength 0–1 (foil). Off until Step 3. */
    foil?: number;
  }
  let {
    card,
    deckId,
    deckName,
    propType,
    targetYaw,
    targetPitch,
    foil = 0,
  }: Props = $props();

  // This project's resolved ThrelteContext type predates the on-demand
  // `invalidate` method (here `scene`/`renderer` are CurrentWritable), but the
  // runtime context has it (scheduler fragment). Pull it via a narrow cast, the
  // same way ScenePostProcessing casts the context to reach untyped members.
  const ctx = useThrelte();
  const { scene, renderer } = ctx;
  const invalidate = (ctx as unknown as { invalidate: () => void }).invalidate;

  // Card geometry: poker 5:7, thin depth, small corner radius. Body is the
  // stock (thickness + edge + back); the front art rides a plane on the +z face.
  const W = 2.0;
  const H = 2.8;
  const D = 0.05;
  const R = 0.06;
  const bodyGeo = new RoundedBoxGeometry(W, H, D, 5, R);

  let frontTex = $state<Texture | null>(null);
  let texKey = "";

  // Baked covers (the fan's clean cut card) live on Firebase Storage. A remote
  // URL can't upload straight into WebGL, but CORS is configured, so fetch it as
  // a blob → same-origin object URL → clean texture, exact parity with the fan.
  // Cached per remote URL for the session (the fan already warmed the HTTP
  // cache, so this hits cache and stays inside the retexture budget).
  const bakedBlobCache = new Map<string, Promise<string>>();
  function bakedBlobUrl(remoteUrl: string): Promise<string> {
    let p = bakedBlobCache.get(remoteUrl);
    if (!p) {
      p = fetch(remoteUrl, { mode: "cors" })
        .then((r) => {
          if (!r.ok) throw new Error(`baked cover ${r.status}`);
          return r.blob();
        })
        .then((b) => URL.createObjectURL(b));
      bakedBlobCache.set(remoteUrl, p);
      p.catch(() => bakedBlobCache.delete(remoteUrl));
    }
    return p;
  }

  // Map the card art onto the 5:7 front face exactly like DeckFanCover's
  // `object-fit: cover` — aspect-fit into the cut-card frame, centered. The
  // MPC stripe border is part of the printed card, so it is kept, not cropped.
  function applyUv(tex: Texture) {
    const img = tex.image as
      | { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
      | undefined;
    const iw = img?.naturalWidth || img?.width || 0;
    const ih = img?.naturalHeight || img?.height || 0;
    if (!iw || !ih) return;
    const target = W / H;
    const src = iw / ih;
    if (src > target) {
      tex.repeat.set(target / src, 1);
      tex.offset.set((1 - target / src) / 2, 0);
    } else {
      tex.repeat.set(1, src / target);
      tex.offset.set(0, (1 - src / target) / 2);
    }
    tex.needsUpdate = true;
  }

  // Retexture on card / prop change (mirrors DeckFanCover: prefer the clean
  // baked cover, fall back to the print pipeline, which owns the cache + lane
  // cap + seed gate so a warm swap is the instant path).
  $effect(() => {
    const c = card;
    const p = propType;
    if (!c) return;
    const key = `${c.sequence?.id ?? c.sequence?.word ?? "?"}|${p}`;
    if (key === texKey) return;
    texKey = key;
    let cancelled = false;
    const baked = bakedCoverUrl(c, p);
    (async () => {
      const url = baked
        ? await bakedBlobUrl(baked)
        : await renderCoverFront(c, { deckId, deckName, propType: p });
      const tex = await new TextureLoader().loadAsync(url);
      tex.colorSpace = SRGBColorSpace;
      const maxAniso = renderer.current?.capabilities.getMaxAnisotropy?.() ?? 4;
      tex.anisotropy = Math.min(8, maxAniso);
      applyUv(tex);
      return tex;
    })()
      .then((tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        frontTex?.dispose();
        frontTex = tex;
        invalidate();
      })
      .catch((e) =>
        console.warn("[DeckTurntableCard] texture load failed:", e)
      );
    return () => {
      cancelled = true;
    };
  });

  // Image-based lighting: a cheap RoomEnvironment PMREM (same as OceanScene)
  // so clearcoat/iridescence have something to reflect. Without it the card
  // reads flat/plasticky (the "cheap tell" pitfall).
  $effect(() => {
    const r = renderer.current;
    const s = scene.current;
    if (!r || !s) return;
    const pmrem = new PMREMGenerator(r);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environment = envTex;
    pmrem.dispose();
    invalidate();
    return () => {
      if (s.environment === envTex) s.environment = null;
      envTex.dispose();
    };
  });

  // ── rotation: a spring integrator driven by Threlte's own frame loop ──
  // Driving rotation from Svelte-Spring's independent rAF desyncs with the
  // on-demand renderer (the settle frame can fail to draw, freezing a stale
  // pose). Instead we integrate the spring inside useTask and self-sustain the
  // loop with invalidate() while moving — so the final frame always renders and
  // the canvas idles to zero the instant it settles. curYaw starts behind the
  // rest angle → the mount does one 3/4-turn intro that signals "drag me".
  let group = $state<Group>();
  let curYaw = -Math.PI * 1.4;
  let curPitch = 0.12;
  let velYaw = 0;
  let velPitch = 0;
  const STIFF = 130;
  const DAMP = 22; // near-critical: 2·√STIFF ≈ 22.8 → minimal overshoot
  const EPS = 1e-3;

  function integrate(cur: number, vel: number, target: number, h: number): [number, number] {
    const a = -STIFF * (cur - target) - DAMP * vel;
    const v = vel + a * h;
    return [cur + v * h, v];
  }

  useTask((delta) => {
    const h = Math.min(delta, 1 / 30); // clamp: a backgrounded tab's huge dt would explode the spring
    [curYaw, velYaw] = integrate(curYaw, velYaw, targetYaw, h);
    [curPitch, velPitch] = integrate(curPitch, velPitch, targetPitch, h);
    if (group) {
      group.rotation.y = curYaw;
      group.rotation.x = curPitch;
    }
    const moving =
      Math.abs(velYaw) > EPS ||
      Math.abs(curYaw - targetYaw) > EPS ||
      Math.abs(velPitch) > EPS ||
      Math.abs(curPitch - targetPitch) > EPS;
    if (moving) invalidate(); // keep the on-demand loop alive until settled
  });

  // ── foil = glossy lamination sweep (NOT thin-film rainbow) ──
  // Eyes-on proved the spec's iridescence-only plan invisible: the MPC card face
  // is ~85% white and thin-film hue-travel doesn't read on white even at max.
  // What a real laminated card actually does is catch a bright specular band that
  // sweeps as it tilts — so `foil` drives a clearcoat gloss + env-reflection boost
  // (the visible premium effect), keeping a faint iridescence for the spectral
  // edge Austen asked for (it only tints the dark glyph/arrow regions).
  const glossClearcoat = $derived(0.35 + foil * 0.6); // 0.35 → 0.95 laminate coat
  const glossClearcoatRough = $derived(0.2 - foil * 0.17); // 0.20 → 0.03 tight, bright hotspot
  const glossEnv = $derived(0.9 + foil * 1.7); // 0.9 → 2.6 punchier room-reflection streak
  const glossIridescence = $derived(foil * 0.35); // faint spectral tint, not rainbow-wash

  // Kick the loop whenever a target changes (drag/flick) or foil updates.
  $effect(() => {
    targetYaw;
    targetPitch;
    foil;
    invalidate();
  });

  $effect(() => () => {
    bodyGeo.dispose();
    frontTex?.dispose();
  });
</script>

<T.Group bind:ref={group}>
  <!-- Card stock: thickness + rounded edge + the back face when spun. -->
  <T.Mesh>
    <T is={bodyGeo} />
    <T.MeshPhysicalMaterial
      color="#161228"
      roughness={0.55}
      metalness={0}
      clearcoat={0.25}
      clearcoatRoughness={0.35}
      envMapIntensity={0.8}
    />
  </T.Mesh>

  <!-- Front art plane, a hair proud of the front face. FrontSide (default) so
       spinning past 90° reveals the stock back, not mirrored art. -->
  {#if frontTex}
    <T.Mesh position.z={D / 2 + 0.002}>
      <T.PlaneGeometry args={[W - R * 0.5, H - R * 0.5]} />
      <T.MeshPhysicalMaterial
        map={frontTex}
        roughness={0.35}
        metalness={0}
        clearcoat={glossClearcoat}
        clearcoatRoughness={glossClearcoatRough}
        iridescence={glossIridescence}
        iridescenceIOR={1.3}
        envMapIntensity={glossEnv}
      />
    </T.Mesh>
  {/if}
</T.Group>
