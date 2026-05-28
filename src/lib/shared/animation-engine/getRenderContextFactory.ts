import { RenderContextFactory } from "./services/implementations/RenderContextFactory";

let instance: RenderContextFactory | null = null;
export function getRenderContextFactory(): RenderContextFactory {
  return (instance ??= new RenderContextFactory());
}
