/**
 * Terrain Research Data
 *
 * Analysis of open-source terrain implementations gathered from exploring real codebases.
 * Data synthesized from repository exploration and documentation review.
 */

export interface DimensionAnalysis {
	approach: string;
	dataStructure?: string;
	dataFlow?: string;
	transitions?: string;
	biomes?: string;
	highlights: string[];
	limitations: string[];
}

export interface CodeSnippet {
	title: string;
	file: string;
	code: string;
	explanation?: string;
}

export interface ProjectAnalysis {
	name: string;
	repo: string;
	stack: string[];
	description: string;
	relevanceScore: number;
	chunkSystem?: DimensionAnalysis;
	gpuCompute?: DimensionAnalysis;
	lodStrategy?: DimensionAnalysis;
	noiseAlgorithm?: DimensionAnalysis;
	stateManagement?: DimensionAnalysis;
	memoryStrategy?: DimensionAnalysis;
	lessonsForTKA: string[];
	codeSnippets: CodeSnippet[];
}

export const terrainResearchData: ProjectAnalysis[] = [
	{
		name: 'OpenWorldJS',
		repo: 'https://github.com/obecerra3/OpenWorldJS',
		stack: ['Three.js', 'Ammo.js', 'JavaScript', 'GPGPU', 'GLSL'],
		description:
			'3D Open World using Three.js with GPGPU terrain generation via fragment shaders. Uses CDLOD algorithm from felixpalmer.',
		relevanceScore: 9,
		chunkSystem: {
			approach: 'Moving chunk centered on player',
			dataStructure: 'Single active chunk of height data',
			highlights: [
				'Chunk stays centered on player position',
				'Updates when player moves past UPDATE_DISTANCE threshold',
				'Reuses Ammo height-data mesh colliders instead of create/destroy',
				'Dynamic collider shape updates for traversal',
			],
			limitations: [
				'Single active chunk - not truly infinite',
				'Requires careful player position tracking',
			],
		},
		gpuCompute: {
			approach: 'Fragment shader GPGPU via Three.js GPUComputationRenderer',
			dataFlow: 'Noise lookup table → Fragment shader → Height texture → CPU readback',
			highlights: [
				'Pre-calculates terrain per chunk on GPU',
				'Precomputed gradient noise lookup table replaces slow hash functions',
				'Box blur algorithm for terrain smoothing',
				'Player grounding check via GPU height comparison',
			],
			limitations: [
				'Fragment shader GPGPU less efficient than true compute shaders',
				'CPU readback required for physics',
			],
		},
		lodStrategy: {
			approach: 'CDLOD (Continuous Distance-Dependent LOD)',
			transitions: 'Based on felixpalmer/lod-terrain implementation',
			highlights: [
				'Industry-standard CDLOD algorithm',
				'Smooth transitions between detail levels',
			],
			limitations: [
				'External dependency on felixpalmer implementation',
				'Documentation sparse on specifics',
			],
		},
		noiseAlgorithm: {
			approach: '2D Gradient Noise + Fractional Brownian Motion',
			biomes: 'Procedural textures via TextureGen.frag',
			highlights: [
				'Realistic terrain with sharp details',
				'FBM layering for natural variation',
				'Optimized noise with lookup table',
			],
			limitations: [],
		},
		stateManagement: {
			approach: 'Modular JavaScript classes',
			highlights: [
				'Clear module separation (Terrain.js, Physics.js, Collider.js)',
				'Based on AMD module pattern from amd-three.js',
			],
			limitations: ['No TypeScript types', 'Older patterns'],
		},
		memoryStrategy: {
			approach: 'Single chunk reuse',
			highlights: [
				'Memory-efficient single chunk approach',
				'Collider reuse instead of recreation',
			],
			limitations: ['Limited view distance'],
		},
		lessonsForTKA: [
			'GPGPU via fragment shaders is viable - consider for WebGL fallback',
			'Precomputed noise lookup tables significantly improve performance',
			'Collider reuse pattern could help with physics chunk updates',
			'CDLOD algorithm is well-proven - TKA already uses similar approach',
			'Player position check via GPU height comparison is clever optimization',
		],
		codeSnippets: [
			{
				title: 'GPGPU Height Generation Pattern',
				file: 'Terrain.js (conceptual)',
				code: `// Pre-calculate terrain using GPUComputationRenderer
const gpuCompute = new GPUComputationRenderer(size, size, renderer);
const heightTexture = gpuCompute.createTexture();
// Fragment shader samples noise, outputs to texture
gpuCompute.compute();
// Read back for CPU physics`,
				explanation: 'Fragment shader generates heightmap, stored as texture for GPU use and read back for physics',
			},
		],
	},
	{
		name: 'Veloren',
		repo: 'https://gitlab.com/veloren/veloren',
		stack: ['Rust', 'wgpu', 'specs ECS', 'Voxel'],
		description:
			'Open-source voxel RPG where terrain "rises" while water "flows" - physically-inspired erosion simulation.',
		relevanceScore: 8,
		chunkSystem: {
			approach: 'Lazy voxel generation on player load',
			dataStructure: 'Chunk coordinates → Height/property maps → Voxels on demand',
			highlights: [
				'Voxels only generated when player loads area',
				'Height and river network computed ahead of time',
				'Voxels usually not persisted - regenerated on demand',
				'Roads, caves, structures fitted after terrain baseline',
			],
			limitations: [
				'World generation takes 10-30 minutes initially',
				'Complex algorithm requires significant compute',
			],
		},
		gpuCompute: {
			approach: 'wgpu-based rendering, CPU terrain generation',
			dataFlow: 'Noise inputs → Erosion algorithm → Height map → Voxel generation on load',
			highlights: [
				'Rendering via modern wgpu',
				'Terrain gen is CPU-based but highly parallelized',
			],
			limitations: [
				'No GPU-accelerated terrain generation',
				'Long initial world gen time',
			],
		},
		lodStrategy: {
			approach: 'Chunk-based streaming with ECS',
			transitions: 'Chunks loaded/unloaded based on player proximity',
			highlights: [
				'ECS architecture (specs library) manages chunk entities',
				'Streaming based on player position',
			],
			limitations: [],
		},
		noiseAlgorithm: {
			approach: 'Noise + Tectonic Uplift + Fluvial Erosion simulation',
			biomes: 'Altitude, rock strength, humidity, temperature → Erosion → Final height',
			highlights: [
				'Based on scientific paper: "Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion"',
				'Terrain "rises" while water "flows" and carves paths',
				'Results in natural-looking mountains and river networks',
				'100 erosion iterations for realistic results',
				'More natural than pure noise-based approaches',
			],
			limitations: [
				'Computationally expensive (10-30 min generation)',
				'Complex to implement correctly',
			],
		},
		stateManagement: {
			approach: 'ECS with specs library',
			highlights: [
				'Clean separation of concerns via ECS',
				'Parallel-friendly architecture',
				'Components for chunk state, mesh data, etc.',
			],
			limitations: ['Rust-specific patterns'],
		},
		memoryStrategy: {
			approach: 'Voxels regenerated on demand',
			highlights: [
				'Only stores height map and river network',
				'Voxels computed lazily - massive memory savings',
				'Can recreate any chunk from seed + erosion result',
			],
			limitations: [],
		},
		lessonsForTKA: [
			'Erosion simulation creates more natural terrain than pure noise - worth researching',
			'Lazy voxel generation saves memory - TKA already does similar with mesh generation',
			'Store height map, generate details on demand - proven pattern',
			'ECS pattern could help organize chunk components',
			'Consider pre-computing some global features (rivers, roads) that span chunks',
		],
		codeSnippets: [
			{
				title: 'Erosion Concept',
				file: 'world/src/sim/erosion.rs (conceptual)',
				code: `// Simplified erosion loop concept
for iteration in 0..100 {
    // Terrain "rises" - add uplift based on tectonic simulation
    apply_tectonic_uplift(&mut heights);

    // Water "flows" - calculate drainage and erode
    let drainage = calculate_drainage_area(&heights);
    apply_fluvial_erosion(&mut heights, &drainage);
}
// Result: natural mountains + river networks`,
				explanation: 'Each iteration adds uplift then erodes, creating realistic terrain over 100 iterations',
			},
		],
	},
	{
		name: 'VoxelWorld',
		repo: 'https://github.com/danielfvm/VoxelWorld',
		stack: ['WebGL', 'JavaScript', 'Fragment Shaders', 'Cellular Automata'],
		description:
			'Voxel game using fragment shaders as compute shader workaround. Chunks stored as textures with cellular automata physics.',
		relevanceScore: 7,
		chunkSystem: {
			approach: 'Chunks as GPU textures, 2x2 loading limit',
			dataStructure: 'Voxel state in texture: type, integrity, temperature, velocity, light',
			highlights: [
				'Creative solution for WebGL compute limitation',
				'Each chunk stored as texture',
				'Voxel data includes: type (Sand, Grass, Stone), integrity, temperature, velocity, light level',
			],
			limitations: [
				'Only 2x2 chunks due to texture bind limits (WebGL minimum: 8 binds)',
				'Limited world size visible at once',
			],
		},
		gpuCompute: {
			approach: 'Fragment shader as compute shader workaround',
			dataFlow: 'Sample texture → Compute in fragment shader → Render to framebuffer → Use framebuffer texture for next iteration',
			highlights: [
				'No WebGL compute shaders needed',
				'Physics via cellular automata entirely on GPU',
				'Iterative simulation via framebuffer ping-pong',
				'Full voxel physics (falling sand, water flow, etc.)',
			],
			limitations: [
				'Less parallel than true compute shaders',
				'Limited to 2x2 chunk region',
				'Complex shader logic required',
			],
		},
		lodStrategy: {
			approach: 'No LOD - fixed resolution raycasting',
			transitions: 'N/A',
			highlights: [
				'Raycasting shader on screen quad',
				'Optional downsampling for performance',
			],
			limitations: ['No distance-based detail reduction'],
		},
		noiseAlgorithm: {
			approach: 'Procedural voxel types',
			biomes: 'Voxel type-based terrain',
			highlights: [],
			limitations: [],
		},
		stateManagement: {
			approach: 'GPU texture state',
			highlights: [
				'State lives entirely in GPU textures',
				'Minimal CPU involvement during simulation',
			],
			limitations: ['Hard to inspect/debug GPU state'],
		},
		memoryStrategy: {
			approach: 'Texture-based with automatic GPU memory management',
			highlights: [
				'GPU handles texture memory',
				'Compact representation in texture channels',
			],
			limitations: [],
		},
		lessonsForTKA: [
			'Fragment shader compute is viable WebGL fallback - could be useful if WebGPU unavailable',
			'Framebuffer ping-pong enables iterative GPU simulation',
			'Chunk-as-texture pattern stores rich voxel data compactly',
			'Cellular automata enables complex physics entirely on GPU',
			'Raycasting on quad is interesting rendering alternative',
		],
		codeSnippets: [
			{
				title: 'Fragment Shader Compute Pattern',
				file: 'Conceptual',
				code: `// WebGL fragment shader as compute workaround
// Frame N:
uniform sampler2D chunkDataTexture; // Previous state
// Sample neighbors, compute new state
vec4 newState = computeCellularAutomata(chunkDataTexture, fragCoord);
gl_FragColor = newState; // Write to framebuffer

// Frame N+1:
// Framebuffer becomes new chunkDataTexture (ping-pong)`,
				explanation: 'Each frame samples previous state texture, computes new state, writes to framebuffer which becomes next input',
			},
		],
	},
	{
		name: 'r3f-rapier-world',
		repo: 'https://github.com/thomas-rooty/r3f-rapier-world',
		stack: ['React Three Fiber', 'Rapier', 'TypeScript', 'Vite', 'Drei'],
		description:
			'Infinite procedural world using React Three Fiber with Rapier physics. Similar stack to potential Svelte integration.',
		relevanceScore: 8,
		chunkSystem: {
			approach: 'React component-based chunk management',
			dataStructure: 'React state + R3F components',
			highlights: [
				'Chunks as React components',
				'Declarative chunk loading/unloading',
				'Hooks pattern for chunk state',
			],
			limitations: [
				'WIP - still in development',
				'React overhead for chunk management',
			],
		},
		gpuCompute: {
			approach: 'Standard Three.js rendering',
			dataFlow: 'React state → R3F components → Three.js scene',
			highlights: [
				'Drei helpers for common patterns',
				'R3F reconciler handles Three.js updates efficiently',
			],
			limitations: [
				'No GPU terrain generation visible in current code',
			],
		},
		lodStrategy: {
			approach: 'Distance-based chunk loading',
			transitions: 'React state-driven visibility',
			highlights: [
				'Declarative visibility control',
				'Easy to reason about in React paradigm',
			],
			limitations: [],
		},
		noiseAlgorithm: {
			approach: 'Simplex noise for terrain',
			biomes: 'Height-based coloring',
			highlights: [],
			limitations: [],
		},
		stateManagement: {
			approach: 'React state + hooks',
			highlights: [
				'Familiar React patterns',
				'Zustand potential for global state',
				'Clean separation of concerns',
			],
			limitations: ['React re-render overhead'],
		},
		memoryStrategy: {
			approach: 'React component lifecycle',
			highlights: [
				'Automatic cleanup on unmount',
				'React handles component lifecycle',
			],
			limitations: [],
		},
		lessonsForTKA: [
			'Declarative chunk components simplify reasoning - Svelte could do similar',
			'Rapier physics integration shows viable physics chunk approach',
			'Hooks/reactive patterns for chunk state management',
			'drei library has useful R3F patterns that could inspire Svelte equivalents',
		],
		codeSnippets: [],
	},
	{
		name: 'WebGPU-Erosion-Simulation',
		repo: 'https://github.com/GPU-Gang/WebGPU-Erosion-Simulation',
		stack: ['TypeScript', 'Next.js', 'WebGPU', 'WGSL'],
		description:
			'WebGPU terrain erosion using compute shaders and ping-pong buffers. Modern TypeScript/WebGPU reference implementation.',
		relevanceScore: 9,
		chunkSystem: {
			approach: 'Single terrain heightmap (not chunked)',
			dataStructure: 'Storage textures in rgba8unorm format',
			highlights: [
				'Focus on erosion simulation, not chunking',
				'Good reference for GPU data patterns',
			],
			limitations: ['Not designed for infinite worlds'],
		},
		gpuCompute: {
			approach: 'WebGPU compute shaders with ping-pong buffers',
			dataFlow: 'Ping buffer → Compute shader → Pong buffer → Swap → Repeat',
			highlights: [
				'True WebGPU compute shaders in WGSL',
				'Three pairs of ping-pong buffers: heightfields, uplifts, stream area',
				'Storage textures with rgba8unorm format',
				'Later versions experimented with array<f32> for memory efficiency',
				'25x25 neighborhood sampling for steepest flow',
				'Optimization: store intermediate calculations to avoid redundant work',
			],
			limitations: [
				'WebGPU browser support still limited',
				'rgba8unorm wastes 3 channels for greyscale data',
				'Required GPUTextureUsage.STORAGE_BINDING format constraints',
			],
		},
		lodStrategy: {
			approach: 'N/A - visualization via sphere tracing',
			transitions: 'Raymarching handles detail naturally',
			highlights: [
				'Sphere tracing for 3D visualization',
				'Resolution-independent rendering',
			],
			limitations: [],
		},
		noiseAlgorithm: {
			approach: 'Stream power erosion equation simulation',
			biomes: 'Erosion-sculpted terrain',
			highlights: [
				'Physically-based erosion model from academic paper',
				'Drainage area calculation via neighborhood sampling',
				'Real heightmap data import from USGS Earth Explorer',
				'Iterative simulation produces realistic features',
			],
			limitations: [],
		},
		stateManagement: {
			approach: 'TypeScript classes + WebGPU bindings',
			highlights: [
				'Clean TypeScript integration with WebGPU',
				'GUI controls for interactive authoring',
			],
			limitations: [],
		},
		memoryStrategy: {
			approach: 'GPU storage buffers/textures',
			highlights: [
				'Efficient GPU-side memory',
				'Ping-pong avoids allocation churn',
			],
			limitations: [],
		},
		lessonsForTKA: [
			'Ping-pong buffer pattern essential for GPU compute - TKA should adopt this',
			'rgba8unorm format constraint - consider array<f32> for single-channel data',
			'Store intermediate calculations to avoid redundant GPU work',
			'25x25 neighborhood for steepest flow - larger than typical 3x3',
			'TypeScript + WebGPU integration patterns to reference',
			'Sphere tracing interesting alternative to mesh-based rendering',
		],
		codeSnippets: [
			{
				title: 'Ping-Pong Buffer Pattern',
				file: 'Conceptual WGSL',
				code: `// Compute shader with ping-pong buffers
@group(0) @binding(0) var heightfieldPing: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(1) var heightfieldPong: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let currentHeight = textureLoad(heightfieldPing, id.xy);
    let newHeight = computeErosion(currentHeight, id.xy);
    textureStore(heightfieldPong, id.xy, newHeight);
}
// After dispatch, swap ping and pong bindings`,
				explanation: 'Read from ping texture, write to pong texture, swap bindings for next iteration',
			},
		],
	},
	{
		name: 'THREE.Terrain',
		repo: 'https://github.com/IceCreamYou/THREE.Terrain',
		stack: ['Three.js', 'JavaScript'],
		description:
			'Mature terrain generation library (737 stars) with multiple noise algorithms and good API design.',
		relevanceScore: 7,
		chunkSystem: {
			approach: 'Single terrain mesh generation',
			dataStructure: 'Three.js PlaneGeometry with modified vertices',
			highlights: [
				'Clean API: THREE.Terrain({ options })',
				'All parameters optional with sensible defaults',
			],
			limitations: ['Not designed for chunked/infinite worlds'],
		},
		gpuCompute: {
			approach: 'CPU-based generation',
			dataFlow: 'Parameters → JS noise functions → Vertex modifications → Mesh',
			highlights: [
				'Focus on algorithms, not GPU optimization',
				'Good reference for terrain math',
			],
			limitations: ['No GPU acceleration'],
		},
		lodStrategy: {
			approach: 'Segment-based resolution control',
			transitions: 'xSegments/ySegments parameters',
			highlights: [
				'Steps parameter for multi-resolution',
				'"Most detailed version" implies LOD support',
			],
			limitations: [],
		},
		noiseAlgorithm: {
			approach: 'Multiple algorithms: Perlin, Simplex, Value, Worley, Diamond-Square, Fault, Particle Deposition, Weierstrass, Brownian Motion',
			biomes: 'Material blending via GLSL expressions for elevation/slope',
			highlights: [
				'Excellent variety of noise algorithms',
				'Custom methods supported',
				'Terrain features: islands, cliffs, canyons, plateaus',
				'ScatterMeshes() for vegetation placement',
				'Import/export via toHeightmap()',
			],
			limitations: [],
		},
		stateManagement: {
			approach: 'Configuration object pattern',
			highlights: [
				'Simple, stateless API',
				'Chainable utilities',
			],
			limitations: [],
		},
		memoryStrategy: {
			approach: 'Single mesh allocation',
			highlights: ['Predictable memory usage'],
			limitations: [],
		},
		lessonsForTKA: [
			'API design reference: all optional params, sensible defaults',
			'Multiple noise algorithms - TKA could offer algorithm options',
			'ScatterMeshes pattern for vegetation placement',
			'GLSL material blending expressions - more flexible than fixed splatmap',
			'Import/export heightmap functions useful for debugging',
		],
		codeSnippets: [
			{
				title: 'Clean API Pattern',
				file: 'THREE.Terrain usage',
				code: `// All params optional, sensible defaults
const terrain = THREE.Terrain({
    easing: THREE.Terrain.Linear,
    frequency: 2.5,
    heightmap: THREE.Terrain.DiamondSquare,
    material: material,
    maxHeight: 100,
    minHeight: -100,
    steps: 1,
    xSegments: 63,
    ySegments: 63,
    xSize: 1024,
    ySize: 1024,
});`,
				explanation: 'Clean configuration object pattern with all optional parameters',
			},
		],
	},
	{
		name: 'webgl-lod-landscape',
		repo: 'https://github.com/bharling/webgl-lod-landscape',
		stack: ['Three.js', 'JavaScript', 'WebGL'],
		description:
			'Infinite landscape with LOD mesh generation. Working on "skirts" to hide gaps between LOD levels.',
		relevanceScore: 8,
		chunkSystem: {
			approach: 'Infinite landscape streaming',
			dataStructure: 'LOD mesh hierarchy',
			highlights: [
				'Automatic LOD mesh generation',
				'Designed for infinite worlds',
			],
			limitations: ['Documentation sparse'],
		},
		gpuCompute: {
			approach: 'Standard Three.js rendering',
			dataFlow: 'CPU heightmap → GPU mesh',
			highlights: [],
			limitations: [],
		},
		lodStrategy: {
			approach: 'Automatic LOD mesh generation with skirts',
			transitions: 'Skirts (vertical extensions) hide gaps between LOD levels',
			highlights: [
				'SKIRTS PATTERN: Vertical mesh extensions at chunk edges',
				'Skirts drop down to hide gaps where LODs meet',
				'Industry-standard approach for LOD seams',
				'Automatic LOD mesh generation routines',
			],
			limitations: [
				'Skirt implementation still incomplete per repo notes',
				'Work in progress',
			],
		},
		noiseAlgorithm: {
			approach: 'Heightmap-based',
			biomes: 'Standard terrain texturing',
			highlights: [],
			limitations: [],
		},
		stateManagement: {
			approach: 'Direct Three.js manipulation',
			highlights: [],
			limitations: [],
		},
		memoryStrategy: {
			approach: 'LOD-based memory optimization',
			highlights: ['Lower LOD = less memory'],
			limitations: [],
		},
		lessonsForTKA: [
			'SKIRTS are the standard solution for LOD gaps - TKA should implement this',
			'Skirt = vertical extension at chunk edge that drops below terrain',
			'Skirts hide the crack where different LOD levels meet',
			'Even incomplete, this approach is industry standard',
			'TKA currently uses T-junction stitching - skirts are simpler alternative',
		],
		codeSnippets: [
			{
				title: 'Skirt Concept',
				file: 'Conceptual',
				code: `// Skirt: vertical extension at chunk edge
// For each edge vertex:
const skirtVertex = edgeVertex.clone();
skirtVertex.y -= SKIRT_DEPTH; // Drop below terrain

// Connect edge vertices to skirt vertices with triangles
// This creates a "wall" that hides the gap`,
				explanation: 'Skirts are vertical walls at chunk edges that extend below the terrain surface, hiding any gaps between different LOD levels',
			},
		],
	},
	{
		name: 'geo-three',
		repo: 'https://github.com/tentone/geo-three',
		stack: ['Three.js', 'TypeScript', 'Geographic Data'],
		description:
			'Geographic terrain library with multiple LOD strategies: Raycast, Radial, Frustum. Good reference for LOD approaches.',
		relevanceScore: 7,
		chunkSystem: {
			approach: 'Tile-based geographic chunks with hierarchical zoom',
			dataStructure: 'Quadtree: each node at zoom N has children at zoom N+1',
			highlights: [
				'Integrates with map tile providers (Mapbox, OpenStreetMap, etc.)',
				'Hierarchical tile structure',
				'Configurable subdivision thresholds (thresholdUp/thresholdDown)',
				'subdivisionRays parameter for sampling',
			],
			limitations: ['Designed for geographic data, not procedural'],
		},
		gpuCompute: {
			approach: 'GPU displacement maps for height',
			dataFlow: 'Heightmap texture → Vertex shader displacement → Final geometry',
			highlights: [
				'GPU-generated geometry is denser, more detailed, faster',
				'Height displacement in vertex shader',
				'More efficient than CPU mesh modification',
			],
			limitations: [
				'Final geometry not accessible for ray casting',
				'Interaction with GPU-displaced geometry is limited',
			],
		},
		lodStrategy: {
			approach: 'Three strategies: Raycast, Radial, Frustum',
			transitions: 'Configurable subdivision/simplification thresholds',
			highlights: [
				'RAYCAST: Ray-based distance to camera view, faster overall, only frustum nodes considered',
				'RADIAL: Distance from camera to each node, more consistent results, simpler',
				'FRUSTUM: Like radial but only frustum-visible nodes, good balance',
				'Custom LOD via extending LODControl base class',
				'updateLOD(view, camera, renderer, scene) method for custom implementations',
			],
			limitations: [],
		},
		noiseAlgorithm: {
			approach: 'Heightmap-based from tile providers',
			biomes: 'Real geographic data from providers',
			highlights: [
				'Supports real elevation data',
				'Custom MapProvider for synthetic terrain',
			],
			limitations: [],
		},
		stateManagement: {
			approach: 'TypeScript class hierarchy',
			highlights: [
				'Clean provider abstraction',
				'Extensible via inheritance',
			],
			limitations: [],
		},
		memoryStrategy: {
			approach: 'Tile-based streaming with LOD',
			highlights: [
				'Only loads visible tiles',
				'LOD reduces detail for distant tiles',
			],
			limitations: [],
		},
		lessonsForTKA: [
			'THREE LOD STRATEGIES to consider: Raycast (fastest), Radial (simplest), Frustum (balanced)',
			'Frustum-based LOD could improve TKA performance - only process visible chunks',
			'GPU displacement maps trade ray-cast ability for performance - document this tradeoff',
			'Custom LODControl base class pattern is clean - TKA could use similar',
			'subdivisionRays parameter - sampling approach for LOD decisions',
		],
		codeSnippets: [
			{
				title: 'LOD Strategy Comparison',
				file: 'Conceptual',
				code: `// RAYCAST: Fast, uses view frustum rays
// Best when camera mostly looks forward
class RaycastLOD extends LODControl {
    updateLOD(view, camera, renderer, scene) {
        // Cast rays from camera, subdivide hit nodes
    }
}

// RADIAL: Simple, consistent
// Best for editors / debugging
class RadialLOD extends LODControl {
    updateLOD(view, camera, renderer, scene) {
        // Distance from camera to each node
    }
}

// FRUSTUM: Balanced
// Best for games - only visible nodes
class FrustumLOD extends LODControl {
    updateLOD(view, camera, renderer, scene) {
        // Like radial, but filter to frustum
    }
}`,
				explanation: 'Three different LOD strategies with different performance/quality tradeoffs',
			},
		],
	},
];

