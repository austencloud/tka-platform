/**
 * Full Museum Floor Plan — The Kinetic Archive
 *
 * Builds the complete museum as one continuous MuseumGrid.
 * 16 rooms connected by corridors on a 150×220 tile grid.
 *
 * Spec: docs/superpowers/specs/2026-03-28-museum-floor-plan-design.md
 * Lore: docs/museum/story-bible.md (canon)
 */

import type {
	MuseumTile,
	MuseumGrid,
	FloorMaterial,
	Direction,
	WingRegion,
	ExhibitDefinition,
	PerformerDefinition,
	TriggerDefinition,
	WingTheme,
} from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";

// ── Low-Level Helpers ──

/** Stamp a rectangular room: walls on edges, floor inside. */
export function stampRoom(
	tiles: Map<string, MuseumTile>,
	x: number,
	y: number,
	w: number,
	h: number,
	material: FloorMaterial,
): void {
	for (let dy = 0; dy < h; dy++) {
		for (let dx = 0; dx < w; dx++) {
			const isEdge = dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
			const key = tileKey(x + dx, y + dy);
			if (isEdge) {
				tiles.set(key, { type: "wall" });
			} else {
				tiles.set(key, { type: "floor", material });
			}
		}
	}
}

/**
 * Stamp a corridor: walls on the long edges, corridor tiles inside.
 * orientation: "vertical" = walls on left/right, "horizontal" = walls on top/bottom
 */
export function stampCorridor(
	tiles: Map<string, MuseumTile>,
	x: number,
	y: number,
	w: number,
	h: number,
	orientation: "vertical" | "horizontal",
	material: FloorMaterial,
): void {
	for (let dy = 0; dy < h; dy++) {
		for (let dx = 0; dx < w; dx++) {
			const key = tileKey(x + dx, y + dy);
			const isWall =
				orientation === "vertical"
					? dx === 0 || dx === w - 1
					: dy === 0 || dy === h - 1;
			if (isWall) {
				tiles.set(key, { type: "wall" });
			} else {
				tiles.set(key, { type: "corridor", material });
			}
		}
	}
}

/** Replace existing tiles at a position with door tiles. */
export function carveDoor(
	tiles: Map<string, MuseumTile>,
	x: number,
	y: number,
	length: number,
	orientation: "horizontal" | "vertical",
): void {
	for (let i = 0; i < length; i++) {
		const dx = orientation === "horizontal" ? i : 0;
		const dy = orientation === "vertical" ? i : 0;
		tiles.set(tileKey(x + dx, y + dy), { type: "door" });
	}
}

/** Place a single tile, overwriting whatever was there. */
export function placeTile(
	tiles: Map<string, MuseumTile>,
	x: number,
	y: number,
	tile: MuseumTile,
): void {
	tiles.set(tileKey(x, y), tile);
}

// ── Room Builders ──
// Each function stamps one room + its connecting corridor(s) and returns
// the wing region, exhibit definitions, etc. that the room contributes.

function buildEntrance(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
) {
	stampRoom(tiles, 68, 197, 24, 16, "marble");
	// No south door — the lobby IS the entrance. Player spawns inside.
	carveDoor(tiles, 78, 197, 4, "horizontal"); // north to corridor
	placeTile(tiles, 80, 208, { type: "pedestal", refId: "guest-book" });
	placeTile(tiles, 78, 198, { type: "sign", refId: "welcome-sign" });
	wings.push({
		id: "entrance",
		name: "Entrance Lobby",
		bounds: { x: 68, y: 197, width: 24, height: 16 },
		theme: "institutional",
		description: "The front entrance of The Kinetic Archive. A guest book sits near the door. The marble floor is worn from decades of foot traffic. A corridor leads north into the first exhibit.",
	});
	exhibits.push({
		id: "entrance-welcome",
		tileX: 78,
		tileY: 198,
		plaque: {
			title: "Welcome to The Kinetic Archive",
			body: "Department of Rotational Affairs, Facility 7. Please proceed through the exhibits in order. Do not touch the artifacts. Do not attempt to replicate what you see.",
			footer: "Visiting hours: 24/7",
		},
	});

	// Corridor: Lobby → Cave
	stampCorridor(tiles, 78, 189, 4, 9, "vertical", "stone");
	carveDoor(tiles, 78, 197, 4, "horizontal");
	carveDoor(tiles, 78, 189, 4, "horizontal");
}

