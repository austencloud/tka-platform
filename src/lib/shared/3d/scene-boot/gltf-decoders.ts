import { useDraco, useKtx2, useMeshopt } from "@threlte/extras";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Attach the geometry decoders every optimized GLB in this app may need. The
 * threlte hooks cache one decoder instance per path, so every loader that goes
 * through here shares the same Draco worker pool rather than spinning up
 * another one. A model that uses no compression is unaffected.
 *
 * Safe to call from anywhere — neither hook touches component context.
 */
export function attachGltfDecoders(loader: GLTFLoader): void {
  loader.setDRACOLoader(useDraco("/draco/"));
  loader.setMeshoptDecoder(useMeshopt());
}

/**
 * Attach the compressed-texture decoder. Separate from the geometry decoders
 * because the KTX2 loader has to ask the live renderer which texture formats
 * the GPU supports, so this one may only be called while a component that sits
 * inside the Threlte canvas is initializing.
 */
export function attachKtx2Decoder(loader: GLTFLoader): void {
  loader.setKTX2Loader(useKtx2("/basis/"));
}
