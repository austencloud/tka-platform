import { PMREMGenerator, type Texture, type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const roomEnvironmentTextures = new WeakMap<WebGLRenderer, Texture>();

/**
 * Blur applied while prefiltering the room. Matches the value the ocean scene
 * shipped with, so every consumer reflects the same soft studio.
 */
const ROOM_ENVIRONMENT_SIGMA = 0.04;

/**
 * One prefiltered RoomEnvironment per renderer.
 *
 * three.js's built-in room is a neutral studio box: a few soft area lights and
 * grey walls. Prefiltering it once gives every physically based material an
 * environment to reflect, which is the difference between roughness and
 * metalness meaning something and a surface reading as flat paint under
 * direct lights alone. The texture is keyed by renderer because PMREM output
 * belongs to the context that produced it.
 */
export function getRoomEnvironmentTexture(renderer: WebGLRenderer): Texture {
  const existing = roomEnvironmentTextures.get(renderer);
  if (existing) return existing;

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(
    new RoomEnvironment(),
    ROOM_ENVIRONMENT_SIGMA
  ).texture;
  pmrem.dispose();
  roomEnvironmentTextures.set(renderer, texture);
  return texture;
}
