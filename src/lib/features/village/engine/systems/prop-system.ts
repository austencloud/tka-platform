import type { World } from "miniplex";
import type {
	VillageEntity,
	DroppedProp,
	PropArtifact,
} from "../../domain/village-types";
import type { VillageEventEmitter } from "../village-event-emitter";
import {
	MAKER_CRAFT_DURATION,
	PROP_WEAR_PROFILES,
	PROP_WEAR_LIFESPAN,
	PROP_WALL_MAX_DISPLAY,
} from "../../domain/village-constants";

const PICKUP_RADIUS = 1.5;

export class PropSystem {
	droppedProps: DroppedProp[] = [];
	propWall: PropArtifact[] = [];

	constructor(private emitter: VillageEventEmitter) {
		this.emitter.on("entity:died", (entity) => this.onEntityDied(entity));
	}

	tick(world: World<VillageEntity>, currentTick: number): void {
		this.accumulateWear(world, currentTick);
		this.handlePickups(world, currentTick);
		this.handleCrafting(world, currentTick);
	}

	onEntityDied(entity: VillageEntity): void {
		if (!entity.prop.heldProp || entity.prop.heldProp.broken) return;

		const artifact = entity.prop.heldProp;
		this.droppedProps.push({
			artifact,
			x: entity.transform.x,
			z: entity.transform.z,
			droppedAtTick: 0,
		});
		this.emitter.emit(
			"prop:dropped",
			artifact,
			entity.transform.x,
			entity.transform.z,
		);
	}

	private accumulateWear(
		world: World<VillageEntity>,
		_currentTick: number,
	): void {
		for (const entity of world.entities) {
			if (!entity.prop.heldProp || entity.prop.heldProp.broken) continue;

			const isActive =
				entity.social.state === "performing" ||
				entity.social.state === "practicing" ||
				entity.social.state === "teaching" ||
				entity.social.state === "jamming";

			if (!isActive) continue;

			const prop = entity.prop.heldProp;
			const profile = PROP_WEAR_PROFILES[prop.propType];
			const wearRate = profile?.wearRate ?? 1 / PROP_WEAR_LIFESPAN;

			prop.totalStepsPerformed++;
			prop.wear = Math.min(1.5, prop.wear + wearRate);

			// Track favorite sequence
			const performingSeq =
				entity.social.performingSequenceId ??
				entity.social.sequenceBeingTransferred;
			if (performingSeq) {
				prop.favoriteSequenceId = performingSeq;
			}

			// Prop breaks
			if (prop.wear >= 1.0) {
				prop.broken = true;
				this.propWall.push(prop);
				if (this.propWall.length > PROP_WALL_MAX_DISPLAY) {
					this.propWall.shift();
				}
				this.emitter.emit("prop:broken", entity, prop);
				entity.prop.heldProp = null;
			}
		}
	}

	private handlePickups(
		world: World<VillageEntity>,
		_currentTick: number,
	): void {
		const remainingDrops: DroppedProp[] = [];

		for (const drop of this.droppedProps) {
			let pickedUp = false;

			for (const entity of world.entities) {
				if (entity.social.state === "passing") continue;
				if (entity.prop.heldProp !== null) continue;

				const dx = entity.transform.x - drop.x;
				const dz = entity.transform.z - drop.z;
				const dist = Math.sqrt(dx * dx + dz * dz);

				if (dist <= PICKUP_RADIUS) {
					entity.prop.heldProp = drop.artifact;
					drop.artifact.ownershipChain.push(entity.id);
					this.emitter.emit("prop:pickedUp", entity, drop.artifact);
					pickedUp = true;
					break;
				}
			}

			if (!pickedUp) {
				remainingDrops.push(drop);
			}
		}

		this.droppedProps = remainingDrops;
	}

	private handleCrafting(world: World<VillageEntity>, currentTick: number): void {
		const maker = world.entities.find(
			(e) => e.identity.role === "maker" && e.social.state !== "passing",
		);
		if (!maker) return;

		// Propless entities near the maker enter commissioning state
		for (const entity of world.entities) {
			if (entity.prop.heldProp !== null) continue;
			if (entity.identity.role === "maker") continue;
			if (entity.social.state === "passing" || entity.social.state === "commissioning") continue;

			const dx = entity.transform.x - maker.transform.x;
			const dz = entity.transform.z - maker.transform.z;
			const dist = Math.sqrt(dx * dx + dz * dz);

			if (dist <= 2.0) {
				entity.social.state = "commissioning";
				entity.social.partner = maker.id;
				entity.social.idleTimer = 0;
				entity.transform.speed = 0;
			}
		}

		// Check for craft completion - entity has waited long enough
		for (const entity of world.entities) {
			if (entity.social.state !== "commissioning") continue;
			if (entity.social.idleTimer < MAKER_CRAFT_DURATION) continue;

			const newProp: PropArtifact = {
				id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				propType: entity.prop.propPreference,
				createdAtTick: currentTick,
				createdBy: maker.id,
				ownershipChain: [entity.id],
				totalStepsPerformed: 0,
				wear: 0,
				favoriteSequenceId: null,
				customHue: Math.floor(Math.random() * 360),
				broken: false,
			};
			entity.prop.heldProp = newProp;
			entity.social.state = "idle";
			entity.social.partner = null;
			entity.social.idleTimer = 0;
			this.emitter.emit("prop:crafted", maker, newProp);
		}

		// Propless entities pathfind toward maker
		for (const entity of world.entities) {
			if (entity.prop.heldProp !== null) continue;
			if (entity.identity.role === "maker") continue;
			if (entity.social.state === "commissioning" || entity.social.state === "passing") continue;

			entity.transform.targetX = maker.transform.x;
			entity.transform.targetZ = maker.transform.z;
			entity.transform.speed = 1;
		}
	}
}
