import {
	Vector3,
	DataTexture,
	RGBAFormat,
	FloatType,
	type Texture,
	type WebGLRenderer,
} from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { FishEventSystem, type FishEventUniforms } from './fish-events';
import {
	RESIDENT_SPECIES,
	RESIDENT_FISH_COUNT,
	THREAT_MATRIX,
	HUNT_MATRIX,
	type FishSpeciesConfig,
} from './fish-species';
import velocityShaderSource from '../../../shaders/fish/boid-velocity.glsl?raw';
import positionShaderSource from '../../../shaders/fish/boid-position.glsl?raw';
import stateShaderSource from '../../../shaders/fish/boid-state.glsl?raw';


export interface FishFrameUniforms {
	delta: number;
	time: number;
	groundY: number;
	currentStrength: number;
	perceptionAngle: number;
	scatterRadius: number;
	scatterForce: number;
	scatterWaveSpeed: number;
	scatterStartTime: number;
	cursorRayOrigin: Vector3;
	cursorRayDir: Vector3;
	cursorActive: boolean;
	cameraRight: Vector3;
}

export interface FishComputeSystem {
	positionTexture: Texture | null;
	velocityTexture: Texture | null;
	stateTexture: Texture | null;
	texSize: number;
	loadedSpeciesCount: number;
	residentFishCount: number;
	eventSystem: FishEventSystem | null;
	velVar: any;
	stateVar: any;
	posVar: any;
	gpuCompute: GPUComputationRenderer | null;
	storedTraitsData: Float32Array | null;
	update(uniforms: FishFrameUniforms): void;
	processSpawn(
		startIdx: number,
		count: number,
		positions: Float32Array,
		velocities: Float32Array,
		speciesIndices: number[],
		schoolCenters: Vector3[],
		trophicRoles: Int32Array,
	): void;
	processDespawn(startIdx: number, count: number): void;
	dispose(): void;
}

export interface FishComputeInitConfig {
	targetSize: number;
	swimHeight: [number, number];
	speed: [number, number];
	stageRadius: number;
	boundRadius: number;
	currentStrength: number;
	scatterRadius: number;
	scatterForce: number;
	scatterWaveSpeed: number;
	perceptionAngle: number;
	halfSpeedTime: number;
	groundY: number;
}