/**
 * All synthesized lessons from the research
 */
export function getAllLessons(): string[] {
	return terrainResearchData.flatMap((p) => p.lessonsForTKA);
}

/**
 * Get high-priority action items for TKA
 */
export function getActionItems(): Array<{ priority: 'high' | 'medium' | 'low'; action: string; source: string }> {
	return [
		{
			priority: 'high',
			action: 'Implement SKIRTS for LOD gap hiding - industry standard, simpler than T-junction stitching',
			source: 'webgl-lod-landscape',
		},
		{
			priority: 'high',
			action: 'Adopt ping-pong buffer pattern for GPU compute iterations',
			source: 'WebGPU-Erosion-Simulation',
		},
		{
			priority: 'high',
			action: 'Add frustum-based LOD to only process visible chunks',
			source: 'geo-three',
		},
		{
			priority: 'medium',
			action: 'Implement fragment shader compute as WebGL fallback',
			source: 'VoxelWorld, OpenWorldJS',
		},
		{
			priority: 'medium',
			action: 'Pre-compute noise lookup tables for performance',
			source: 'OpenWorldJS',
		},
		{
			priority: 'medium',
			action: 'Consider erosion simulation for more natural terrain',
			source: 'Veloren, WebGPU-Erosion-Simulation',
		},
		{
			priority: 'low',
			action: 'Add multiple noise algorithm options to terrain generation',
			source: 'THREE.Terrain',
		},
		{
			priority: 'low',
			action: 'Sphere tracing as alternative rendering approach',
			source: 'WebGPU-Erosion-Simulation',
		},
	];
}

/**
 * Get projects by relevance score
 */
export function getProjectsByRelevance(minScore: number = 7): ProjectAnalysis[] {
	return terrainResearchData
		.filter((p) => p.relevanceScore >= minScore)
		.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
