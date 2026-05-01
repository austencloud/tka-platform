/**
 * Definition Lookup
 *
 * Functions for retrieving CAP definitions by scope or ID.
 */

import type { CAPDefinition, CAPDefinitionScope } from "../data/definitions.js";
import { CAP_DEFINITIONS } from "../data/definitions.js";

export function getCAPDefinition(id: string): CAPDefinition | undefined {
	return CAP_DEFINITIONS.find((d) => d.id === id);
}

export function listCAPDefinitions(
	scope?: CAPDefinitionScope,
): CAPDefinition[] {
	if (!scope) return [...CAP_DEFINITIONS];
	return CAP_DEFINITIONS.filter((d) => d.scope === scope);
}
