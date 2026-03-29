/**
 * Museum Wing Soundscape Manifest
 *
 * Maps each museum wing to its ambient audio file, source attribution,
 * and default volume. Audio files are not included in the repo -- download
 * them from the URLs listed in each entry's `sourceUrl` field and save
 * them to this directory with the filename in `file`.
 *
 * All recommended sounds are CC0 (public domain) or CC-BY (attribution
 * required, noted in `license`). No NonCommercial restrictions.
 */

export interface WingSoundscape {
	wingId: string;
	wingName: string;
	file: string;
	sourceUrl: string;
	attribution: string;
	license: "CC0" | "CC-BY-4.0";
	duration: string;
	volume: number;
	notes: string;
}

export const WING_SOUNDSCAPES: WingSoundscape[] = [
	// ── Entrance Lobby ──
	// Quiet institutional hum. Distant echo. Large empty building.
	{
		wingId: "entrance",
		wingName: "Entrance Lobby",
		file: "entrance-ambient.wav",
		sourceUrl: "https://freesound.org/people/richwise/sounds/456207/",
		attribution: "richwise (Freesound)",
		license: "CC0",
		duration: "7:52",
		volume: 0.3,
		notes:
			"Empty Office Room Tone -- faint fan noise with a barely-perceptible beep every few seconds. " +
			"Captures the institutional emptiness. 48kHz/32-bit WAV, 172MB -- convert to MP3 to reduce size.",
	},

	// ── Vulcan Cave ──
	// Dripping water, distant echoes, cave acoustics.
	{
		wingId: "vulcan-cave",
		wingName: "Vulcan Cave",
		file: "cave-ambient.wav",
		sourceUrl: "https://freesound.org/people/Sclolex/sounds/177958/",
		attribution: "Sclolex (Freesound)",
		license: "CC0",
		duration: "1:30",
		volume: 0.5,
		notes:
			"Water Dripping in Cave -- highly processed recording with ambient cave reverb. " +
			"48kHz stereo, 16.4MB. Loops well.",
	},

	// ── Egyptian Wing ──
	// Soft wind, warm resonance. Desert temple atmosphere.
	{
		wingId: "egyptian",
		wingName: "Egyptian Wing",
		file: "egyptian-ambient.wav",
		sourceUrl: "https://freesound.org/people/dhallcomposer/sounds/697217/",
		attribution: "dhallcomposer (Freesound)",
		license: "CC0",
		duration: "0:41",
		volume: 0.35,
		notes:
			"Looping Gentle Wind Ambience on an Open Desert Plain -- evokes wide empty space " +
			"with reverb and stereo delay. Lonely and warm. Loops seamlessly.",
	},

	// ── Renaissance Wing ──
	// Quill scratching, paper rustling, contemplative quiet.
	{
		wingId: "renaissance",
		wingName: "Renaissance Wing",
		file: "renaissance-ambient.wav",
		sourceUrl: "https://freesound.org/people/OwlStorm/sounds/320151/",
		attribution: "OwlStorm / Ashe Kirk (Freesound)",
		license: "CC0",
		duration: "0:30",
		volume: 0.25,
		notes:
			"Pencil Scratch 1 -- pencil scribbling on cardboard. Layer with paper rustling " +
			"(see secondary below) for the full renaissance study atmosphere. 44.1kHz stereo.",
	},

	// ── Victorian Wing ──
	// Ticking, mechanical sounds, clockwork. Gas lamp hiss.
	{
		wingId: "victorian",
		wingName: "Victorian Wing",
		file: "victorian-ambient.mp3",
		sourceUrl: "https://pixabay.com/sound-effects/search/clockwork/",
		attribution: "Pixabay Content License (royalty-free, no attribution required)",
		license: "CC0",
		duration: "varies",
		volume: 0.35,
		notes:
			"MANUAL DOWNLOAD NEEDED: Go to Pixabay clockwork search page and pick a " +
			"ticking/clockwork ambient loop (30s+). Good candidates: 'Clock Ticking Ambience', " +
			"'Clockwork Pocketwatch'. Also search 'steampunk ambient' on Pixabay. " +
			"Pixabay license is effectively CC0 for sound effects.",
	},

	// ── Digital Wing ──
	// Dial-up modem, keyboard clicks, CRT hum. 1990s tech.
	{
		wingId: "digital",
		wingName: "Digital Wing",
		file: "digital-ambient.wav",
		sourceUrl: "https://freesound.org/people/wtermini/sounds/546450/",
		attribution: "wtermini (Freesound)",
		license: "CC0",
		duration: "0:29",
		volume: 0.3,
		notes:
			"The Sound of dial-up Internet -- authentic 2008 iMac G3 modem connection recording. " +
			"Layer with the aircon hum (TimBahrij/234918, CC0) for persistent CRT background drone.",
	},

	// ── The Suppression ──
	// Distant hold music, paper shuffling, fax hum, fluorescent buzz.
	{
		wingId: "suppression",
		wingName: "The Suppression",
		file: "suppression-ambient.mp3",
		sourceUrl: "https://freesound.org/people/Rvgerxini/sounds/474312/",
		attribution: "Rvgerxini (Freesound)",
		license: "CC0",
		duration: "0:04",
		volume: 0.4,
		notes:
			"Fluorescent light buzzing -- very short, MUST be looped programmatically. " +
			"Layer with shuffling papers (bevibeldesign/635156, CC0, 11s) for the full " +
			"bureaucratic dread atmosphere. Consider also adding distant hold music from Pixabay.",
	},

	// ── The Crumble ──
	// Creaking, dripping, wind through broken windows. Abandonment.
	{
		wingId: "crumble",
		wingName: "The Crumble",
		file: "crumble-ambient.wav",
		sourceUrl: "https://freesound.org/people/pfranzen/sounds/393808/",
		attribution: "pfranzen (Freesound)",
		license: "CC-BY-4.0",
		duration: "4:07",
		volume: 0.4,
		notes:
			"Windy, creaky old house ambience -- wind and creaking wood elements. " +
			"Created for an FMV game. Long enough to avoid obvious repetition. " +
			"Attribution required: credit pfranzen.",
	},

	// ── K's Gallery ──
	// Gentle ambient. Soft music box in the distance. Warmth.
	{
		wingId: "gallery",
		wingName: "K's Gallery",
		file: "gallery-ambient.wav",
		sourceUrl: "https://freesound.org/people/DRFX/sounds/338986/",
		attribution: "DRFX (Freesound)",
		license: "CC0",
		duration: "0:16",
		volume: 0.2,
		notes:
			"Music Box Melody 1 -- gentle, loopable music box melody. Short (16s) but designed to loop. " +
			"Play at low volume for distant warmth. Created in FL Studio with DSK Music Box VST.",
	},

	// ── Room of Fear ──
	// Low drone, distant stamping, oppressive.
	{
		wingId: "fear",
		wingName: "Room of Fear",
		file: "fear-ambient.wav",
		sourceUrl: "https://freesound.org/people/bassimat/sounds/840934/",
		attribution: "bassimat (Freesound)",
		license: "CC0",
		duration: "10:08",
		volume: 0.45,
		notes:
			"Quasi Drone -- slowly evolving dual-drone texture with gentle beating and subtle tension. " +
			"Two oscillators tuned slightly apart, panned opposite in stereo. 10 minutes long. " +
			"Deeply unsettling at higher volumes.",
	},

	// ── Room of Isolation ──
	// Muffled sounds through walls. Managed aloneness.
	{
		wingId: "isolation",
		wingName: "Room of Isolation",
		file: "isolation-ambient.wav",
		sourceUrl: "https://freesound.org/people/TimBahrij/sounds/234918/",
		attribution: "TimBahrij (Freesound)",
		license: "CC0",
		duration: "0:58",
		volume: 0.2,
		notes:
			"Ambient low hum (aircon) -- soft, droning hum that evokes being sealed in a small space " +
			"with climate control. Apply low-pass filter programmatically to simulate sounds " +
			"heard through walls. 96kHz/24-bit recording.",
	},

	// ── Room of Collaboration ──
	// Birds chirping, wind in trees, distant laughter, warmth.
	{
		wingId: "collaboration",
		wingName: "Room of Collaboration",
		file: "collaboration-ambient.wav",
		sourceUrl: "https://freesound.org/people/Magnesus/sounds/723913/",
		attribution: "Magnesus (Freesound)",
		license: "CC0",
		duration: "0:27",
		volume: 0.5,
		notes:
			"Forest birds -- ambient seamless loop recorded in a Polish forest. " +
			"Crafted to loop perfectly. Bright and alive. Add distant laughter from Pixabay if desired.",
	},

	// ── Gift Shop ──
	// Generic muzak, cash register, bright commercial.
	{
		wingId: "gift-shop",
		wingName: "Gift Shop",
		file: "giftshop-ambient.mp3",
		sourceUrl: "https://pixabay.com/music/search/muzak/",
		attribution: "Pixabay Content License (royalty-free, no attribution required)",
		license: "CC0",
		duration: "varies",
		volume: 0.3,
		notes:
			"MANUAL DOWNLOAD NEEDED: Go to Pixabay muzak search and pick a cheesy elevator music loop. " +
			"Good candidates: 'Muzak Elevator', 'Muzak Grocery Store'. " +
			"The more generic and soulless, the better for the gift shop atmosphere.",
	},

	// ── VTG Wing ──
	// Silence with occasional construction sounds. Distant hammering.
	{
		wingId: "vtg-wing",
		wingName: "The Vulcan Wing",
		file: "vtg-ambient.wav",
		sourceUrl: "https://freesound.org/people/Electroviolence/sounds/234554/",
		attribution: "Electroviolence (Freesound)",
		license: "CC0",
		duration: "0:33",
		volume: 0.15,
		notes:
			"Dripping water cave soundscape -- repurposed at very low volume to suggest " +
			"an unfinished space with exposed pipes. The occasional drip punctuates silence. " +
			"Alternative: search Pixabay for 'construction ambient distant' for hammering sounds.",
	},

	// ── Construction Zone ──
	// Work lights buzzing, metallic clang, empty space echo.
	{
		wingId: "construction-zone",
		wingName: "Construction Zone",
		file: "construction-ambient.mp3",
		sourceUrl: "https://freesound.org/people/Rvgerxini/sounds/474312/",
		attribution: "Rvgerxini (Freesound)",
		license: "CC0",
		duration: "0:04",
		volume: 0.35,
		notes:
			"Fluorescent light buzzing -- same source as Suppression but played differently. " +
			"Loop this as the work light buzz. Layer with occasional metallic clangs from Pixabay " +
			"(search 'metallic clang construction'). The 4-second loop creates relentless drone.",
	},

	// ── Janitor's Closet ──
	// Muffled museum sounds, single bulb hum. Intimate.
	{
		wingId: "janitor",
		wingName: "Janitor's Closet",
		file: "janitor-ambient.wav",
		sourceUrl: "https://freesound.org/people/TimBahrij/sounds/234918/",
		attribution: "TimBahrij (Freesound)",
		license: "CC0",
		duration: "0:58",
		volume: 0.15,
		notes:
			"Ambient low hum (aircon) -- same file as Isolation but at even lower volume " +
			"with different EQ. Apply heavy low-pass filter + slight pitch shift to differentiate. " +
			"The intimacy comes from the volume and muffled quality.",
	},
];