function buildVulcanCave(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
	performers: PerformerDefinition[],
) {
	stampRoom(tiles, 65, 161, 30, 29, "stone");
	carveDoor(tiles, 78, 189, 4, "horizontal"); // south door
	carveDoor(tiles, 88, 161, 4, "horizontal"); // north-east door

	// Torches — irregularly placed for cave feel
	placeTile(tiles, 67, 163, { type: "torch" });
	placeTile(tiles, 92, 163, { type: "torch" });
	placeTile(tiles, 67, 185, { type: "torch" });
	placeTile(tiles, 92, 185, { type: "torch" });
	placeTile(tiles, 80, 170, { type: "torch" });
	placeTile(tiles, 80, 180, { type: "torch" });

	// Lascaux tablets — exhibit panels along north wall
	for (let x = 78; x <= 81; x++) {
		placeTile(tiles, x, 162, {
			type: "exhibit-panel",
			refId: "cave-lascaux",
			facing: "south",
		});
	}
	placeTile(tiles, 76, 164, { type: "pedestal", refId: "cave-tablet-1" });
	placeTile(tiles, 83, 164, { type: "pedestal", refId: "cave-tablet-2" });

	// Cave painting panels on side walls
	placeTile(tiles, 66, 172, {
		type: "exhibit-panel",
		refId: "cave-paintings",
		facing: "east",
	});
	placeTile(tiles, 66, 178, {
		type: "exhibit-panel",
		refId: "cave-marchand",
		facing: "east",
	});

	// Performers — caveman clubs demonstration
	placeTile(tiles, 78, 167, {
		type: "performer-station",
		refId: "cave-performer",
		facing: "south",
	});
	placeTile(tiles, 81, 167, {
		type: "performer-station",
		refId: "cave-performer",
		facing: "south",
	});

	wings.push({
		id: "cave",
		name: "Vulcan Cave",
		bounds: { x: 65, y: 161, width: 30, height: 29 },
		theme: "cave",
		description: "A recreation of the sealed chamber in the Lascaux cave system. Torchlight flickers across stone walls. The air smells like damp earth and old fire. Stone tablets and cave paintings line the walls.",
	});
	exhibits.push(
		{
			id: "cave-lascaux",
			tileX: 79,
			tileY: 162,
			plaque: {
				title: "The Lascaux Tablets",
				subtitle: "c. 35,000 BCE (replica)",
				body: "Stone tablets recovered from a sealed chamber in the Lascaux cave system. The markings show a four-beat sequence using burning branches. Designated OOGA-1 by the Nomenclature Division.",
				footer: "Discovered 1979, Dr. Henri Marchand (published posthumously)",
			},
		},
		{
			id: "cave-paintings",
			tileX: 66,
			tileY: 172,
			plaque: {
				title: "Rehearsal Chamber Recreation",
				body: "Full-scale reproduction of the secondary chamber. Note the repeated hand positions along the south wall — not decoration, but instruction. Someone was teaching.",
			},
		},
		{
			id: "cave-marchand",
			tileX: 66,
			tileY: 178,
			plaque: {
				title: "Dr. Henri Marchand",
				subtitle: "1921–1982",
				body: "Marchand spent three years documenting the sealed chamber before his death. His notes were published posthumously by a colleague who wished to remain anonymous. Primary sources are suspiciously unavailable throughout kinetic history.",
			},
		},
	);
	performers.push({
		id: "cave-performer",
		tileX: 78,
		tileY: 167,
		facing: "south",
		autoPlay: false,
	});

	// Corridor: Cave → Egyptian (L-shaped)
	stampCorridor(tiles, 88, 153, 4, 9, "vertical", "sandstone");
	carveDoor(tiles, 88, 161, 4, "horizontal");
	stampCorridor(tiles, 88, 153, 10, 4, "horizontal", "sandstone");
	carveDoor(tiles, 96, 153, 4, "vertical");
}

function buildEgyptianWing(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
) {
	stampRoom(tiles, 96, 133, 28, 24, "sandstone");
	carveDoor(tiles, 96, 153, 4, "vertical"); // west door
	carveDoor(tiles, 108, 156, 4, "horizontal"); // south door

	// Pillars
	placeTile(tiles, 104, 140, { type: "pedestal", refId: "egypt-pillar" });
	placeTile(tiles, 116, 140, { type: "pedestal", refId: "egypt-pillar" });
	placeTile(tiles, 104, 150, { type: "pedestal", refId: "egypt-pillar" });
	placeTile(tiles, 116, 150, { type: "pedestal", refId: "egypt-pillar" });

	// Exhibits
	placeTile(tiles, 110, 134, {
		type: "exhibit-panel",
		refId: "egypt-karnak",
		facing: "south",
	});
	placeTile(tiles, 97, 142, {
		type: "exhibit-panel",
		refId: "egypt-priesthood",
		facing: "east",
	});
	placeTile(tiles, 122, 142, {
		type: "exhibit-panel",
		refId: "egypt-amphora",
		facing: "west",
	});
	placeTile(tiles, 110, 155, {
		type: "exhibit-panel",
		refId: "egypt-controlled",
		facing: "north",
	});

	// Torches — oil lamp positions
	placeTile(tiles, 98, 135, { type: "torch" });
	placeTile(tiles, 121, 135, { type: "torch" });

	wings.push({
		id: "egyptian",
		name: "Egyptian Wing",
		bounds: { x: 96, y: 133, width: 28, height: 24 },
		theme: "classical",
		description: "Warm sandstone and the soft glow of oil lamps. This wing documents the formalization of the Type system in ancient Egypt and Greece. Four stone pillars frame the central hall.",
	});
	exhibits.push(
		{
			id: "egypt-karnak",
			tileX: 110,
			tileY: 134,
			plaque: {
				title: "The Karnak Scrolls",
				subtitle: "c. 1470 BCE",
				body: "Hieroglyphic scrolls documenting the first formal Type classification system. Six categories of movement, organized by hand path. The priesthood controlled access to advanced notation.",
				footer: "Translated by the Cairo Institute, 1923",
			},
		},
		{
			id: "egypt-priesthood",
			tileX: 97,
			tileY: 142,
			plaque: {
				title: "Priesthood Display",
				body: "Temple scene: priests notating ceremonial movements on papyrus. Access to the complete Type system required initiation into the inner circle. Knowledge was power. Power was controlled.",
			},
		},
		{
			id: "egypt-amphora",
			tileX: 122,
			tileY: 142,
			plaque: {
				title: "Greek Amphora",
				subtitle: "c. 500 BCE",
				body: "Decorated pottery showing spinning figures. The Greeks inherited the system from Egypt and applied mathematical rigor. Pythagoras recognized the relationships. He founded a secret cult to study them.",
			},
		},
		{
			id: "egypt-controlled",
			tileX: 110,
			tileY: 155,
			plaque: {
				title: "Controlled Knowledge",
				body: "First evidence that access was deliberately restricted. Temple records show notation scrolls stored separately from other documents, with specialized access protocols.",
				footer: "NILE BUREAU — Classification: RESTRICTED",
			},
		},
	);

	// Corridor: Egyptian → Renaissance
	stampCorridor(tiles, 108, 156, 4, 9, "vertical", "wood");
	carveDoor(tiles, 108, 156, 4, "horizontal");
	carveDoor(tiles, 108, 164, 4, "horizontal");
}

