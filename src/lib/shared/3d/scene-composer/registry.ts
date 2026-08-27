
import type { SceneComposerPlugin } from "./types";

export class SceneComposerRegistry {
	private plugins = new Map<string, SceneComposerPlugin>();

	register(plugin: SceneComposerPlugin): void {
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
