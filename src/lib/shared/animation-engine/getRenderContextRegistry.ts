/**
 * getRenderContextRegistry
 *
 * Singleton getter for the RenderContextRegistry.
 * All code that needs to register or look up a RenderContext should call this.
 */

import { RenderContextRegistry } from "./services/implementations/RenderContextRegistry";

let instance: RenderContextRegistry | null = null;

export function getRenderContextRegistry(): RenderContextRegistry {
  return (instance ??= new RenderContextRegistry());
}