function buildRenaissanceWing(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
) {
	stampRoom(tiles, 96, 164, 24, 22, "wood");
	carveDoor(tiles, 108, 164, 4, "horizontal"); // north door
	carveDoor(tiles, 96, 173, 4, "vertical"); // west door

	// Exhibits
	placeTile(tiles, 108, 165, {
		type: "exhibit-panel",
		refId: "ren-codex",
		facing: "south",
	});
	placeTile(tiles, 97, 170, {
		type: "exhibit-panel",
		refId: "ren-vitruvian",
		facing: "east",
	});
	placeTile(tiles, 118, 175, {
		type: "exhibit-panel",
		refId: "ren-workshop",
		facing: "west",
	});
	placeTile(tiles, 108, 184, {
		type: "exhibit-panel",
		refId: "ren-notebooks",
		facing: "north",
	});
	placeTile(tiles, 106, 175, { type: "pedestal", refId: "ren-workbench" });

	// Candle torches
	placeTile(tiles, 98, 166, { type: "torch" });
	placeTile(tiles, 117, 166, { type: "torch" });

	wings.push({
		id: "renaissance",
		name: "Renaissance Wing",
		bounds: { x: 96, y: 164, width: 24, height: 22 },
		theme: "renaissance",
		description: "Natural light and the smell of old wood. Da Vinci's workshop, recreated from contemporary accounts. Codex pages and rotational diagrams cover the walls. The notebooks were scattered after his death. Someone wanted the complete system to be unrecoverable.",
	});
	exhibits.push(
		{
			id: "ren-codex",
			tileX: 108,
			tileY: 165,
			plaque: {
				title: "Codex Pages",
				subtitle: "c. 1500 CE",
				body: "Da Vinci's notebooks contain rotational diagrams that precisely match the Kinetic Alphabet's position system. He decoded the Egyptian scrolls and recast them as geometry.",
				footer: "Reproductions. Originals: scattered across seven collections.",
			},
		},
		{
			id: "ren-vitruvian",
			tileX: 97,
			tileY: 170,
			plaque: {
				title: "Vitruvian Man Analysis",
				body: "The famous image reinterpreted as a position diagram. Arms and legs map to the eight cardinal and intercardinal points. Da Vinci embedded the grid in the most famous drawing in history.",
			},
		},
		{
			id: "ren-workshop",
			tileX: 118,
			tileY: 175,
			plaque: {
				title: "Workshop Recreation",
				body: "Da Vinci's studio with scattered notes. The notebooks were deliberately dispersed after his death. By whom, and why, remains a matter of institutional record.",
			},
		},
		{
			id: "ren-notebooks",
			tileX: 108,
			tileY: 184,
			plaque: {
				title: "Notebooks Scattered",
				body: "After Leonardo's death in 1519, his notebooks were dispersed across seven collections in five countries. The dispersal pattern matches no known inheritance or sale. Someone wanted the complete system to be unrecoverable.",
			},
		},
	);

	// Corridor: Renaissance → Victorian
	stampCorridor(tiles, 86, 171, 11, 4, "horizontal", "marble");
	carveDoor(tiles, 96, 173, 4, "vertical");
	carveDoor(tiles, 86, 171, 4, "vertical");
}