// ── Secondary / Layering Sounds ──
// These can be layered with the primary sounds above for richer atmospheres.

export interface LayerSound {
	id: string;
	sourceUrl: string;
	attribution: string;
	license: "CC0" | "CC-BY-4.0";
	duration: string;
	suggestedFor: string[];
	notes: string;
}

export const LAYER_SOUNDS: LayerSound[] = [
	{
		id: "paper-rustling",
		sourceUrl: "https://freesound.org/people/HarpyHarpHarp/sounds/449127/",
		attribution: "HarpyHarpHarp (Freesound)",
		license: "CC0",
		duration: "0:06",
		suggestedFor: ["renaissance", "suppression"],
		notes: "Rustling Paper -- page turning / paper manipulation. Layer with pencil scratch for renaissance.",
	},
	{
		id: "paper-shuffling",
		sourceUrl: "https://freesound.org/people/bevibeldesign/sounds/635156/",
		attribution: "bevibeldesign (Freesound)",
		license: "CC0",
		duration: "0:11",
		suggestedFor: ["suppression"],
		notes: "Shuffling papers -- dramatic paper shuffle. Layer with fluorescent buzz for bureaucratic dread.",
	},
	{
		id: "aircon-hum",
		sourceUrl: "https://freesound.org/people/TimBahrij/sounds/234918/",
		attribution: "TimBahrij (Freesound)",
		license: "CC0",
		duration: "0:58",
		suggestedFor: ["digital", "suppression"],
		notes: "Ambient low hum -- persistent background drone. Good CRT / office HVAC stand-in.",
	},
	{
		id: "cave-drip-alt",
		sourceUrl: "https://freesound.org/people/Electroviolence/sounds/234554/",
		attribution: "Electroviolence (Freesound)",
		license: "CC0",
		duration: "0:33",
		suggestedFor: ["vulcan-cave", "crumble"],
		notes: "Dripping water cave soundscape. Alternative/supplement to the Sclolex recording.",
	},
	{
		id: "sci-fi-drone",
		sourceUrl: "https://freesound.org/people/LookIMadeAThing/sounds/534018/",
		attribution: "LookIMadeAThing (Freesound)",
		license: "CC0",
		duration: "2:45",
		suggestedFor: ["fear", "suppression"],
		notes: "Sci-fi Ambient Drone -- harsh electric artifacts from time-stretched drum loop. Deeply unsettling.",
	},
	{
		id: "piano-ambiance",
		sourceUrl: "https://freesound.org/people/Erokia/sounds/387588/",
		attribution: "Erokia (Freesound)",
		license: "CC0",
		duration: "0:08",
		suggestedFor: ["gallery"],
		notes: "Ambient Piano Loop -- warm 8-second piano loop. Alternative to music box for K's Gallery.",
	},
	{
		id: "modem-sounds",
		sourceUrl: "https://freesound.org/people/joedeshon/sounds/80288/",
		attribution: "joedeshon (Freesound)",
		license: "CC-BY-4.0",
		duration: "0:35",
		suggestedFor: ["digital"],
		notes:
			"Analog modem sounds -- dial tone, DTMF, connection noise. CC-BY (credit joedeshon). " +
			"Layer with dial-up internet (wtermini) for richer digital wing ambience.",
	},
];

// ── Download Helper ──
// Freesound requires login to download. Pixabay allows direct download.
// For Freesound CC0 sounds, you can also try:
//   https://freesound.org/people/{user}/sounds/{id}/download/{id}___{filename}/
// but this typically requires authentication.
//
// Recommended workflow:
// 1. Visit each sourceUrl in a browser
// 2. Download the file (create free Freesound account if needed)
// 3. Convert WAV files > 2MB to MP3 (128-192kbps) using ffmpeg:
//    ffmpeg -i input.wav -codec:a libmp3lame -b:a 192k output.mp3
// 4. Rename to the `file` field value
// 5. Place in this directory (src/lib/features/museum-2d/audio/)

export function getSoundscapeForWing(wingId: string): WingSoundscape | undefined {
	return WING_SOUNDSCAPES.find((s) => s.wingId === wingId);
}

export function getLayersForWing(wingId: string): LayerSound[] {
	return LAYER_SOUNDS.filter((l) => l.suggestedFor.includes(wingId));
}
