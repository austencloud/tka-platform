<script lang="ts">
	import { terrainResearchData, getActionItems, type ProjectAnalysis } from './terrain-research-data';

	// View modes
	type ViewMode = 'overview' | 'comparison' | 'deep-dive' | 'lessons';
	let viewMode: ViewMode = $state('overview');

	// Selected projects for comparison
	let selectedProjects: string[] = $state([]);
	let selectedProject: ProjectAnalysis | null = $state(null);

	// Comparison dimensions
	const dimensions = [
		{ key: 'chunkSystem', label: 'Chunk System', icon: '🧩' },
		{ key: 'gpuCompute', label: 'GPU Compute', icon: '⚡' },
		{ key: 'lodStrategy', label: 'LOD Strategy', icon: '🔭' },
		{ key: 'noiseAlgorithm', label: 'Noise/Terrain', icon: '🏔️' },
		{ key: 'stateManagement', label: 'State Mgmt', icon: '📊' },
		{ key: 'memoryStrategy', label: 'Memory', icon: '💾' },
	] as const;

	// Your current implementation for comparison
	const tkaImplementation: ProjectAnalysis = {
		name: 'TKA Realm (Current)',
		repo: 'local',
		stack: ['Svelte 5', 'Three.js', 'WebGPU/TSL', 'TypeScript', 'Web Workers'],
		description: 'Your current terrain implementation with hybrid GPU/CPU generation',
		relevanceScore: 10,
		chunkSystem: {
			approach: 'Grid-based with priority queue',
			dataStructure: 'Map<ChunkKey, ChunkState> + Octree',
			highlights: [
				'Direction-aware loading prioritization',
				'Generation counter for re-stitch tracking',
				'Memory budget with LRU eviction',
				'T-junction stitching via neighbor LODs',
			],
			limitations: [
				'Still debugging consistency issues',
				'Re-stitching can cascade',
			],
		},
		gpuCompute: {
			approach: 'WebGPU compute shaders via TSL',
			dataFlow: 'Uniforms → Compute → Storage Buffer → CPU Readback',
			highlights: [
				'Separate WebGPU renderer for compute',
				'Reusable storage buffers',
				'CPU fallback when WebGPU unavailable',
			],
			limitations: [
				'Readback latency',
				'Browser support varies',
			],
		},
		lodStrategy: {
			approach: 'Distance-based with max 1 LOD difference constraint',
			transitions: 'Iterative constraint propagation',
			highlights: [
				'8-neighbor LOD coordination (including diagonals)',
				'Per-chunk resolution scaling',
			],
			limitations: [
				'No morphing between LOD levels yet',
				'Skirts not implemented',
			],
		},
		noiseAlgorithm: {
			approach: 'FBM noise with multiple octaves',
			biomes: 'Height-based with blend weights',
			highlights: [
				'6-channel splat mapping (grass, rock, dirt, sand, snow)',
				'Spawn clearing and stage zone support',
			],
			limitations: [],
		},
		stateManagement: {
			approach: 'Plain objects + callbacks',
			highlights: ['Simple, no framework dependency'],
			limitations: ['No reactive updates to UI'],
		},
		memoryStrategy: {
			approach: 'Budget-based LRU eviction',
			highlights: [
				'Per-chunk memory tracking',
				'Configurable budget (default 256MB)',
			],
			limitations: [],
		},
		lessonsForTKA: [],
		codeSnippets: [],
	};

	function toggleProject(name: string) {
		if (selectedProjects.includes(name)) {
			selectedProjects = selectedProjects.filter((p) => p !== name);
		} else if (selectedProjects.length < 3) {
			selectedProjects = [...selectedProjects, name];
		}
	}

	function selectForDeepDive(project: ProjectAnalysis) {
		selectedProject = project;
		viewMode = 'deep-dive';
	}

	// Derive comparison data
	let comparisonProjects = $derived(
		[tkaImplementation, ...terrainResearchData].filter((p) =>
			selectedProjects.includes(p.name) || p.name === 'TKA Realm (Current)'
		)
	);
