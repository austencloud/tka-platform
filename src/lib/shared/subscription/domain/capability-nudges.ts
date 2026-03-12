import type { NudgeConfig } from "../services/contracts/IPremiumGateChecker";

export const CAPABILITY_NUDGES: Record<string, NudgeConfig> = {
	"capability:export:effects": {
		capability: "capability:export:effects",
		description: "Export with effects",
		premiumBenefit: "Effects and efforts applied to your exports",
	},
	"capability:export:custom-duration": {
		capability: "capability:export:custom-duration",
		description: "Export with custom duration",
		premiumBenefit: "Set any duration for your exported animations",
	},
	"capability:export:composition": {
		capability: "capability:export:composition",
		description: "Export compositions",
		premiumBenefit: "Export your composed arrangements as video",
	},
	"capability:learn:full-curriculum": {
		capability: "capability:learn:full-curriculum",
		description: "Full curriculum access",
		premiumBenefit: "All lessons and learning paths",
	},
	"capability:props:premium-cosmetics": {
		capability: "capability:props:premium-cosmetics",
		description: "Premium props",
		premiumBenefit: "Lightsabers and other fun prop styles",
	},
};
