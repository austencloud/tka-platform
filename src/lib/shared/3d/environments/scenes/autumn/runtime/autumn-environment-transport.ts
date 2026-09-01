import { LoadingManager } from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AutumnEnvironmentProgress } from "./autumn-environment-request";

interface AbortableLoadingManager {
  abort(): unknown;
}

interface AsyncGltfLoader {
  loadAsync(
    url: string,
    onProgress: (event: ProgressEvent) => void
  ): Promise<GLTF>;
}

interface AutumnEnvironmentTransportDependencies {
  createManager?: () => AbortableLoadingManager;
  createLoader?: (manager: AbortableLoadingManager) => AsyncGltfLoader;
}

/**
 * Creates an Autumn-only loader transport. Its dedicated LoadingManager lets a
 * retry abort the 18 MB fetch without cancelling unrelated viewer assets.
 */
export function createAutumnEnvironmentTransport(
  configure: (loader: GLTFLoader) => void,
  dependencies: AutumnEnvironmentTransportDependencies = {}
): (
  url: string,
  onProgress: (progress: AutumnEnvironmentProgress) => void,
  signal: AbortSignal
) => Promise<GLTF> {
  return (url, onProgress, signal) => {
    if (signal.aborted) {
      return Promise.reject(
        signal.reason ?? new DOMException("Aborted", "AbortError")
      );
    }

    const manager = dependencies.createManager?.() ?? new LoadingManager();
    const loader =
      dependencies.createLoader?.(manager) ??
      new GLTFLoader(manager as LoadingManager);
    if (loader instanceof GLTFLoader) configure(loader);

    const abort = () => manager.abort();
    signal.addEventListener("abort", abort, { once: true });
    return loader
      .loadAsync(url, (event) =>
        onProgress({
          loaded: event.loaded,
          total: event.total > 0 ? event.total : undefined,
        })
      )
      .finally(() => signal.removeEventListener("abort", abort));
  };
}
