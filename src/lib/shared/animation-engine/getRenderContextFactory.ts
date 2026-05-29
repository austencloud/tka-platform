import { RenderContextFactory } from "./services/render-context-factory";

let instance: RenderContextFactory | null = null;
export function getRenderContextFactory(): RenderContextFactory {
  return (instance ??= new RenderContextFactory());
}