function buildVictorianWing(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
) {
	stampRoom(tiles, 58, 161, 29, 26, "marble");
	carveDoor(tiles, 86, 173, 4, "vertical"); // east door
	carveDoor(tiles, 62, 161, 4, "horizontal"); // north door to Digital
	carveDoor(tiles, 82, 186, 4, "horizontal"); // south-east door to Construction

	// Exhibits
	placeTile(tiles, 72, 162, {
		type: "exhibit-panel",
		refId: "vic-brass",
		facing: "south",
	});
	placeTile(tiles, 59, 172, {
		type: "exhibit-panel",
		refId: "vic-patents",
		facing: "east",
	});
	placeTile(tiles, 85, 172, {
		type: "exhibit-panel",
		refId: "vic-portraits",
		facing: "west",
	});
	placeTile(tiles, 72, 185, {
		type: "exhibit-panel",
		refId: "vic-discredited",
		facing: "north",
	});
	placeTile(tiles, 72, 170, { type: "pedestal", refId: "vic-prototype" });
	placeTile(tiles, 72, 176, { type: "pedestal", refId: "vic-device" });

	// Gas lamps
	placeTile(tiles, 60, 163, { type: "torch" });
	placeTile(tiles, 84, 163, { type: "torch" });

	wings.push({
		id: "victorian",
		name: "Victorian Wing",
		bounds: { x: 58, y: 161, width: 29, height: 26 },
		theme: "industrial",
		description: "Gas lamps and brass fittings. The Victorian era brought mechanization to kinetic notation — and the first systematic suppression. Patents filed, patents recalled. Inventors discredited by scandal. The method is never explained.",
	});
	exhibits.push(
		{
			id: "vic-brass",
			tileX: 72,
			tileY: 162,
			plaque: {
				title: "The Brass Notation Device",
				subtitle: "1871, London",
				body: "The only surviving prototype. A mechanical calculator that could enumerate all possible four-beat sequences for a given starting position. Patent recalled by the Home Office within six months of filing.",
				footer: "Inventor: [NAME REDACTED]",
			},
		},
		{
			id: "vic-patents",
			tileX: 59,
			tileY: 172,
			plaque: {
				title: "Patent Documents",
				body: "Seven patent applications related to kinetic notation, filed between 1868 and 1891. Three marked RECALLED. Two marked APPLICATION DENIED. One stamped with a symbol not yet catalogued by this archive.",
			},
		},
		{
			id: "vic-portraits",
			tileX: 85,
			tileY: 172,
			plaque: {
				title: "Inventor Portraits",
				body: "Several portraits of notable kinetic researchers. One portrait has the nameplate replaced with NAME REDACTED. The subject appears undisturbed by this.",
			},
		},
		{
			id: "vic-discredited",
			tileX: 72,
			tileY: 185,
			plaque: {
				title: "Discredited",
				body: "Key inventors were ruined by scandal. Anonymous complaints, funding reviews, paper retractions. No violence. Just process. The method is never explained in this archive.",
				footer: "See also: Containment Protocol 4-C (discrediting)",
			},
		},
	);

	// Corridor: Victorian → Digital
	stampCorridor(tiles, 62, 153, 4, 9, "vertical", "stone");
	carveDoor(tiles, 62, 161, 4, "horizontal");
	carveDoor(tiles, 62, 153, 4, "horizontal");
}

function buildDigitalWing(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
) {
	stampRoom(tiles, 50, 133, 24, 21, "stone");
	carveDoor(tiles, 62, 153, 4, "horizontal"); // south door
	carveDoor(tiles, 60, 133, 4, "horizontal"); // north door

	// VTG Wing visible opening — replace west wall with rope
	for (let y = 140; y <= 145; y++) {
		placeTile(tiles, 50, y, { type: "rope" });
	}

	// Exhibits
	placeTile(tiles, 62, 134, {
		type: "exhibit-panel",
		refId: "digital-crt",
		facing: "south",
	});
	placeTile(tiles, 51, 140, {
		type: "exhibit-panel",
		refId: "digital-bbs",
		facing: "east",
	});
	placeTile(tiles, 72, 140, {
		type: "exhibit-panel",
		refId: "digital-3400",
		facing: "west",
	});
	placeTile(tiles, 62, 152, {
		type: "exhibit-panel",
		refId: "digital-team",
		facing: "north",
	});
	placeTile(tiles, 60, 143, { type: "pedestal", refId: "digital-terminal" });

	wings.push({
		id: "digital",
		name: "Digital Wing",
		bounds: { x: 50, y: 133, width: 24, height: 21 },
		theme: "digital",
	});
	exhibits.push(
		{
			id: "digital-crt",
			tileX: 62,
			tileY: 134,
			plaque: {
				title: "The CRT",
				subtitle: "1993",
				body: "The original terminal running TKA-OS v2. One of an estimated 3,400 copies distributed before the Bureau detected the breach. Press E to boot the system.",
				footer: "Serial: BKC-ASSET-7741",
			},
		},
		{
			id: "digital-bbs",
			tileX: 51,
			tileY: 140,
			plaque: {
				title: "BBS Printouts",
				body: "Forum posts from 1993-1994. Users sharing sequences, asking questions, building on each other's work. The Bureau monitored these forums for eleven months before requesting emergency powers.",
			},
		},
		{
			id: "digital-3400",
			tileX: 72,
			tileY: 140,
			plaque: {
				title: "3,400 Users",
				body: "The number that triggered the crisis. Internal memo: 'Distribution has exceeded containment threshold. Recommend immediate execution of Protocol Lethe. See attached requisition.'",
			},
		},
		{
			id: "digital-team",
			tileX: 62,
			tileY: 152,
			plaque: {
				title: "Development Team",
				body: "Grainy photograph. Faces obscured. One circled in red marker — added later, not original to the print. The handwriting on the circle matches no known Bureau personnel.",
			},
		},
	);

	// Corridor: Digital → Suppression
	stampCorridor(tiles, 60, 125, 4, 9, "vertical", "marble");
	carveDoor(tiles, 60, 133, 4, "horizontal");
	carveDoor(tiles, 60, 125, 4, "horizontal");
}

