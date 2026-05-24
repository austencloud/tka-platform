import type { DirectionalLight, PointLight } from "three";

let _light = $state<DirectionalLight | PointLight | null>(null);

export const godraysLightStore = {
  get light() {
    return _light;
  },
  set light(v: DirectionalLight | PointLight | null) {
    _light = v;
  },
};