export function createFishComputeSystem(
	renderer: WebGLRenderer,
	config: FishComputeInitConfig,
	loadedSpecies: { species: FishSpeciesConfig; speciesIndex: number }[],
): FishComputeSystem | null {
	const VISITOR_RESERVE = 100;
	const CLUSTER_SPREAD = 2.5;

	const totalFish = RESIDENT_FISH_COUNT;
	const texSize = Math.ceil(Math.sqrt(totalFish + VISITOR_RESERVE));

	const gpu = new GPUComputationRenderer(texSize, texSize, renderer);
	const posTex = gpu.createTexture();
	const velTex = gpu.createTexture();
	const posArr = posTex.image.data as Float32Array;
	const velArr = velTex.image.data as Float32Array;

	const {
		stageRadius,
		boundRadius,
		swimHeight,
		speed,
		groundY: gy,
		targetSize,
		halfSpeedTime,
		currentStrength,
		scatterRadius,
		scatterForce,
		scatterWaveSpeed,
		perceptionAngle,
	} = config;

	const minR = stageRadius + 3;
	const maxR = boundRadius * 0.8;
	const [hMin, hMax] = swimHeight;
	const [sMin, sMax] = speed;

	const clusterCenters: { x: number; y: number; z: number; angle: number }[] = [];
	for (let s = 0; s < loadedSpecies.length; s++) {
		const cAngle = (s / loadedSpecies.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
		const cR = minR + Math.random() * (maxR - minR);
		clusterCenters.push({
			x: Math.cos(cAngle) * cR,
			y: gy + hMin + Math.random() * (hMax - hMin),
			z: Math.sin(cAngle) * cR,
			angle: cAngle,
		});
	}

	let spawnOffset = 0;
	for (let s = 0; s < loadedSpecies.length; s++) {
		const { species: sp } = loadedSpecies[s]!;
		const sCount = sp.instanceCount;
		const cluster = clusterCenters[s]!;

		for (let j = 0; j < sCount; j++) {
			const i = spawnOffset + j;
			const idx = i * 4;

			const offAngle = Math.random() * Math.PI * 2;
			const offR = Math.random() * CLUSTER_SPREAD;
			const offY = (Math.random() - 0.5) * CLUSTER_SPREAD * 0.6;

			posArr[idx + 0] = cluster.x + Math.cos(offAngle) * offR;
			posArr[idx + 1] = cluster.y + offY;
			posArr[idx + 2] = cluster.z + Math.sin(offAngle) * offR;
			posArr[idx + 3] = s; // integer species index

			const perpAngle = cluster.angle + Math.PI / 2;
			const vSpeed = sMin + Math.random() * (sMax - sMin);
			const jitter = (Math.random() - 0.5) * 0.3;
			velArr[idx + 0] = Math.cos(perpAngle + jitter) * vSpeed;
			velArr[idx + 1] = (Math.random() - 0.5) * 0.15;
			velArr[idx + 2] = Math.sin(perpAngle + jitter) * vSpeed;
			velArr[idx + 3] = 0.6 + Math.random() * 0.8;
		}
		spawnOffset += sCount;
	}

	// Sentinel positions for unused slots
	for (let i = spawnOffset; i < texSize * texSize; i++) {
		const idx = i * 4;
		posArr[idx + 0] = 9999;
		posArr[idx + 1] = 9999;
		posArr[idx + 2] = 9999;
		posArr[idx + 3] = 0;
	}

	const traitsData = new Float32Array(texSize * texSize * 4);
	let tOffset = 0;
	for (let s = 0; s < loadedSpecies.length; s++) {
		const { species: sp } = loadedSpecies[s]!;
		for (let j = 0; j < sp.instanceCount; j++) {
			const idx = (tOffset + j) * 4;
			traitsData[idx + 0] = sp.speed[0] + Math.random() * (sp.speed[1] - sp.speed[0]);
			traitsData[idx + 1] = sp.social[0] + Math.random() * (sp.social[1] - sp.social[0]);
			traitsData[idx + 2] = sp.bold[0] + Math.random() * (sp.bold[1] - sp.bold[0]);
			traitsData[idx + 3] = Math.random();
		}
		tOffset += sp.instanceCount;
	}
	const traitsTex = new DataTexture(traitsData, texSize, texSize, RGBAFormat, FloatType);
	traitsTex.needsUpdate = true;

	const eventSystem = new FishEventSystem(spawnOffset, traitsData);

	const localPosVar = gpu.addVariable('texturePosition', positionShaderSource, posTex);
	const localVelVar = gpu.addVariable('textureVelocity', velocityShaderSource, velTex);

	const stateTex = gpu.createTexture();
	const stateArr = stateTex.image.data as Float32Array;
	for (let i = 0; i < texSize * texSize; i++) {
		stateArr[i * 4 + 0] = 0;
		stateArr[i * 4 + 1] = 0;
		stateArr[i * 4 + 2] = 0;
		stateArr[i * 4 + 3] = 0;
	}
	const localStateVar = gpu.addVariable('textureState', stateShaderSource, stateTex);

	gpu.setVariableDependencies(localPosVar, [localPosVar, localVelVar]);
	gpu.setVariableDependencies(localVelVar, [localPosVar, localVelVar, localStateVar]);
	gpu.setVariableDependencies(localStateVar, [localStateVar, localPosVar, localVelVar]);

	const schoolCenterVecs = clusterCenters.map((c) => new Vector3(c.x, c.y, c.z));
	while (schoolCenterVecs.length < 50) schoolCenterVecs.push(new Vector3(0, 0, 0));

	const velU = localVelVar.material.uniforms;
	velU.uDelta = { value: 0 };
	velU.uSepDist = { value: 0.8 };
	velU.uAliDist = { value: 4.0 };
	velU.uMaxSpeed = { value: sMax };
	velU.uMinSpeed = { value: sMin };
	velU.uMaxSteer = { value: 0.1 };
	velU.uTargetSize = { value: targetSize };
	velU.uHalfSpeedTime = { value: halfSpeedTime };
	velU.uGroundY = { value: gy };
	velU.uHeightMin = { value: hMin };
	velU.uHeightMax = { value: hMax };
	velU.uStageRadius = { value: stageRadius };
	velU.uBoundRadius = { value: boundRadius };
	velU.uFishCount = { value: spawnOffset };
	velU.tTraits = { value: traitsTex };
	velU.uTime = { value: 0 };
	velU.uCurrentStrength = { value: currentStrength };
	velU.uPerceptionCos = { value: Math.cos((perceptionAngle * Math.PI) / 180) };
	velU.uSchoolCenters = { value: schoolCenterVecs };
	velU.uSchoolRadius = { value: 6.0 };
	velU.uCursorRayOrigin = { value: new Vector3(0, 0, 0) };
	velU.uCursorRayDir = { value: new Vector3(0, 0, -1) };
	velU.uCursorActive = { value: 0 };
	velU.uScatterRadius = { value: scatterRadius };
	velU.uScatterForce = { value: scatterForce };
	velU.uScatterStartTime = { value: 0 };
	velU.uScatterWaveSpeed = { value: scatterWaveSpeed };
	velU.uFlashBurst = { value: 0.0 };
	velU.uDartCount = { value: 0 };
	velU.uDartIndices = { value: new Int32Array(8).fill(-1) };
	velU.uDartStrength = { value: 2.0 };
	velU.uExcursionCount = { value: 0 };
	velU.uExcursionIndices = { value: new Int32Array(4).fill(-1) };
	velU.uExcursionBias = { value: new Float32Array(4) };

	// Spawn/despawn
	velU.uSpawnCount = { value: 0 };
	velU.uSpawnStartIdx = { value: 0 };
	velU.uSpawnVelocities = { value: new Float32Array(64 * 4) };

	const posU = localPosVar.material.uniforms;
	posU.uDelta = { value: 0 };
	posU.uSpawnCount = { value: 0 };
	posU.uSpawnStartIdx = { value: 0 };
	posU.uSpawnPositions = { value: new Float32Array(64 * 4) };
	posU.uDespawnCount = { value: 0 };
	posU.uDespawnStartIdx = { value: 0 };
	posU.uFloorY = { value: gy + Math.min(hMin * 0.5, 0.6) };
	// The ceiling is the floor's mirror and fails the same way: the velocity pass
	// only steers down from the top of the band, and a scattering fish overshoots
	// it. In open water that reads as a leap; under a surface it is a fish in the
	// air. Headroom above the band, then a hard stop.
	posU.uCeilingY = { value: gy + hMax + 1.5 };

	const trophicRoles = new Int32Array(50);
	for (let s = 0; s < loadedSpecies.length; s++) {
		trophicRoles[s] = loadedSpecies[s]!.species.trophicRole;
	}

	const stU = localStateVar.material.uniforms;
	stU.uDelta = { value: 0 };
	stU.uTime = { value: 0 };
	stU.uFleeRange = { value: 5.0 };
	stU.uHuntRange = { value: 8.0 };
	stU.uPanicRadius = { value: 5.0 };
	stU.uHomeRadius = { value: 4.0 };
	stU.uPerceptionCos = { value: Math.cos((perceptionAngle * Math.PI) / 180) };
	stU.uTrophicRole = { value: trophicRoles };
	stU.uThreatMatrix = { value: THREAT_MATRIX };
	stU.uHuntMatrix = { value: HUNT_MATRIX };
	stU.uSchoolCenters = velU.uSchoolCenters;
	stU.uCursorRayOrigin = velU.uCursorRayOrigin;
	stU.uCursorRayDir = velU.uCursorRayDir;
	stU.uCursorActive = velU.uCursorActive;
	stU.uScatterRadius = { value: scatterRadius };
	stU.uCameraRight = { value: new Vector3(1, 0, 0) };
	stU.textureTraits = { value: traitsTex };

	const err = gpu.init();
	if (err !== null) {
		console.error('[FishComputeSystem] GPUComputationRenderer init failed:', err);
		gpu.dispose();
		return null;
	}

	// Debug shader errors in dev mode
	if (import.meta.env.DEV) {
		const glCtx = (renderer as any).getContext?.() ?? renderer;
		if (glCtx instanceof WebGL2RenderingContext || glCtx instanceof WebGLRenderingContext) {
			const origShaderError = (renderer as any).debug?.onShaderError;
			(renderer as any).debug = (renderer as any).debug || {};
			(renderer as any).debug.onShaderError = (
				_gl: WebGL2RenderingContext,
				_program: WebGLProgram,
				vsShader: WebGLShader,
				fsShader: WebGLShader,
			) => {
				const fsLog = _gl.getShaderInfoLog(fsShader);
				const fsSource = _gl.getShaderSource(fsShader);
				console.error('[FishComputeSystem] GLSL compile error:\n', fsLog);
				console.error('[FishComputeSystem] First 500 chars of fragment shader:\n', fsSource?.substring(0, 500));
				if (origShaderError) origShaderError(_gl, _program, vsShader, fsShader);
			};
		}
	}

	// Initial compute pass
	gpu.compute();

	let prevMouseActive = false;
	let elapsed = 0;

	const system: FishComputeSystem = {
		positionTexture: gpu.getCurrentRenderTarget(localPosVar).texture,
		velocityTexture: gpu.getCurrentRenderTarget(localVelVar).texture,
		stateTexture: gpu.getCurrentRenderTarget(localStateVar).texture,
		texSize,
		loadedSpeciesCount: loadedSpecies.length,
		residentFishCount: spawnOffset,
		eventSystem,
		velVar: localVelVar,
		stateVar: localStateVar,
		posVar: localPosVar,
		gpuCompute: gpu,
		storedTraitsData: traitsData,

		update(frame: FishFrameUniforms) {
			const dt = Math.min(frame.delta, 0.05);
			elapsed += dt;

			const posUni = localPosVar.material.uniforms;
			const velUni = localVelVar.material.uniforms;
			const stUni = localStateVar.material.uniforms;

			velUni.uDelta!.value = dt;
			velUni.uTime!.value = elapsed;
			velUni.uCurrentStrength!.value = frame.currentStrength;
			velUni.uPerceptionCos!.value = Math.cos((frame.perceptionAngle * Math.PI) / 180);
			velUni.uScatterRadius!.value = frame.scatterRadius;
			velUni.uScatterForce!.value = frame.scatterForce;
			velUni.uScatterWaveSpeed!.value = frame.scatterWaveSpeed;

			// Cursor ray drives scatter in both velocity and state shaders; stUni
			// shares the same uniform objects (assigned at init), so one copy updates both.
			velUni.uCursorRayOrigin!.value.copy(frame.cursorRayOrigin);
			velUni.uCursorRayDir!.value.copy(frame.cursorRayDir);
			velUni.uCursorActive!.value = frame.cursorActive ? 1.0 : 0.0;

			const flashThisFrame = frame.cursorActive && !prevMouseActive;
			prevMouseActive = frame.cursorActive;
			velUni.uFlashBurst!.value = flashThisFrame ? 1.0 : 0.0;

			velUni.uScatterStartTime!.value = frame.scatterStartTime;
			posUni.uDelta!.value = dt;

			stUni.uDelta!.value = dt;
			stUni.uTime!.value = elapsed;
			stUni.uScatterRadius!.value = frame.scatterRadius;

			stUni.uCameraRight!.value.copy(frame.cameraRight);

			if (eventSystem) {
				eventSystem.tick(dt, velUni as unknown as FishEventUniforms);
			}

			gpu.compute();

			// Detach the GPGPU framebuffer so the EffectComposer's RenderPass doesn't
			// trigger a feedback loop when it binds GPGPU textures as fish-shader samplers.
			renderer.setRenderTarget(null);

			system.positionTexture = gpu.getCurrentRenderTarget(localPosVar).texture;
			system.velocityTexture = gpu.getCurrentRenderTarget(localVelVar).texture;
			system.stateTexture = gpu.getCurrentRenderTarget(localStateVar).texture;
		},

		processSpawn(
			startIdx: number,
			count: number,
			positions: Float32Array,
			velocities: Float32Array,
			speciesIndices: number[],
			schoolCenters: Vector3[],
			trophicRoles: Int32Array,
		) {
			const posUni = localPosVar.material.uniforms;
			const velUni = localVelVar.material.uniforms;
			const stUni = localStateVar.material.uniforms;

			const posData = posUni.uSpawnPositions!.value as Float32Array;
			const velData = velUni.uSpawnVelocities!.value as Float32Array;
			posData.set(positions.subarray(0, count * 4));
			velData.set(velocities.subarray(0, count * 4));

			posUni.uSpawnCount!.value = count;
			posUni.uSpawnStartIdx!.value = startIdx;
			velUni.uSpawnCount!.value = count;
			velUni.uSpawnStartIdx!.value = startIdx;

			// Update school centers for visitor species
			const centers = velUni.uSchoolCenters!.value as Vector3[];
			for (let i = 0; i < schoolCenters.length; i++) {
				const idx = speciesIndices[i];
				if (idx !== undefined && idx < centers.length) {
					centers[idx]!.copy(schoolCenters[i]!);
				}
			}

			// Update trophic roles for visitor species
			const roles = stUni.uTrophicRole!.value as Int32Array;
			for (let i = 0; i < trophicRoles.length; i++) {
				const idx = speciesIndices[i];
				if (idx !== undefined && idx < roles.length) {
					roles[idx] = trophicRoles[i]!;
				}
			}
		},

		processDespawn(startIdx: number, count: number) {
			const posUni = localPosVar.material.uniforms;
			posUni.uDespawnCount!.value = count;
			posUni.uDespawnStartIdx!.value = startIdx;
		},

		dispose() {
			gpu.dispose();
		},
	};

	return system;
}