function buildSuppression(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
) {
	stampRoom(tiles, 46, 95, 30, 31, "marble");
	carveDoor(tiles, 60, 125, 4, "horizontal"); // south door
	carveDoor(tiles, 60, 95, 4, "horizontal"); // north door

	// Large "Order" display — multiple panels along north wall
	for (let x = 56; x <= 65; x++) {
		placeTile(tiles, x, 96, {
			type: "exhibit-panel",
			refId: "supp-order",
			facing: "south",
		});
	}
	placeTile(tiles, 47, 108, {
		type: "exhibit-panel",
		refId: "supp-lethe",
		facing: "east",
	});
	placeTile(tiles, 74, 108, {
		type: "exhibit-panel",
		refId: "supp-youve-seen",
		facing: "west",
	});
	placeTile(tiles, 60, 124, {
		type: "exhibit-panel",
		refId: "supp-may8",
		facing: "north",
	});
	placeTile(tiles, 55, 115, { type: "pedestal", refId: "supp-filing-1" });
	placeTile(tiles, 66, 115, { type: "pedestal", refId: "supp-filing-2" });

	wings.push({
		id: "suppression",
		name: "The Suppression",
		bounds: { x: 46, y: 95, width: 30, height: 31 },
		theme: "institutional",
	});
	exhibits.push(
		{
			id: "supp-order",
			tileX: 60,
			tileY: 96,
			plaque: {
				title: "The Order of the Closed Palm",
				body: "Founded before recorded history. Three names across three eras: a symbol predating language, a secret society, a government bureau. Their mission: observe, archive, revere — but never practice. The hand that refuses to grip.",
				footer: "Bureau of Kinetic Containment, est. classified",
			},
		},
		{
			id: "supp-lethe",
			tileX: 47,
			tileY: 108,
			plaque: {
				title: "Protocol Lethe Documentation",
				body: "Named for the Greek river of forgetting. An ancient bureaucratic procedure inherited from the Order's prehistoric era. Requisition 7741-B submitted to three departments: Media Degaussing, Cognitive Reclassification, Digital Archive Redaction. Each processes independently.",
			},
		},
		{
			id: "supp-youve-seen",
			tileX: 74,
			tileY: 108,
			plaque: {
				title: "You've Seen This Before",
				body: "The symbol in the cave ceiling. The wax seal on the Renaissance letter. The stamp on the Victorian patent. The username in the BBS thread. It was here the whole time. You just didn't know what you were looking at.",
			},
		},
		{
			id: "supp-may8",
			tileX: 60,
			tileY: 124,
			plaque: {
				title: "May 8, 1994",
				body: "Date of the final Protocol Lethe execution. The protocol was designed for villages and monasteries. It cannot scale to eight billion people with broadband. Ancient containment procedure versus YouTube.",
				footer: "Status: PARTIAL FAILURE — See Addendum 7741-F",
			},
		},
	);
}

function buildCrumble(tiles: Map<string, MuseumTile>, wings: WingRegion[]) {
	// The Crumble is the visible seam between Order-era and Scribe-era.
	// Narrow, decayed, atmospheric. Not a room — a passage.
	stampRoom(tiles, 58, 73, 8, 23, "dirt");
	carveDoor(tiles, 60, 95, 4, "horizontal"); // south — from Suppression
	carveDoor(tiles, 60, 73, 4, "horizontal"); // north — to K's Gallery

	// Collapsed section — half-blocked with walls
	placeTile(tiles, 59, 82, { type: "wall" });
	placeTile(tiles, 60, 82, { type: "wall" });
	placeTile(tiles, 61, 82, { type: "wall" });

	// Abandoned filing cabinets
	placeTile(tiles, 62, 78, { type: "pedestal", refId: "crumble-cabinet-1" });
	placeTile(tiles, 62, 88, { type: "pedestal", refId: "crumble-cabinet-2" });
	placeTile(tiles, 63, 85, { type: "torch" }); // flickering, half-broken

	wings.push({
		id: "crumble",
		name: "The Crumble",
		bounds: { x: 58, y: 73, width: 8, height: 23 },
		theme: "construction",
	});
}

