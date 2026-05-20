// src/lib/shared/3d/scene-composer/composer-editor-state.svelte.ts

import { Vector3, type Object3D } from "three";
import type CameraControls from "camera-controls";
import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";
import type { ComposerPlacement } from "./types";
import { CommandStack } from "./command-stack.svelte";

export type ComposerMode = "browse" | "select" | "place";

const CAMERA_KEY = "composer-editor-camera";

interface EditorCamera {
	x: number;
	y: number;
	z: number;
	targetX: number;
	targetY: number;
	targetZ: number;
}

export function createComposerEditorState() {
	let mode = $state<ComposerMode>("browse");
	let active = $state(false);
	let selectedObject: Object3D | null = $state(null);
	let gizmoMode: "translate" | "rotate" | "scale" = $state("translate");
	let activeCatalogItem: ObjectDefinition | null = $state(null);
	let ghostValid = $state(false);
	let placements = $state<ComposerPlacement[]>([]);
	let dirty = $state(false);
	let orbitControls: CameraControls | null = null;

	const commands = new CommandStack();

	return {
		commands,

		get active() {
			return active;
		},
		get mode() {
			return mode;
		},
		get selectedObject() {
			return selectedObject;
		},
		get gizmoMode() {
			return gizmoMode;
		},
		get activeCatalogItem() {
			return activeCatalogItem;
		},
		get ghostValid() {
			return ghostValid;
		},
		get placements() {
			return placements;
		},
		get dirty() {
			return dirty;
		},

		setActive(v: boolean) {
			active = v;
			if (!v) {
				mode = "browse";
				selectedObject = null;
				activeCatalogItem = null;
				ghostValid = false;
				gizmoMode = "translate";
			}
		},

		toggle() {
			this.setActive(!active);
		},

		select(obj: Object3D) {
			selectedObject = obj;
			mode = "select";
			activeCatalogItem = null;
			if (orbitControls && obj) {
				const pos = new Vector3();
				obj.getWorldPosition(pos);
				orbitControls.setTarget(pos.x, pos.y, pos.z, true);
			}
		},

		deselect() {
			selectedObject = null;
			mode = active ? "select" : "browse";
		},

		setGizmoMode(m: "translate" | "rotate" | "scale") {
			gizmoMode = m;
		},

		startPlacement(def: ObjectDefinition) {
			activeCatalogItem = def;
			mode = "place";
			selectedObject = null;
			ghostValid = false;
		},

		stopPlacement() {
			activeCatalogItem = null;
			mode = active ? "select" : "browse";
			ghostValid = false;
		},

		setGhostValid(v: boolean) {
			ghostValid = v;
		},

		setPlacements(p: ComposerPlacement[]) {
			placements = p;
		},

		addPlacement(p: ComposerPlacement) {
			placements.push(p);
			dirty = true;
		},

		removePlacement(id: string) {
			const idx = placements.findIndex((p) => p.id === id);
			if (idx !== -1) {
				placements.splice(idx, 1);
				dirty = true;
			}
		},

		updatePlacement(id: string, update: Partial<ComposerPlacement>) {
			const p = placements.find((p) => p.id === id);
			if (p) {
				Object.assign(p, update);
				dirty = true;
			}
		},

		markClean() {
			dirty = false;
		},

		setOrbitControls(controls: CameraControls | null) {
			orbitControls = controls;
		},

		focusOnPoint(x: number, y: number, z: number) {
			orbitControls?.setTarget(x, y, z, true);
		},

		panTarget(dx: number, dy: number, dz: number) {
			if (!orbitControls) return;
			const v = new Vector3();
			orbitControls.getTarget(v);
			orbitControls.setTarget(v.x + dx, v.y + dy, v.z + dz, false);
		},

		loadCamera(): EditorCamera | null {
			try {
				const raw = sessionStorage.getItem(CAMERA_KEY);
				return raw ? JSON.parse(raw) : null;
			} catch {
				return null;
			}
		},

		saveCamera(cam: EditorCamera) {
			try {
				sessionStorage.setItem(CAMERA_KEY, JSON.stringify(cam));
			} catch {
				/* non-critical */
			}
		},
	};
}

export type ComposerEditorState = ReturnType<typeof createComposerEditorState>;
