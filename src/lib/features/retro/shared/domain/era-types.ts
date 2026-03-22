/**
 * Era definitions for the multi-era retro system.
 * Each era has a route, a year, and a display identity.
 */

/** The available retro eras */
export type RetroEra = "dos" | "win95" | "win98" | "winxp";

/** Configuration for each era */
export interface RetroEraConfig {
	id: RetroEra;
	year: number;
	route: string;
	title: string;
	subtitle: string;
	loreAuthor: string;
}

/** All era configurations */
export const ERA_CONFIGS: Record<RetroEra, RetroEraConfig> = {
	dos: {
		id: "dos",
		year: 1989,
		route: "/1989",
		title: "TKAUTIL.COM",
		subtitle: "Bellweather Technical Institute, Notation Utility v1.0",
		loreAuthor: "Bellweather Technical Institute",
	},
	win95: {
		id: "win95",
		year: 1995,
		route: "/1995",
		title: "TKA-OS v1.0",
		subtitle: "Bellweather Technical Institute, For Windows 95",
		loreAuthor: "Bellweather Technical Institute",
	},
	win98: {
		id: "win98",
		year: 1998,
		route: "/1998",
		title: "TKA Composer 98",
		subtitle: "Free Scribe Collective Edition",
		loreAuthor: "The Free Scribe Collective",
	},
	winxp: {
		id: "winxp",
		year: 2003,
		route: "/2003",
		title: "TKA Composer XP",
		subtitle: "Open Source Community Edition",
		loreAuthor: "TKA Open Source Project",
	},
};

/** Routes that bypass the main app initialization */
export const RETRO_ROUTES = Object.values(ERA_CONFIGS).map((c) => c.route);