function buildKGallery(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
	performers: PerformerDefinition[],
) {
	stampRoom(tiles, 46, 45, 28, 29, "wood");
	carveDoor(tiles, 58, 73, 4, "horizontal"); // south — from Crumble
	carveDoor(tiles, 58, 45, 4, "horizontal"); // north — to Fear corridor

	// Warm torches
	placeTile(tiles, 48, 47, { type: "torch" });
	placeTile(tiles, 72, 47, { type: "torch" });
	placeTile(tiles, 48, 70, { type: "torch" });
	placeTile(tiles, 72, 70, { type: "torch" });

	// Exhibits — K's own curation
	placeTile(tiles, 58, 46, {
		type: "exhibit-panel",
		refId: "gallery-spiral",
		facing: "south",
	});
	placeTile(tiles, 47, 58, {
		type: "exhibit-panel",
		refId: "gallery-scribes",
		facing: "east",
	});
	placeTile(tiles, 72, 58, {
		type: "exhibit-panel",
		refId: "gallery-practice",
		facing: "west",
	});
	placeTile(tiles, 58, 72, {
		type: "exhibit-panel",
		refId: "gallery-k-note",
		facing: "north",
	});
	placeTile(tiles, 56, 55, { type: "pedestal", refId: "gallery-artifact-1" });
	placeTile(tiles, 64, 55, { type: "pedestal", refId: "gallery-artifact-2" });

	// First performer that feels inviting, not clinical
	placeTile(tiles, 60, 60, {
		type: "performer-station",
		refId: "gallery-scribe",
		facing: "south",
	});

	wings.push({
		id: "gallery",
		name: "K's Gallery",
		bounds: { x: 46, y: 45, width: 28, height: 29 },
		theme: "gallery",
	});
	exhibits.push(
		{
			id: "gallery-spiral",
			tileX: 58,
			tileY: 46,
			plaque: {
				title: "The Spiral",
				body: "You've seen it throughout the museum. On floor tiles, in frame corners, woven into decoration. Every spin is a spiral through time. The Scribes didn't choose it. It chose them.",
				footer: "— K",
			},
		},
		{
			id: "gallery-scribes",
			tileX: 47,
			tileY: 58,
			plaque: {
				title: "The Scribes",
				body: "Not an organization. A pattern. People who picked up the thing and did it. Sometimes they cluster into groups. Sometimes they're alone. The Order documents them all.",
			},
		},
		{
			id: "gallery-practice",
			tileX: 72,
			tileY: 58,
			plaque: {
				title: "Practice",
				body: "The gap between 'I can see this is beautiful' and 'I can do this myself' is the whole story. Forty thousand years of it.",
				footer: "— K",
			},
		},
		{
			id: "gallery-k-note",
			tileX: 58,
			tileY: 72,
			plaque: {
				title: "Curator's Note",
				body: "This is my favorite room. I built it from what the Order left behind. They had everything right except the padlock.",
				footer: "— K",
			},
		},
	);
	performers.push({
		id: "gallery-scribe",
		tileX: 60,
		tileY: 60,
		facing: "south",
		autoPlay: false,
	});

	// Corridor: K's Gallery → Fear
	stampCorridor(tiles, 58, 37, 4, 9, "vertical", "stone");
	carveDoor(tiles, 58, 45, 4, "horizontal");
	carveDoor(tiles, 58, 37, 4, "horizontal");
}