</script>

<div class="research-container">
	<header class="research-header">
		<h1>🌍 Terrain Research Lab</h1>
		<p class="subtitle">
			Comparing open-source terrain implementations to learn from real-world solutions
		</p>

		<nav class="view-tabs">
			<button
				class="tab"
				class:active={viewMode === 'overview'}
				onclick={() => (viewMode = 'overview')}
			>
				📋 Overview
			</button>
			<button
				class="tab"
				class:active={viewMode === 'comparison'}
				onclick={() => (viewMode = 'comparison')}
			>
				⚖️ Compare
			</button>
			<button
				class="tab"
				class:active={viewMode === 'deep-dive'}
				onclick={() => (viewMode = 'deep-dive')}
			>
				🔬 Deep Dive
			</button>
			<button
				class="tab"
				class:active={viewMode === 'lessons'}
				onclick={() => (viewMode = 'lessons')}
			>
				💡 Lessons
			</button>
		</nav>
	</header>

	<main class="research-content">
		{#if viewMode === 'overview'}
			<section class="overview-grid">
				<div class="tka-card featured">
					<div class="card-header">
						<span class="relevance-badge you">YOUR CODE</span>
						<h3>{tkaImplementation.name}</h3>
					</div>
					<p class="description">{tkaImplementation.description}</p>
					<div class="stack-tags">
						{#each tkaImplementation.stack as tech}
							<span class="tag">{tech}</span>
						{/each}
					</div>
					<button class="deep-dive-btn" onclick={() => selectForDeepDive(tkaImplementation)}>
						View Details →
					</button>
				</div>

				{#each terrainResearchData as project}
					<div class="project-card" class:selected={selectedProjects.includes(project.name)}>
						<div class="card-header">
							<span class="relevance-badge" class:high={project.relevanceScore >= 8}>
								{project.relevanceScore}/10 relevance
							</span>
							<h3>{project.name}</h3>
						</div>
						<p class="description">{project.description}</p>
						<div class="stack-tags">
							{#each project.stack as tech}
								<span class="tag">{tech}</span>
							{/each}
						</div>
						<div class="card-actions">
							<button
								class="compare-btn"
								class:active={selectedProjects.includes(project.name)}
								onclick={() => toggleProject(project.name)}
							>
								{selectedProjects.includes(project.name) ? '✓ Comparing' : '+ Compare'}
							</button>
							<button class="deep-dive-btn" onclick={() => selectForDeepDive(project)}>
								Deep Dive →
							</button>
						</div>
						{#if project.repo !== 'local'}
							<a href={project.repo} target="_blank" class="repo-link">
								View Repository ↗
							</a>
						{/if}
					</div>
				{/each}
			</section>

		{:else if viewMode === 'comparison'}
			<section class="comparison-view">
				{#if selectedProjects.length === 0}
					<div class="empty-state">
						<p>Select projects from the Overview tab to compare them side-by-side</p>
					</div>
				{:else}
					<div class="comparison-table">
						<div class="comparison-header">
							<div class="dimension-label"></div>
							{#each comparisonProjects as project}
								<div class="project-col-header">
									<h4>{project.name}</h4>
								</div>
							{/each}
						</div>

						{#each dimensions as dim}
							<div class="comparison-row">
								<div class="dimension-label">
									<span class="icon">{dim.icon}</span>
									<span>{dim.label}</span>
								</div>
								{#each comparisonProjects as project}
									{@const data = project[dim.key]}
									<div class="project-cell">
										{#if data}
											<div class="approach">
												<strong>Approach:</strong> {data.approach}
											</div>
											{#if data.highlights?.length}
												<ul class="highlights">
													{#each data.highlights.slice(0, 3) as highlight}
														<li class="pro">✓ {highlight}</li>
													{/each}
												</ul>
											{/if}
											{#if data.limitations?.length}
												<ul class="limitations">
													{#each data.limitations.slice(0, 2) as limitation}
														<li class="con">⚠ {limitation}</li>
													{/each}
												</ul>
											{/if}
										{:else}
											<span class="no-data">Not analyzed</span>
										{/if}
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			</section>

		{:else if viewMode === 'deep-dive'}
			<section class="deep-dive-view">
				{#if !selectedProject}
					<div class="empty-state">
						<p>Select a project from the Overview tab to see detailed analysis</p>
					</div>
				{:else}
					<div class="deep-dive-header">
						<button class="back-btn" onclick={() => (viewMode = 'overview')}>← Back</button>
						<h2>{selectedProject.name}</h2>
						{#if selectedProject.repo !== 'local'}
							<a href={selectedProject.repo} target="_blank" class="repo-link">
								View Repository ↗
							</a>
						{/if}
					</div>

					<div class="deep-dive-grid">
						{#each dimensions as dim}
							{@const data = selectedProject[dim.key]}
							{#if data}
								<div class="dimension-card">
									<h3>{dim.icon} {dim.label}</h3>
									<div class="approach-box">
										<label>Approach</label>
										<p>{data.approach}</p>
									</div>
									{#if data.dataStructure}
										<div class="detail-box">
											<label>Data Structure</label>
											<code>{data.dataStructure}</code>
										</div>
									{/if}
									{#if data.dataFlow}
										<div class="detail-box">
											<label>Data Flow</label>
											<code>{data.dataFlow}</code>
										</div>
									{/if}
									{#if data.transitions}
										<div class="detail-box">
											<label>Transitions</label>
											<p>{data.transitions}</p>
										</div>
									{/if}
									{#if data.biomes}
										<div class="detail-box">
											<label>Biomes</label>
											<p>{data.biomes}</p>
										</div>
									{/if}
									{#if data.highlights?.length}
										<div class="highlights-box">
											<label>Highlights</label>
											<ul>
												{#each data.highlights as h}
													<li class="pro">{h}</li>
												{/each}
											</ul>
										</div>
									{/if}
									{#if data.limitations?.length}
										<div class="limitations-box">
											<label>Limitations</label>
											<ul>
												{#each data.limitations as l}
													<li class="con">{l}</li>
												{/each}
											</ul>
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					{#if selectedProject.codeSnippets?.length}
						<div class="code-snippets">
							<h3>📝 Key Code Patterns</h3>
							{#each selectedProject.codeSnippets as snippet}
								<div class="snippet">
									<div class="snippet-header">
										<span class="snippet-title">{snippet.title}</span>
										<span class="snippet-file">{snippet.file}</span>
									</div>
									<pre><code>{snippet.code}</code></pre>
									{#if snippet.explanation}
										<p class="snippet-explanation">{snippet.explanation}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if selectedProject.lessonsForTKA?.length}
						<div class="lessons-section">
							<h3>💡 Lessons for TKA</h3>
							<ul class="lessons-list">
								{#each selectedProject.lessonsForTKA as lesson}
									<li>{lesson}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}
			</section>

		{:else if viewMode === 'lessons'}
			<section class="lessons-view">
				<h2>💡 Synthesized Lessons</h2>
				<p class="lessons-intro">
					Key patterns and insights extracted from analyzing {terrainResearchData.length} open-source terrain implementations.
				</p>

				<div class="lessons-grid">
					<div class="lesson-category">
						<h3>🧩 Chunk Management</h3>
						<ul>
							{#each terrainResearchData.flatMap(p => p.lessonsForTKA?.filter(l => l.toLowerCase().includes('chunk')) || []) as lesson}
								<li>{lesson}</li>
							{/each}
						</ul>
					</div>

					<div class="lesson-category">
						<h3>⚡ GPU Compute</h3>
						<ul>
							{#each terrainResearchData.flatMap(p => p.lessonsForTKA?.filter(l => l.toLowerCase().includes('gpu') || l.toLowerCase().includes('shader') || l.toLowerCase().includes('compute')) || []) as lesson}
								<li>{lesson}</li>
							{/each}
						</ul>
					</div>

					<div class="lesson-category">
						<h3>🔭 LOD Strategies</h3>
						<ul>
							{#each terrainResearchData.flatMap(p => p.lessonsForTKA?.filter(l => l.toLowerCase().includes('lod') || l.toLowerCase().includes('detail') || l.toLowerCase().includes('transition')) || []) as lesson}
								<li>{lesson}</li>
							{/each}
						</ul>
					</div>

					<div class="lesson-category">
						<h3>🏔️ Terrain Generation</h3>
						<ul>
							{#each terrainResearchData.flatMap(p => p.lessonsForTKA?.filter(l => l.toLowerCase().includes('terrain') || l.toLowerCase().includes('noise') || l.toLowerCase().includes('biome')) || []) as lesson}
								<li>{lesson}</li>
							{/each}
						</ul>
					</div>
				</div>

				<div class="action-items">
					<h3>🎯 Suggested Action Items for TKA</h3>
					<div class="action-list">
						{#each getActionItems() as item}
							<div class="action-item priority-{item.priority}">
								<span class="priority">{item.priority === 'high' ? 'HIGH' : item.priority === 'medium' ? 'MED' : 'LOW'}</span>
								<div class="action-content">
									<p>{item.action}</p>
									<span class="source">Source: {item.source}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.research-container {
		min-height: 100vh;
		background: var(--theme-panel-bg, #0a0a12);
		color: var(--theme-text, #e8e8e8);
		padding: 2rem;
	}

	.research-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.research-header h1 {
		font-size: 2rem;
		margin: 0 0 0.5rem;
	}

	.subtitle {
		color: var(--theme-text-muted, #888);
		margin: 0 0 1.5rem;
	}

	.view-tabs {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: transparent;
		color: var(--theme-text, #e8e8e8);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
	}

	.tab.active {
		background: var(--theme-accent, #4a9eff);
		border-color: var(--theme-accent, #4a9eff);
		color: white;
	}

	/* Overview Grid */
	.overview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.project-card,
	.tka-card {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.tka-card.featured {
		border-color: var(--theme-accent, #4a9eff);
		background: rgba(74, 158, 255, 0.1);
	}

	.project-card.selected {
		border-color: #4ade80;
		background: rgba(74, 222, 128, 0.1);
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-header h3 {
		margin: 0;
		font-size: 1.2rem;
	}

	.relevance-badge {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.1);
		width: fit-content;
	}

	.relevance-badge.high {
		background: rgba(74, 222, 128, 0.2);
		color: #4ade80;
	}

	.relevance-badge.you {
		background: rgba(74, 158, 255, 0.3);
		color: #4a9eff;
	}

	.description {
		color: var(--theme-text-muted, #888);
		font-size: 0.9rem;
		margin: 0;
		flex-grow: 1;
	}

	.stack-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 4px;
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
	}

	.compare-btn,
	.deep-dive-btn {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: transparent;
		color: var(--theme-text, #e8e8e8);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.2s;
	}

	.compare-btn:hover,
	.deep-dive-btn:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
	}

	.compare-btn.active {
		background: rgba(74, 222, 128, 0.2);
		border-color: #4ade80;
		color: #4ade80;
	}

	.repo-link {
		color: var(--theme-accent, #4a9eff);
		font-size: 0.85rem;
		text-decoration: none;
	}

	.repo-link:hover {
		text-decoration: underline;
	}

	/* Comparison View */
	.comparison-view {
		overflow-x: auto;
	}

	.comparison-table {
		min-width: 800px;
	}

	.comparison-header,
	.comparison-row {
		display: grid;
		grid-template-columns: 150px repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
		padding: 1rem;
	}

	.comparison-header {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 8px 8px 0 0;
		position: sticky;
		top: 0;
	}

	.comparison-row {
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
	}

	.comparison-row:nth-child(even) {
		background: rgba(255, 255, 255, 0.02);
	}

	.dimension-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.dimension-label .icon {
		font-size: 1.2rem;
	}

	.project-col-header h4 {
		margin: 0;
		font-size: 1rem;
	}

	.project-cell {
		font-size: 0.85rem;
	}

	.project-cell .approach {
		margin-bottom: 0.5rem;
	}

	.project-cell ul {
		margin: 0.25rem 0;
		padding-left: 1rem;
	}

	.project-cell li {
		margin: 0.25rem 0;
	}

	.project-cell li.pro {
		color: #4ade80;
	}

	.project-cell li.con {
		color: #fbbf24;
	}

	.no-data {
		color: var(--theme-text-muted, #666);
		font-style: italic;
	}

	/* Deep Dive View */
	.deep-dive-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.back-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: transparent;
		color: var(--theme-text, #e8e8e8);
		border-radius: 6px;
		cursor: pointer;
	}

	.deep-dive-header h2 {
		margin: 0;
		flex-grow: 1;
	}

	.deep-dive-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.dimension-card {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		padding: 1.5rem;
	}

	.dimension-card h3 {
		margin: 0 0 1rem;
		font-size: 1.1rem;
	}

	.approach-box,
	.detail-box,
	.highlights-box,
	.limitations-box {
		margin-bottom: 1rem;
	}

	.dimension-card label {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--theme-text-muted, #888);
		display: block;
		margin-bottom: 0.25rem;
	}

	.dimension-card code {
		background: rgba(0, 0, 0, 0.3);
		padding: 0.5rem;
		border-radius: 4px;
		display: block;
		font-size: 0.85rem;
		overflow-x: auto;
	}

	.dimension-card ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.dimension-card li {
		margin: 0.25rem 0;
		font-size: 0.9rem;
	}

	.dimension-card li.pro {
		color: #4ade80;
	}

	.dimension-card li.con {
		color: #fbbf24;
	}

	/* Code Snippets */
	.code-snippets {
		margin-top: 2rem;
	}

	.code-snippets h3 {
		margin-bottom: 1rem;
	}

	.snippet {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		margin-bottom: 1rem;
		overflow: hidden;
	}

	.snippet-header {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.snippet-title {
		font-weight: 600;
	}

	.snippet-file {
		color: var(--theme-text-muted, #888);
		font-size: 0.85rem;
	}

	.snippet pre {
		margin: 0;
		padding: 1rem;
		overflow-x: auto;
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.snippet-explanation {
		padding: 0.75rem 1rem;
		background: rgba(74, 158, 255, 0.1);
		margin: 0;
		font-size: 0.9rem;
		color: var(--theme-text-muted, #aaa);
	}

	/* Lessons View */
	.lessons-view {
		max-width: 1200px;
		margin: 0 auto;
	}

	.lessons-intro {
		text-align: center;
		color: var(--theme-text-muted, #888);
		margin-bottom: 2rem;
	}

	.lessons-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.lesson-category {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		padding: 1.5rem;
	}

	.lesson-category h3 {
		margin: 0 0 1rem;
	}

	.lesson-category ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.lesson-category li {
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}

	.action-items {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		padding: 1.5rem;
	}

	.action-items h3 {
		margin: 0 0 1rem;
	}

	.action-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.action-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}

	.action-item .priority {
		font-size: 0.7rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
	}

	.action-item.priority-high .priority {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	.action-item.priority-medium .priority {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.action-item.priority-low .priority {
		background: rgba(148, 163, 184, 0.2);
		color: #94a3b8;
	}

	.action-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.action-item p {
		margin: 0;
		font-size: 0.9rem;
	}

	.action-item .source {
		font-size: 0.75rem;
		color: var(--theme-text-muted, #666);
	}

	/* Empty States */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--theme-text-muted, #888);
	}
</style>
