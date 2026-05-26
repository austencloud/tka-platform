// generate-ocean-placements.cjs
// Generates realistic reef placements for the ocean scene and writes placements.ts
// Run: node scripts/generate-ocean-placements.cjs

const fs = require("fs");
const path = require("path");

// ── Seeded RNG (mulberry32, same as poisson-disc.ts) ───────────────────────
function mulberry32(seed) {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ── Placement grid for collision detection ─────────────────────────────────
class PlacementGrid {
	constructor(cellSize = 2.0) {
		this.cells = new Map();
		this.cellSize = cellSize;
	}
	_key(cx, cz) {
		return `${cx},${cz}`;
	}
	register(x, z, radius) {
		const cx = Math.floor(x / this.cellSize);
		const cz = Math.floor(z / this.cellSize);
		const k = this._key(cx, cz);
		if (!this.cells.has(k)) this.cells.set(k, []);
		this.cells.get(k).push({ x, z, r: radius });
	}
	isClear(x, z, radius) {
		const cx = Math.floor(x / this.cellSize);
		const cz = Math.floor(z / this.cellSize);
		for (let dx = -1; dx <= 1; dx++) {
			for (let dz = -1; dz <= 1; dz++) {
				const entries = this.cells.get(this._key(cx + dx, cz + dz));
				if (!entries) continue;
				for (const e of entries) {
					const ddx = x - e.x;
					const ddz = z - e.z;
					const minDist = radius + e.r;
					if (ddx * ddx + ddz * ddz < minDist * minDist) return false;
				}
			}
		}
		return true;
	}
}

// ── Poisson disc sampling in annular region ────────────────────────────────
function poissonDiscSample(innerRadius, outerRadius, minDistance, count, rng) {
	const samples = [];
	const maxAttempts = count * 50;
	for (let attempt = 0; attempt < maxAttempts && samples.length < count; attempt++) {
		const angle = rng() * Math.PI * 2;
		const r = innerRadius + rng() * (outerRadius - innerRadius);
		const x = Math.cos(angle) * r;
		const z = Math.sin(angle) * r;
		let tooClose = false;
		for (const existing of samples) {
			const dx = x - existing.x;
			const dz = z - existing.z;
			if (dx * dx + dz * dz < minDistance * minDistance) {
				tooClose = true;
				break;
			}
		}
		if (!tooClose) {
			samples.push({ x, z, r });
		}
	}
	return samples;
}

// ── Gaussian offset helper ─────────────────────────────────────────────────
function gaussianOffset(rng, sigma) {
	// Box-Muller transform
	const u1 = rng();
	const u2 = rng();
	const mag = sigma * Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10)));
	const angle = 2 * Math.PI * u2;
	return { x: mag * Math.cos(angle), z: mag * Math.sin(angle) };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
	return a + (b - a) * t;
}
function rd(n) {
	return Math.round(n * 100) / 100;
}
function dist2D(x, z) {
	return Math.sqrt(x * x + z * z);
}
function pickRandom(arr, rng) {
	return arr[Math.floor(rng() * arr.length)];
}

// ── Object keys ────────────────────────────────────────────────────────────
const CORALS = ["coral-0", "coral-1", "coral-2", "coral-3", "coral-4", "coral-5", "coral-6", "coral-large"];
const ROCKS = ["rock-0", "rock-1", "rock-2", "rock-3", "rock-4", "rock-5"];
const KELP = ["seaweed", "kelp-plant"];
const DECORATIONS = ["starfish", "sea-urchin", "shell", "anemone"];
const MESHY = [
	"meshy-basalt-pinnacle",
	"meshy-coral-encrusted-rock",
	"meshy-coral-mountain",
	"meshy-neon-coral-summit",
	"meshy-submerged-coral-citadel",
	"meshy-sunlit-coral-arch",
	"meshy-underwater-coral-arch",
	"meshy-underwater-rock-table",
	"meshy-photorealistic-coral-0",
	"meshy-photorealistic-coral-1",
	"meshy-photorealistic-coral-2",
	"meshy-photorealistic-coral-3",
];

// ── Main generation ────────────────────────────────────────────────────────
const SEED = 42;
const rng = mulberry32(SEED);
const grid = new PlacementGrid(2.5);
const placements = [];
let idCounter = 0;

function nextId() {
	return `ocean-${(idCounter++).toString().padStart(4, "0")}`;
}

function tryPlace(objectKey, x, z, scale, collisionRadius) {
	const r = dist2D(x, z);
	// Reject placements inside stage area
	if (r < 3.0) return false;
	if (!grid.isClear(x, z, collisionRadius)) return false;
	grid.register(x, z, collisionRadius);

	const rotY = rng() * Math.PI * 2;
	const s = typeof scale === "number" ? scale : scale;
	placements.push({
		id: nextId(),
		objectKey,
		position: [rd(x), 0, rd(z)],
		rotation: [rd(0), rd(Math.sin(rotY / 2)), rd(0), rd(Math.cos(rotY / 2))],
		scale: [rd(s), rd(s), rd(s)],
	});
	return true;
}