function buildEndingRooms(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
	performers: PerformerDefinition[],
	triggers: TriggerDefinition[],
) {
	// ── Room of Fear ──
	stampRoom(tiles, 50, 19, 20, 19, "stone");
	carveDoor(tiles, 58, 37, 4, "horizontal"); // south door
	carveDoor(tiles, 69, 27, 4, "vertical"); // east door

	for (let x = 55; x <= 64; x += 3) {
		placeTile(tiles, x, 20, {
			type: "exhibit-panel",
			refId: "fear-containment",
			facing: "south",
		});
	}
	placeTile(tiles, 60, 36, { type: "sign", refId: "fear-warning" });

	wings.push({
		id: "fear",
		name: "Room of Fear",
		bounds: { x: 50, y: 19, width: 20, height: 19 },
		theme: "institutional",
	});
	exhibits.push({
		id: "fear-containment",
		tileX: 58,
		tileY: 20,
		plaque: {
			title: "CONTAINMENT PROTOCOL ACTIVE",
			body: "This knowledge is a public health hazard. Seal the archive. Walk away. Authorized handling personnel only. Do not attempt replication. Report exposure immediately.",
			footer: "Bureau of Kinetic Containment — Form 7741-C",
		},
	});

	// Corridor: Fear → Isolation
	stampCorridor(tiles, 69, 27, 9, 4, "horizontal", "marble");
	carveDoor(tiles, 69, 27, 4, "vertical");
	carveDoor(tiles, 77, 27, 4, "vertical");

	// ── Room of Isolation ──
	stampRoom(tiles, 77, 15, 30, 24, "marble");
	carveDoor(tiles, 77, 25, 4, "vertical"); // west door
	carveDoor(tiles, 106, 25, 4, "vertical"); // east door

	// Cubicle grid: 4 columns × 3 rows of 5×5 cells
	for (let cellRow = 0; cellRow < 3; cellRow++) {
		for (let cellCol = 0; cellCol < 4; cellCol++) {
			const cx = 80 + cellCol * 6;
			const cy = 18 + cellRow * 6;
			// South wall and east wall of each cubicle
			for (let dx = 0; dx < 5; dx++) {
				placeTile(tiles, cx + dx, cy + 4, { type: "wall" });
			}
			for (let dy = 0; dy < 5; dy++) {
				placeTile(tiles, cx + 4, cy + dy, { type: "wall" });
			}
			// Performer inside each cubicle
			placeTile(tiles, cx + 2, cy + 2, {
				type: "performer-station",
				refId: "isolation-spinner",
				facing: "south",
			});
		}
	}
	placeTile(tiles, 92, 37, { type: "sign", refId: "isolation-protocol" });

	wings.push({
		id: "isolation",
		name: "Room of Isolation",
		bounds: { x: 77, y: 15, width: 30, height: 24 },
		theme: "institutional",
	});
	triggers.push({
		id: "isolation-protocol",
		tileX: 92,
		tileY: 37,
		action: "show-lore",
		content: {
			title: "INDIVIDUAL CONTAINMENT PROTOCOLS",
			body: "Maintain minimum 1-meter separation. Do not make eye contact during sessions. Report any attempt at synchronized movement immediately.",
		},
	});

	// Corridor: Isolation → Collaboration
	stampCorridor(tiles, 106, 25, 9, 4, "horizontal", "dirt");
	carveDoor(tiles, 106, 25, 4, "vertical");
	carveDoor(tiles, 114, 25, 4, "vertical");

	// ── Room of Collaboration ──
	stampRoom(tiles, 114, 10, 26, 22, "dirt");
	carveDoor(tiles, 114, 25, 4, "vertical"); // west door
	carveDoor(tiles, 125, 31, 4, "horizontal"); // south door to Gift Shop

	// Open sky: remove north and east walls
	for (let x = 115; x < 139; x++) {
		tiles.delete(tileKey(x, 10));
	}
	for (let y = 11; y < 31; y++) {
		tiles.delete(tileKey(139, y));
	}

	// Performers — scattered, playing together, autoPlay
	const collabPerformers: Array<{
		x: number;
		y: number;
		facing: Direction;
		id: string;
	}> = [
		{ x: 120, y: 18, facing: "east", id: "collab-1" },
		{ x: 125, y: 16, facing: "west", id: "collab-2" },
		{ x: 130, y: 20, facing: "north", id: "collab-3" },
		{ x: 122, y: 24, facing: "south", id: "collab-4" },
	];
	for (const p of collabPerformers) {
		placeTile(tiles, p.x, p.y, {
			type: "performer-station",
			refId: p.id,
			facing: p.facing,
		});
		performers.push({
			id: p.id,
			tileX: p.x,
			tileY: p.y,
			facing: p.facing,
			autoPlay: true,
		});
	}

	// Wax figure with pamphlet near exit
	placeTile(tiles, 126, 29, { type: "pedestal", refId: "collab-pamphlet" });

	wings.push({
		id: "collaboration",
		name: "Room of Collaboration",
		bounds: { x: 114, y: 10, width: 26, height: 22 },
		theme: "outdoor",
	});

	// Corridor: Collaboration → Gift Shop
	stampCorridor(tiles, 125, 31, 4, 9, "vertical", "marble");
	carveDoor(tiles, 125, 31, 4, "horizontal");
	carveDoor(tiles, 125, 39, 4, "horizontal");

	// ── Gift Shop ──
	stampRoom(tiles, 116, 39, 22, 18, "marble");
	carveDoor(tiles, 125, 39, 4, "horizontal"); // north door
	carveDoor(tiles, 125, 56, 4, "horizontal"); // south door (EXIT)

	// Shelves
	for (let i = 0; i < 4; i++) {
		placeTile(tiles, 120 + i * 4, 44, {
			type: "pedestal",
			refId: "shop-shelf-" + (i + 1),
		});
		placeTile(tiles, 120 + i * 4, 50, {
			type: "pedestal",
			refId: "shop-shelf-" + (i + 5),
		});
	}
	placeTile(tiles, 118, 41, { type: "pedestal", refId: "shop-found-money" });
	placeTile(tiles, 135, 48, {
		type: "performer-station",
		refId: "shop-cashier",
		facing: "west",
	});
	placeTile(tiles, 127, 40, { type: "sign", refId: "shop-welcome" });

	wings.push({
		id: "gift-shop",
		name: "Gift Shop",
		bounds: { x: 116, y: 39, width: 22, height: 18 },
		theme: "retail",
	});
	performers.push({
		id: "shop-cashier",
		tileX: 135,
		tileY: 48,
		facing: "west",
		autoPlay: false,
	});
}

