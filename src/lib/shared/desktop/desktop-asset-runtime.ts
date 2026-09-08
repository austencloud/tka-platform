/**
 * Installs the offline asset bundle into the running desktop app.
 *
 * One rewrite seam covers every 3D loader: three.js `DefaultLoadingManager`
 * resolves URLs for every `GLTFLoader`, `TextureLoader`, `FBXLoader`,
 * `DRACOLoader` and `KTX2Loader` constructed without an explicit manager —
 * which is all of Threlte's `useGltf`/`useTexture`/`useDraco`/`useKtx2`, the
 * scene-3d package's character and animation loaders, and the product's own
 * loaders. A `fetch` wrapper covers the scene package's HEAD availability
 * probes and JSON sidecars, which never touch a loading manager. `<img>`
 * consumers call `resolveDesktopAssetUrl` directly.
 *
 * Must run before any 3D surface mounts; `+layout.svelte` awaits it during
 * boot. The manifest read is a local file fetch through the custom scheme and
 * costs single-digit milliseconds.
 */

import {
  DESKTOP_ASSET_SCHEME,
  createDesktopAssetResolver,
  createDesktopFetch,
} from "./desktop-asset-url";
import { isDesktop } from "./is-desktop";

interface DesktopAssetManifest {
  generatedAt: string;
  fileCount: number;
  totalBytes: number;
  files: Array<{ path: string; bytes: number }>;
}

let resolver: ((url: string) => string) | null = null;
let installing: Promise<boolean> | null = null;
let bundledPaths: ReadonlySet<string> = new Set();
let nativeFetch: typeof fetch | null = null;

/** Rewrite a runtime asset URL onto the local bundle; identity off desktop. */
export function resolveDesktopAssetUrl(url: string): string {
  return resolver ? resolver(url) : url;
}

export function isDesktopAssetBundled(bundlePath: string): boolean {
  return bundledPaths.has(bundlePath);
}

export function desktopAssetBundleSize(): number {
  return bundledPaths.size;
}

/**
 * Read the bundle manifest and hook the resolver into three.js. Resolves
 * `true` when the bundle is live, `false` on the web or when the desktop build
 * carries no bundle. Safe to call more than once.
 */
export function installDesktopAssetRuntime(): Promise<boolean> {
  if (!isDesktop()) return Promise.resolve(false);
  return (installing ??= install());
}

async function install(): Promise<boolean> {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  // `convertFileSrc` owns the per-platform origin shape:
  // `https://tka-assets.localhost/` on Windows, `tka-assets://localhost/` on macOS.
  const origin = convertFileSrc("", DESKTOP_ASSET_SCHEME).replace(/\/+$/, "");

  const response = await fetch(`${origin}/manifest.json`);
  if (!response.ok) {
    console.warn(
      `[Desktop] Asset bundle manifest unavailable (HTTP ${response.status}); assets load from the network.`
    );
    return false;
  }
  const manifest = (await response.json()) as DesktopAssetManifest;
  bundledPaths = new Set(manifest.files.map((file) => file.path));

  resolver = createDesktopAssetResolver({
    origin,
    has: (bundlePath) => bundledPaths.has(bundlePath),
    pageOrigin: location.origin,
  });

  const { DefaultLoadingManager } = await import("three");
  DefaultLoadingManager.setURLModifier(resolver);
  if (!nativeFetch) {
    nativeFetch = window.fetch.bind(window);
    window.fetch = createDesktopFetch(resolver, nativeFetch);
  }

  console.log(
    `[Desktop] Offline asset bundle live: ${manifest.fileCount} files, ${(
      manifest.totalBytes /
      (1024 * 1024)
    ).toFixed(0)} MB, served from ${origin}`
  );
  return true;
}

export function _resetDesktopAssetRuntimeForTests(): void {
  if (nativeFetch) window.fetch = nativeFetch;
  nativeFetch = null;
  resolver = null;
  installing = null;
  bundledPaths = new Set();
}