// ─── Step 1: Formation centers (Poisson disc in reef + background zone) ────
const formationCenters = poissonDiscSample(6, 25, 2.5, 50, rng);
console.log(`Generated ${formationCenters.length} formation centers`);

// ─── Step 2: Hero rocks at some formation centers ──────────────────────────
let heroRockCount = 0;
const heroIndices = new Set();
for (let i = 0; i < formationCenters.length && heroRockCount < 20; i++) {
	if (rng() < 0.5) continue; // ~50% of formations get a hero rock
	const fc = formationCenters[i];
	const scale = lerp(0.3, 1.5, rng());
	const rock = pickRandom(ROCKS, rng);
	if (tryPlace(rock, fc.x, fc.z, scale, scale * 0.8)) {
		heroRockCount++;
		heroIndices.add(i);
	}
}
console.log(`Placed ${heroRockCount} hero rocks`);

// ─── Step 3: Meshy formations ──────────────────────────────────────────────
let meshyCount = 0;
// Place meshy formations at some formation centers and some standalone positions
const meshyFormations = [...MESHY];
for (let i = 0; i < formationCenters.length && meshyCount < 15; i++) {
	if (heroIndices.has(i)) continue; // don't stack on hero rocks
	if (rng() < 0.6) continue;
	const fc = formationCenters[i];
	const scale = lerp(0.5, 2.0, rng());
	const key = meshyFormations[meshyCount % meshyFormations.length];
	if (tryPlace(key, fc.x, fc.z, scale, scale * 1.0)) {
		meshyCount++;
	}
}
// Fill remaining meshy at random positions in reef/background zone
while (meshyCount < 15) {
	const angle = rng() * Math.PI * 2;
	const r = lerp(8, 22, rng());
	const x = Math.cos(angle) * r;
	const z = Math.sin(angle) * r;
	const scale = lerp(0.5, 2.0, rng());
	const key = meshyFormations[meshyCount % meshyFormations.length];
	if (tryPlace(key, x, z, scale, scale * 1.0)) {
		meshyCount++;
	}
}
console.log(`Placed ${meshyCount} meshy formations`);

// ─── Step 4: Coral (clustered around formation centers) ────────────────────
let coralCount = 0;
const targetCoral = 280;
// Distribute coral around formation centers
for (let pass = 0; pass < 12 && coralCount < targetCoral; pass++) {
	for (let i = 0; i < formationCenters.length && coralCount < targetCoral; i++) {
		const fc = formationCenters[i];
		const fcDist = dist2D(fc.x, fc.z);
		// More coral in reef zone (6-15), less in background
		const coralDensity = fcDist < 15 ? 0.85 : 0.4;
		if (rng() > coralDensity) continue;

		const offset = gaussianOffset(rng, 1.8);
		const x = fc.x + offset.x;
		const z = fc.z + offset.z;

		// Scale varies: smaller coral near clearing, bigger in reef
		const distFromCenter = dist2D(x, z);
		let scaleMult;
		if (distFromCenter < 6) {
			scaleMult = lerp(0.1, 0.3, rng()); // small near clearing edge
		} else if (distFromCenter < 15) {
			scaleMult = lerp(0.2, 1.2, rng()); // full range in reef
		} else {
			scaleMult = lerp(0.3, 1.5, rng()); // can be large in background
		}

		// Pick species - coral-large only in reef zone and rarer
		let species;
		if (rng() < 0.12 && distFromCenter > 8) {
			species = "coral-large";
			scaleMult *= 1.3;
		} else {
			species = CORALS[Math.floor(rng() * 7)]; // coral-0 through coral-6
		}

		if (tryPlace(species, x, z, scaleMult, scaleMult * 0.3)) {
			coralCount++;
		}
	}
}
console.log(`Placed ${coralCount} coral pieces`);

// ─── Step 5: Kelp (near rocks, background fill) ───────────────────────────
let kelpCount = 0;
const targetKelp = 80;

// Kelp near formation centers in reef zone
for (let i = 0; i < formationCenters.length && kelpCount < targetKelp * 0.6; i++) {
	const fc = formationCenters[i];
	if (rng() < 0.5) continue;
	const offset = gaussianOffset(rng, 2.0);
	const x = fc.x + offset.x;
	const z = fc.z + offset.z;
	const distFromCenter = dist2D(x, z);
	if (distFromCenter < 5) continue;

	const key = pickRandom(KELP, rng);
	let scale;
	if (distFromCenter > 15) {
		// Background kelp: larger for silhouette
		scale = lerp(0.8, 1.5, rng());
	} else {
		scale = lerp(0.4, 1.0, rng());
	}
	if (tryPlace(key, x, z, scale, scale * 0.25)) {
		kelpCount++;
	}
}

