# Desktop Offline Bundle

The Tauri desktop build ships everything a demo needs on disk: the web shell,
every 3D scene and character the app loads, the decoder runtimes, the deck
sequences, and the public gallery index. Nothing waits on Pages, R2, or
Firestore when the machine has no network.

## What is bundled

| Resource | Source | Bundle location |
|---|---|---|
| Static 3D assets (`/models`, `/textures`, `/animations`, `/environments`, `/draco`, `/basis`) | `static/` | `assets/<path>` |
| R2 assets (`https://assets.tkaflowarts.com/...`): characters, thumbnails, forest, camping, ocean flora | downloaded at build time | `assets/r2/<path>` |
| Deck sequences | `data/sequences/` | `data/sequences/` |
| Public gallery index (`publicSequences`, full documents) | Firestore export | `data/gallery/public-sequences.json` |

`assets/manifest.json` lists every bundled file with its byte size.

## How assets are found

`scripts/desktop-asset-bundle.mjs` scans `src/` for literal asset paths and
`${R2_CDN}/...` templates, skipping test, lab, promo, and scene-composer
sources. Characters come from the scene-3d registry
(`AVATAR_DEFINITIONS`); `.gltf` files pull their buffer and image siblings.
Two static directories are bundled whole because the scene package builds
their paths at runtime: `models/props/` (the prop model registry) and
`animations/` (locomotion, terminal-stop, turn, and idle packs). Build inputs
such as `*_raw.glb`, `candidates/`, and `buugeng-raw/` are excluded.
A path the scan cannot resolve is reported as a warning and skipped; the
bundle is never silently short of a required scene because
`verify-desktop-assets.mjs` checks the scene-boot manifest and the character
registry against the manifest before the frontend build runs.

## How the app reads them

`src-tauri/src/asset_protocol.rs` registers the `tka-assets` URI scheme and
serves `resource_dir()/assets/<path>` with CORS and immutable cache headers.
On the web side, `desktop-asset-runtime.ts` fetches the manifest at boot and
installs a `DefaultLoadingManager.setURLModifier` resolver: any three.js /
Threlte / scene-3d loader that asks for a bundled path gets the local scheme
URL; everything else passes through unchanged, so a missing file degrades to
the ordinary network fetch. The autumn transport's private manager delegates
to the default one; `characterThumbnailUrl` resolves `<img>` URLs by hand.

The gallery bundle is seeded into the Dexie `galleryCache` on first launch
(`desktop-data-seeder.ts`), keyed by export timestamp, and left alone when
the app has synced from Firestore more recently. `public-sequences-loader.ts`
reads full sequences from that cache first on desktop and waits at most 2.5 s
on Firestore before falling back to it.

## Commands

```bash
pnpm export:gallery-bundle
pnpm collect:desktop-assets
pnpm verify:desktop-assets
pnpm fetch:webview2-runtime
pnpm tauri:build
```

`tauri-build-frontend.cjs` runs the verify and collect steps itself, so a
plain `pnpm tauri:build` produces a complete installer once a gallery export
exists. Without Firebase credentials the gallery verify warns locally (fails
in CI) and the gallery syncs on first online launch instead.
`desktop-build.yml` exports the gallery in its prepare job and uploads it as
the `desktop-gallery-bundle` artifact.

## Windows WebView2 runtime

The Windows installer ships its own browser engine
(`bundle.windows.webviewInstallMode` is `fixedRuntime`, pointing at
`src-tauri/webview2-runtime/`). `scripts/fetch-webview2-runtime.mjs`
downloads the pinned Fixed Version cab from Microsoft and expands it there;
`desktop-build.yml` runs it on the Windows job. The directory is gitignored.
Set `WEBVIEW2_RUNTIME_SOURCE=<dir>` to copy an already extracted runtime
instead of downloading.

The Evergreen bootstrapper was dropped because it cannot repair a machine
whose runtime is frozen by EdgeUpdate policy. Austen's demo machine is pinned
at WebView2 122.0.2365.106 (February 2024), where the renderer access-violates
while rendering the Create module, and the bootstrapper needs a network
connection at install time anyway. Shipping the engine costs roughly 560 MB on
disk but makes the build independent of both.

## Size

Roughly 253 files and 363 MB of assets (the ch26 character alone is 60 MB)
plus 6 MB of gallery JSON and about 560 MB of WebView2 runtime. Expect an
installer around 550 MB.
