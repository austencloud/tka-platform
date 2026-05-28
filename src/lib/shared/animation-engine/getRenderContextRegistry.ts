import { RenderContextRegistry } from "./services/implementations/RenderContextRegistry";

let instance: RenderContextRegistry | null = null;

export function getRenderContextRegistry(): RenderContextRegistry {
  return (instance ??= new RenderContextRegistry());
}
