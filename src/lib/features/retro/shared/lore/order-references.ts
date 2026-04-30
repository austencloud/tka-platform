/**
 * Lore text fragments keyed by era and context.
 * Each era pulls its own flavor of Order/Scribe references.
 */

import type { RetroEra } from "../domain/era-types";

export type LoreContext =
	| "about"
	| "readme"
	| "help"
	| "error"
	| "register"
	| "startup"
	| "shutdown"
	| "easteregg";

const LORE_ENTRIES: Record<RetroEra, Partial<Record<LoreContext, string[]>>> = {
	dos: {
		about: [
			"TKAUTIL.COM v1.0 - Bellweather Technical Institute",
			"Property of the Bellweather Technical Institute. All rights reserved.",
			"Authorized under Order Directive 7, Section 12.",
		],
		readme: [
			"CLASSIFIED - CLEARANCE LEVEL 3 REQUIRED",
			"This software is distributed under Order Directive 7.",
			"Unauthorized duplication is a violation of Institute Policy.",
		],
		error: [
			"ERROR: Operation not permitted. Contact your Bellweather administrator.",
			"ACCESS DENIED - CLEARANCE LEVEL INSUFFICIENT",
			"FATAL: Order compliance module not found. Contact Bellweather support.",
		],
		register: [
			"Enter your Bellweather-issued serial number.",
			"Serial numbers are distributed via secure courier only.",
			"If you do not have a serial number, contact your Order liaison.",
		],
		startup: [
			"BELLWEATHER TECHNICAL INSTITUTE",
			"TKAUTIL.COM - Notation Utility v1.0",
			"ORDER DIRECTIVE 7 COMPLIANCE CHECK... PASSED",
		],
	},

	win95: {
		about: [
			"TKA-OS v1.0 - Bellweather Technical Institute",
			"Licensed to: [ORDER MEMBER]",
			"Product ID: 7734-OEM-0019950-00001",
		],
		readme: [
			"Welcome to TKA-OS v1.0",
			"This software is the property of the Bellweather Technical Institute.",
			"Please direct all inquiries to your regional Order representative.",
		],
		error: [
			"A fatal exception KE has occurred at 0028:C0011995",
			"KINETIC_OVERFLOW - Too much spin detected.",
			"The prop physics engine has exceeded maximum angular velocity.",
		],
		register: [
			"This is an unregistered copy of TKA-OS.",
			"Please send $29.95 to Bellweather Technical Institute.",
			"P.O. Box [REDACTED], [REDACTED], MA [REDACTED]",
		],
	},

	win98: {
		about: [
			"TKA Composer 98 - Free Scribe Collective Edition",
			"Maintained by the Free Scribe Collective.",
			"The Order doesn't want you to have this.",
		],
		readme: [
			"If you're reading this, congratulations. You found it.",
			"This software was rebuilt from a leaked Bellweather source disk.",
			"The Order tried to suppress this knowledge. We said no.",
		],
		error: [
			"Error 0x1997: Floppy disk not found (it's safe, don't worry)",
			"The Order's DRM module has been removed. You're welcome.",
			"Connection to Bellweather servers refused. As intended.",
		],
		register: [
			"This software is FREE. As in freedom.",
			"No serial numbers. No Order liaisons. No compliance checks.",
			"If someone asks you to register, they're not one of us.",
		],
		easteregg: [
			"The floppy is still out there. So are we.",
			"Bellweather Employee #4271 - we remember what you did.",
			"You can't classify an alphabet. Letters belong to everyone.",
		],
	},

	winxp: {
		about: [
			"TKA Composer XP - Open Source Community Edition v3.2.1",
			"Contributors: 47 | Downloads: 12,841 | Forks: 23",
			"Licensed under the Free Notation Public License (FNPL)",
		],
		readme: [
			"Welcome to the TKA Composer project.",
			"This started as a leaked Bellweather utility in 1997.",
			"Six years and 47 contributors later, the notation is free.",
		],
		error: [
			"WARNING: Network anomaly detected in sector 7-G",
			"File integrity check failed - possible external tampering",
			"Connection to SourceForge mirror lost. Retrying...",
		],
		shutdown: [
			"Saving session state...",
			"WARNING: Unusual network activity detected.",
			"They're here. Sending what I can. Remember us.",
		],
		easteregg: [
			"If you find this after the wipe, know that we tried.",
			"The notation is in the movement, not the software.",
			"47 contributors. 12,841 downloads. They can't erase all of us.",
		],
	},
};

/**
 * Get a random lore string for the given era and context.
 * Returns an empty string if no content exists for this combination.
 */
export function getLore(era: RetroEra, context: LoreContext): string {
	const entries = LORE_ENTRIES[era]?.[context];
	if (!entries || entries.length === 0) return "";
	return entries[Math.floor(Math.random() * entries.length)] ?? "";
}

/**
 * Get all lore entries for a specific era and context.
 */
export function getAllLore(era: RetroEra, context: LoreContext): string[] {
	return LORE_ENTRIES[era]?.[context] ?? [];
}
