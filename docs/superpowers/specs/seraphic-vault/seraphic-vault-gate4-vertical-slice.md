# Seraphic Vault Gate 4 production slice

**Status:** Ready for human review

**Runtime:** `/test/celestial-scene?view=hero`

## Finished slice

Gate 4 proves the approved material and atmosphere around one complete distant
sanctuary, Broken Vigil, under the locked desktop hero camera. The slice
contains:

- the rebuilt main alabaster platform with cool mineral veining, restrained
  circular inlays, and a less chalky specular response;
- six weathered feather ribs with cool faces and warm edge light;
- Broken Vigil at the approved lower-left coordinate, including an irregular
  deck, two inlay arcs, a broken feather crest, a visible break face, and four
  fracture stones;
- one white-gold solar focus with a luminous core, two aureole rings, twelve
  rays, and a restrained god-ray fan;
- a dense, sunless cloud panorama backed by a slowly drifting procedural cloud
  layer;
- the Choir of Air audio state, including open, play, pause, volume, and mute
  controls.

The remaining three distant sanctuaries are intentionally absent from this
gate. Gate 5 integrates Twin Choir, Eroded Halo, and Cloud Crown after the
representative material, light, cloud, motion, and audio treatment is approved.

## Build ownership

| Responsibility                       | Owner                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Main platform and six feather ribs   | `scripts/build-celestial-environment.py`                                        |
| Broken Vigil production asset        | `scripts/build-seraphic-vault-production-slice.py`                              |
| Celestial runtime composition        | `src/lib/shared/3d/environments/scenes/CelestialScene.svelte`                   |
| Sanctuary loading and material grade | `src/lib/shared/3d/environments/scenes/celestial/CelestialSanctuaries.svelte`   |
| Cloud panorama                       | `src/lib/shared/3d/environments/scenes/celestial/CelestialCloudPanorama.svelte` |
| Solar treatment                      | `src/lib/shared/3d/environments/scenes/celestial/CelestialSun.svelte`           |
| Audio response                       | `src/lib/shared/3d/environments/scenes/celestial/celestial-audio.ts`            |

The celestial audio path extends the existing shared audio engine. It does not
create a second playback owner.

## Optimized assets

| Asset                                 |   Delivery size | SHA-256                                                            |
| ------------------------------------- | --------------: | ------------------------------------------------------------------ |
| `celestial-environment.glb`           | 3,028,348 bytes | `10677ca5d3c44bc32c9d0c53759c69b1d62fe0a22477c1c0075ade880b13bcd0` |
| `seraphic-vault-production-slice.glb` |   694,324 bytes | `8f8060f8dafe33bcaa2a7d116e006a6782c4b73ae81c2ecded0a049e10e0ae48` |
| `seraphic-cloud-panorama.webp`        |   128,278 bytes | `a368f908e0c3afb6a9a1e76931dcdc7d7067a20f4f7972fcdda8c836ccf1c5e3` |

Both GLBs use meshopt geometry compression, KTX2 textures, and mesh
quantization. The main environment also collapses the three mirrored feather
pairs into six GPU instances.

## Runtime evidence

- Desktop still: `./seraphic-vault-gate4-desktop.png`
- Motion and audio-state loop: `./seraphic-vault-gate4-interaction-capture.gif`
- Performance and console report: `./seraphic-vault-gate4-performance-report.json`
- Image-generation record: `./seraphic-vault-gate4-imagegen-prompt.md`

The registered Gate 4 judgment is the 1920 by 1080 desktop hero frame. The
seven-viewport sweep also found no broken layouts. Gate 5 remains responsible
for placing all four distant sanctuaries in every responsive camera.

## Approval question

Does this finished slice read as a weathered angelic sanctuary suspended inside
a deep cloud sea, with Broken Vigil as the lower-left secondary destination and
the aureole as the scene's only sun?