// Background silhouette fill kelp
while (kelpCount < targetKelp) {
	const angle = rng() * Math.PI * 2;
	const r = lerp(16, 24, rng());
	const x = Math.cos(angle) * r;
	const z = Math.sin(angle) * r;
	const key = pickRandom(KELP, rng);
	const scale = lerp(0.8, 1.5, rng());
	if (tryPlace(key, x, z, scale, scale * 0.25)) {
		kelpCount++;
	}
}
console.log(`Placed ${kelpCount} kelp/seaweed`);

// ─── Step 6: Clearing pebbles (small rocks near stage edge) ───────────────
let pebbleCount = 0;
const targetPebbles = 40;
while (pebbleCount < targetPebbles) {
	const angle = rng() * Math.PI * 2;
	const r = lerp(3.2, 6.0, rng());
	const x = Math.cos(angle) * r;
	const z = Math.sin(angle) * r;
	const rock = pickRandom(ROCKS, rng);
	const scale = lerp(0.08, 0.2, rng());
	if (tryPlace(rock, x, z, scale, scale * 0.5)) {
		pebbleCount++;
	}
}
console.log(`Placed ${pebbleCount} clearing pebbles`);

// ─── Step 7: Decorations ──────────────────────────────────────────────────
let decoCount = 0;
const targetDeco = 60;

for (let i = 0; i < formationCenters.length && decoCount < targetDeco; i++) {
	const fc = formationCenters[i];
	const fcDist = dist2D(fc.x, fc.z);

	// Place 1-2 decorations near each formation
	const numDecos = rng() < 0.6 ? 1 : 2;
	for (let d = 0; d < numDecos && decoCount < targetDeco; d++) {
		const offset = gaussianOffset(rng, 1.5);
		const x = fc.x + offset.x;
		const z = fc.z + offset.z;

		let key;
		const roll = rng();
		if (roll < 0.3) {
			key = "starfish"; // near coral
		} else if (roll < 0.55) {
			key = "sea-urchin"; // near formations
		} else if (roll < 0.75) {
			key = "anemone"; // near rocks
		} else {
			key = "shell"; // anywhere
		}

		// Shells also in clearing
		if (key === "shell" && fcDist > 10 && rng() < 0.5) {
			const clearAngle = rng() * Math.PI * 2;
			const clearR = lerp(3.5, 5.5, rng());
			const cx = Math.cos(clearAngle) * clearR;
			const cz = Math.sin(clearAngle) * clearR;
			const scale = lerp(0.15, 0.35, rng());
			if (tryPlace(key, cx, cz, scale, scale * 0.3)) {
				decoCount++;
				continue;
			}
		}

		const scale = lerp(0.15, 0.5, rng());
		if (tryPlace(key, x, z, scale, scale * 0.3)) {
			decoCount++;
		}
	}
}

// Fill remaining decorations in clearing zone
while (decoCount < targetDeco) {
	const angle = rng() * Math.PI * 2;
	const r = lerp(3.5, 20, rng());
	const x = Math.cos(angle) * r;
	const z = Math.sin(angle) * r;
	const key = pickRandom(DECORATIONS, rng);
	const scale = lerp(0.15, 0.5, rng());
	if (tryPlace(key, x, z, scale, scale * 0.3)) {
		decoCount++;
	}
}
console.log(`Placed ${decoCount} decorations`);

// ── Write output ───────────────────────────────────────────────────────────
console.log(`\nTotal placements: ${placements.length}`);

// Format each placement as a single line
function fmtArr(arr) {
	return `[${arr.join(", ")}]`;
}

const lines = placements.map((p) => {
	return `\t{ id: "${p.id}", objectKey: "${p.objectKey}", position: ${fmtArr(p.position)}, rotation: ${fmtArr(p.rotation)}, scale: ${fmtArr(p.scale)} },`;
});

const output = `import type { ComposerPlacement } from "$lib/shared/3d/scene-composer/types";

// Auto-generated by scripts/generate-ocean-placements.cjs — do not edit manually.
// Seed: ${SEED} | Total: ${placements.length} placements
// Re-run: node scripts/generate-ocean-placements.cjs

// <!-- PLACEMENTS_START -->
export const OCEAN_PLACEMENTS: ComposerPlacement[] = [
${lines.join("\n")}
];
// <!-- PLACEMENTS_END -->
`;

const outPath = path.join(
	__dirname,
	"..",
	"src",
	"lib",
	"shared",
	"3d",
	"environments",
	"scenes",
	"ocean",
	"authored",
	"placements.ts"
);

fs.writeFileSync(outPath, output, "utf-8");
console.log(`\nWrote ${placements.length} placements to:\n  ${outPath}`);

// ── Summary by category ────────────────────────────────────────────────────
const categories = {};
for (const p of placements) {
	const cat =
		p.objectKey.startsWith("coral") ? "coral" :
		p.objectKey.startsWith("rock") ? "rock" :
		p.objectKey.startsWith("meshy") ? "meshy" :
		p.objectKey.startsWith("kelp") || p.objectKey === "seaweed" ? "kelp/seaweed" :
		"decoration";
	categories[cat] = (categories[cat] || 0) + 1;
}
console.log("\nBreakdown:");
for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
	console.log(`  ${cat}: ${count}`);
}
