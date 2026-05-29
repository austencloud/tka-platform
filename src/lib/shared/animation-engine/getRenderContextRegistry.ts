import { RenderContextRegistry } from "./services/render-context-registry";

let instance: RenderContextRegistry | null = null;

export function getRenderContextRegistry(): RenderContextRegistry {
  return (instance ??= new RenderContextRegistry());
}
