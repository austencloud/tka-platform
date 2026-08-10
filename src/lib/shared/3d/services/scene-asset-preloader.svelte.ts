import { Cache } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Enables Three.js's built-in file cache so GLTFLoader responses persist
// across loader instances. The preloader populates this; subsequent
// useGltf() calls in ForestScene/WinterScene get cache hits and skip
// the network entirely.
Cache.enabled = true;

import { R2_CDN } from "../constants/r2-cdn";

const FOREST_URLS = [
	`${R2_CDN}/models/forest/Tree_1_A_Color1.gltf`,
	`${R2_CDN}/models/forest/Tree_2_A_Color1.gltf`,
	`${R2_CDN}/models/forest/Tree_3_A_Color1.gltf`,
	`${R2_CDN}/models/forest/Rock_1_A_Color1.gltf`,
	`${R2_CDN}/models/forest/Rock_1_B_Color1.gltf`,
	`${R2_CDN}/models/forest/Bush_1_A_Color1.gltf`,
	`${R2_CDN}/models/forest/Bush_2_A_Color1.gltf`,
];

const CAMPING_URLS = [
	"/models/camping/campfire-pit.glb",
	"/models/camping/tree-log.glb",
	"/models/camping/tree-log-small.glb",
];

let _started = false;
let _loaded = $state(0);
let _total = $state(0);

const _loader =
	typeof window !== "undefined" ? new GLTFLoader() : null;

function loadOne(url: string): void {
	_loader?.load(
		url,
		() => {
			_loaded++;
		},
		undefined,
		() => {
			_loaded++;
		},
	);
}

export function startSceneAssetPreload(): void {
	if (_started || !_loader) return;
	_started = true;

	const urls = [...FOREST_URLS, ...CAMPING_URLS];
	_total = urls.length;
	_loaded = 0;

	const go = () => {
		for (const url of urls) {
			loadOne(url);
		}
	};

	if (typeof requestIdleCallback === "function") {
		requestIdleCallback(go);
	} else {
		setTimeout(go, 1000);
	}
}

export const sceneAssetPreload = {
	get loaded() {
		return _loaded;
	},
	get total() {
		return _total;
	},
	get progress() {
		return _total === 0 ? 0 : _loaded / _total;
	},
	get done() {
		return _total > 0 && _loaded >= _total;
	},
	get started() {
		return _started;
	},
};
