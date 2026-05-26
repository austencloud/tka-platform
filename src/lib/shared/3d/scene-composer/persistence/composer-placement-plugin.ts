import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import type { Plugin } from "vite";

function sceneIdToDir(sceneId: string): string {
	const map: Record<string, string> = {
		"forest-autumn": "autumn",
		"forest-firefly": "forest",
		winter: "winter",
		"cosmic-night": "cosmic",
		"cosmic-aurora": "cosmic",
		"ocean-abyss": "ocean",
		"ocean-reef": "ocean",
		"ocean-mystical": "ocean",
		"ocean-cinematic": "ocean",
	};
	return map[sceneId] ?? sceneId;
}

export function composerPlacementPlugin(): Plugin {
	return {
		name: "composer-placement-writer",
		configureServer(server) {
			server.middlewares.use("/__composer-placements", (req, res) => {
				if (req.method !== "POST") {
					res.statusCode = 405;
					res.end("Method not allowed");
					return;
				}

				const sceneId = (req.url ?? "").replace(/^\//, "");
				if (!sceneId) {
					res.statusCode = 400;
					res.end("Missing sceneId in URL");
					return;
				}

				let body = "";
				req.on("data", (chunk: string) => {
					body += chunk;
				});
				req.on("end", () => {
					try {
						const dir = sceneIdToDir(sceneId);
						const outPath = resolve(
							process.cwd(),
							"src/lib/shared/3d/environments/scenes",
							dir,
							"placements.ts",
						);
						mkdirSync(dirname(outPath), { recursive: true });
						writeFileSync(outPath, body, "utf-8");
						res.statusCode = 200;
						res.end("OK");
					} catch (err) {
						console.error("[composer-placement-plugin] Write failed:", err);
						res.statusCode = 500;
						res.end("Write failed");
					}
				});
			});
		},
	};
}
