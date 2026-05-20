// src/lib/shared/3d/scene-composer/registry.ts

import type { SceneComposerPlugin } from "./types";

export class SceneComposerRegistry {
	private plugins = new Map<string, SceneComposerPlugin>();

	register(plugin: SceneComposerPlugin): void {
		if (this.plugins.has(plugin.sceneId)) {
			throw new Error(
				`Scene composer plugin already registered: ${plugin.sceneId}`
			);
		}
		this.plugins.set(plugin.sceneId, plugin);
	}

	get(sceneId: string): SceneComposerPlugin | undefined {
		return this.plugins.get(sceneId);
	}

	has(sceneId: string): boolean {
		return this.plugins.has(sceneId);
	}

	list(): SceneComposerPlugin[] {
		return [...this.plugins.values()];
	}

	composableSceneIds(): string[] {
		return [...this.plugins.keys()];
	}
}

export const composerRegistry = new SceneComposerRegistry();
