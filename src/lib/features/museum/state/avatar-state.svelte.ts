/**
 * Avatar Config State
 *
 * Stores the player's chosen skin tone, hair color, and jacket color.
 * Persisted to localStorage so it survives across sessions.
 */

const STORAGE_KEY = "museum-avatar-config";

export interface AvatarConfig {
	skinColor: string;
	hairColor: string;
	jacketColors: [string, string]; // gradient top, bottom
}

const DEFAULT_CONFIG: AvatarConfig = {
	skinColor: "#d4a574",
	hairColor: "#1a0a00",
	jacketColors: ["#4a7aaa", "#3a6a9a"],
};

export const SKIN_OPTIONS = [
	"#f5d0b0",
	"#e0b88a",
	"#d4a574",
	"#a0724a",
	"#7a5230",
	"#4a3020",
];

export const HAIR_OPTIONS = [
	"#1a0a00",
	"#5a3010",
	"#c8a040",
	"#8a2010",
	"#888888",
	"#e8e0d8",
	"linear-gradient(135deg, #4a90c0, #c050a0)",
];

export const JACKET_OPTIONS: [string, string][] = [
	["#4a7aaa", "#3a6a9a"],
	["#2a2a32", "#1a1a24"],
	["#7a5a30", "#6a4a28"],
	["#3a6a4a", "#2a5a3a"],
	["#8a3030", "#7a2020"],
	["#6a4a8a", "#5a3a7a"],
	["#c8a040", "#b89030"],
];

function loadConfig(): AvatarConfig {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (parsed.skinColor && parsed.hairColor && parsed.jacketColors) {
				return parsed;
			}
		}
	} catch {
		// ignore parse errors
	}
	return { ...DEFAULT_CONFIG };
}

function saveConfig(config: AvatarConfig): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		// ignore storage errors
	}
}

export function createAvatarState() {
	let config = $state<AvatarConfig>(loadConfig());
	let hasChosen = $state(localStorage.getItem(STORAGE_KEY) !== null);

	function setSkin(color: string) {
		config = { ...config, skinColor: color };
		saveConfig(config);
	}

	function setHair(color: string) {
		config = { ...config, hairColor: color };
		saveConfig(config);
	}

	function setJacket(colors: [string, string]) {
		config = { ...config, jacketColors: colors };
		saveConfig(config);
	}

	function markChosen() {
		hasChosen = true;
		saveConfig(config);
	}

	/**
	 * Compute a darker variant of a hex color for the skin gradient.
	 */
	function skinDark(): string {
		const hex = config.skinColor.replace("#", "");
		const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 40);
		const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 40);
		const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 40);
		return `rgb(${r},${g},${b})`;
	}

	return {
		get config() { return config; },
		get hasChosen() { return hasChosen; },
		get skinGradient() {
			return `radial-gradient(circle at 40% 35%, ${config.skinColor}, ${skinDark()})`;
		},
		get jacketGradient() {
			return `linear-gradient(180deg, ${config.jacketColors[0]}, ${config.jacketColors[1]})`;
		},
		setSkin,
		setHair,
		setJacket,
		markChosen,
	};
}

export type AvatarState = ReturnType<typeof createAvatarState>;