function buildEasterEggs(
	tiles: Map<string, MuseumTile>,
	wings: WingRegion[],
	exhibits: ExhibitDefinition[],
) {
	// ── VTG Wing (roped off) ──
	stampRoom(tiles, 30, 136, 18, 14, "stone");
	// Rope barrier between VTG and Digital Wing
	for (let y = 140; y <= 145; y++) {
		placeTile(tiles, 48, y, { type: "rope" });
		placeTile(tiles, 49, y, { type: "rope" });
	}
	// Scaffolding inside
	for (let x = 33; x < 45; x += 3) {
		for (let y = 139; y < 147; y += 3) {
			placeTile(tiles, x, y, { type: "scaffolding" });
		}
	}
	placeTile(tiles, 38, 137, { type: "sign", refId: "vtg-renovation" });
	placeTile(tiles, 36, 143, { type: "pedestal", refId: "vtg-dusty-1" });
	placeTile(tiles, 42, 143, { type: "pedestal", refId: "vtg-dusty-2" });

	wings.push({
		id: "vtg-wing",
		name: "The Vulcan Wing",
		bounds: { x: 30, y: 136, width: 18, height: 14 },
		theme: "construction",
	});
	exhibits.push({
		id: "vtg-renovation",
		tileX: 38,
		tileY: 137,
		plaque: {
			title: "THE VULCAN WING",
			subtitle: "Documenting the Oakland School, 1990s–Present",
			body: "NOTICE: This exhibit has been under renovation since 2024. We appreciate your patience. Estimated completion: [DATE NOT FOUND]. Visitors interested in the Vulcan notation tradition are encouraged to consult external resources.",
		},
	});

	// ── Corridor: Victorian → Construction Zone ──
	stampCorridor(tiles, 82, 186, 4, 9, "vertical", "dirt");
	carveDoor(tiles, 82, 186, 4, "horizontal");
	carveDoor(tiles, 82, 194, 4, "horizontal");

	// ── Construction Zone ──
	stampRoom(tiles, 74, 194, 16, 14, "dirt");
	carveDoor(tiles, 82, 194, 4, "horizontal"); // north door
	carveDoor(tiles, 89, 200, 2, "vertical"); // east door to Janitor's

	// Scaffolding
	for (let x = 77; x < 87; x += 3) {
		placeTile(tiles, x, 198, { type: "scaffolding" });
		placeTile(tiles, x, 203, { type: "scaffolding" });
	}
	placeTile(tiles, 80, 195, { type: "sign", refId: "cz-staff-only" });
	placeTile(tiles, 84, 200, { type: "pedestal", refId: "cz-unfinished-statue" });
	placeTile(tiles, 78, 196, { type: "sign", refId: "cz-coming-soon" });

	wings.push({
		id: "construction-zone",
		name: "Construction Zone",
		bounds: { x: 74, y: 194, width: 16, height: 14 },
		theme: "construction",
	});

	// ── Janitor's Closet ──
	stampRoom(tiles, 89, 197, 10, 8, "dirt");
	carveDoor(tiles, 89, 200, 2, "vertical"); // west door (shared wall)
	placeTile(tiles, 94, 198, { type: "torch" }); // bare bulb
	placeTile(tiles, 93, 201, { type: "pedestal", refId: "janitor-desk" });
	placeTile(tiles, 96, 198, {
		type: "exhibit-panel",
		refId: "janitor-whiteboard",
		facing: "south",
	});
	placeTile(tiles, 91, 200, {
		type: "exhibit-panel",
		refId: "janitor-mannequin",
		facing: "east",
	});

	wings.push({
		id: "janitor",
		name: "Janitor's Closet",
		bounds: { x: 89, y: 197, width: 10, height: 8 },
		theme: "construction",
	});
	exhibits.push(
		{
			id: "janitor-whiteboard",
			tileX: 96,
			tileY: 198,
			plaque: {
				title: "AUSTEN'S FAKE MUSEUM IDEAS",
				body: "- Cave wing with fake tablets (DONE)\n- Egyptian wing (TODO: need more hieroglyphs)\n- Gift shop w/ fake money mechanic\n- Statues of myself?? (too much?)\n- VTG wing (ask Noel first)\n- Three endings like Scrooge\n- Janitor's closet reveal (you are here)",
			},
		},
		{
			id: "janitor-mannequin",
			tileX: 91,
			tileY: 200,
			plaque: {
				title: "Mannequin",
				body: "A department store mannequin with a photograph of a face taped to it. The photograph is slightly askew. The wig is worse.",
			},
		},
	);
}

// ── Main Builder ──

export function buildFullMuseum(): MuseumGrid {
	const tiles = new Map<string, MuseumTile>();
	const wings: WingRegion[] = [];
	const exhibits: ExhibitDefinition[] = [];
	const performers: PerformerDefinition[] = [];
	const triggers: TriggerDefinition[] = [];

	buildEntrance(tiles, wings, exhibits);
	buildVulcanCave(tiles, wings, exhibits, performers);
	buildEgyptianWing(tiles, wings, exhibits);
	buildRenaissanceWing(tiles, wings, exhibits);
	buildVictorianWing(tiles, wings, exhibits);
	buildDigitalWing(tiles, wings, exhibits);
	buildSuppression(tiles, wings, exhibits);
	buildCrumble(tiles, wings);
	buildKGallery(tiles, wings, exhibits, performers);
	buildEndingRooms(tiles, wings, exhibits, performers, triggers);
	buildEasterEggs(tiles, wings, exhibits);

	return {
		width: 150,
		height: 220,
		tileScale: 0.5,
		tiles,
		wings,
		spawn: { x: 80, y: 210, facing: "north" as Direction },
		exhibits,
		performers,
		triggers,
		furniture: [],
	};
}
