import { VISITOR_SPECIES, type FishSpeciesConfig } from './fish-species-config';

export interface SlotAllocation {
	startIndex: number;
	count: number;
}

export interface VisitorGroup {
	species: FishSpeciesConfig[];
	slots: SlotAllocation;
	remainingTime: number;
	entryAngle: number;
	exitAngle: number;
}

interface VisitorPattern {
	name: string;
	speciesNames: string[];
	duration: number;
	cooldownMin: number;
	cooldownMax: number;
}

const VISITOR_PATTERNS: VisitorPattern[] = [
	{ name: 'Sardine Ball', speciesNames: ['European Sardine'], duration: 45, cooldownMin: 60, cooldownMax: 120 },
	{ name: 'Tuna Run', speciesNames: ['Yellowfin Tuna', 'Skipjack Tuna'], duration: 30, cooldownMin: 90, cooldownMax: 180 },
	{ name: 'Barracuda Patrol', speciesNames: ['Great Barracuda'], duration: 30, cooldownMin: 120, cooldownMax: 240 },
	{ name: 'Mackerel School', speciesNames: ['Atlantic Mackerel'], duration: 45, cooldownMin: 90, cooldownMax: 120 },
	{ name: 'Grouper Ambush', speciesNames: ['Goliath Grouper'], duration: 60, cooldownMin: 180, cooldownMax: 300 },
	{ name: 'Deep Water Pass', speciesNames: ['Atlantic Cod', 'Haddock', 'European Hake'], duration: 90, cooldownMin: 120, cooldownMax: 240 },
];

export class SpeciesRotationManager {
	readonly maxSlots: number;
	readonly residentCount: number;
	private nextFreeSlot: number;
	private freeRanges: SlotAllocation[] = [];
	private _activeGroups: VisitorGroup[] = [];
	private spawnCooldown = 30 + Math.random() * 30;

	constructor(maxSlots: number, residentCount: number) {
		this.maxSlots = maxSlots;
		this.residentCount = residentCount;
		this.nextFreeSlot = residentCount;
	}

	get activeGroups(): VisitorGroup[] {
		return this._activeGroups;
	}

	allocateSlots(count: number): SlotAllocation | null {
		for (let i = 0; i < this.freeRanges.length; i++) {
			const range = this.freeRanges[i]!;
			if (range.count >= count) {
				const alloc: SlotAllocation = { startIndex: range.startIndex, count };
				range.startIndex += count;
				range.count -= count;
				if (range.count === 0) this.freeRanges.splice(i, 1);
				return alloc;
			}
		}

		if (this.nextFreeSlot + count <= this.maxSlots) {
			const alloc: SlotAllocation = { startIndex: this.nextFreeSlot, count };
			this.nextFreeSlot += count;
			return alloc;
		}

		return null;
	}

	releaseSlots(alloc: SlotAllocation): void {
		this.freeRanges.push({ ...alloc });
		this.freeRanges.sort((a, b) => a.startIndex - b.startIndex);

		const merged: SlotAllocation[] = [];
		for (const r of this.freeRanges) {
			const prev = merged[merged.length - 1];
			if (prev && prev.startIndex + prev.count === r.startIndex) {
				prev.count += r.count;
			} else {
				merged.push({ ...r });
			}
		}
		this.freeRanges = merged;

		while (this.freeRanges.length > 0) {
			const last = this.freeRanges[this.freeRanges.length - 1]!;
			if (last.startIndex + last.count === this.nextFreeSlot) {
				this.nextFreeSlot = last.startIndex;
				this.freeRanges.pop();
			} else break;
		}
	}

	tick(dt: number): VisitorGroup | null {
		for (let i = this._activeGroups.length - 1; i >= 0; i--) {
			this._activeGroups[i]!.remainingTime -= dt;
			if (this._activeGroups[i]!.remainingTime <= 0) {
				const expired = this._activeGroups.splice(i, 1)[0]!;
				this.releaseSlots(expired.slots);
			}
		}

		this.spawnCooldown -= dt;
		if (this.spawnCooldown > 0 || this._activeGroups.length >= 3) return null;

		const pattern = VISITOR_PATTERNS[Math.floor(Math.random() * VISITOR_PATTERNS.length)]!;
		this.spawnCooldown = pattern.cooldownMin + Math.random() * (pattern.cooldownMax - pattern.cooldownMin);

		const species = pattern.speciesNames
			.map((name) => VISITOR_SPECIES.find((s) => s.name === name))
			.filter((s): s is FishSpeciesConfig => s !== undefined);

		if (species.length === 0) return null;

		const totalCount = species.reduce((sum, sp) => sum + sp.instanceCount, 0);
		const slots = this.allocateSlots(totalCount);
		if (!slots) return null;

		const entryAngle = Math.random() * Math.PI * 2;
		const group: VisitorGroup = {
			species,
			slots,
			remainingTime: pattern.duration,
			entryAngle,
			exitAngle: entryAngle + Math.PI,
		};

		this._activeGroups.push(group);
		return group;
	}
}
