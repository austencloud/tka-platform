<script lang="ts">
	const DOORWAYS = [
		{
			href: '/create',
			icon: 'fas fa-pen-nib',
			iconClass: 'composer',
			title: 'The Composer',
			desc: 'Build sequences or generate them from a word. Animate and export.'
		},
		{
			href: '/browse',
			icon: 'fas fa-book-open',
			iconClass: 'library',
			title: 'Sequence Library',
			desc: '2,800+ sequences. Browse, filter, find patterns.'
		},
		{
			href: 'https://youtube.com/@tkaflowarts',
			icon: 'fas fa-play-circle',
			iconClass: 'tutorials',
			title: 'Watch Tutorials',
			desc: 'Video walkthroughs for each prop type.'
		},
		{
			href: '/about',
			icon: 'fas fa-seedling',
			iconClass: 'about',
			title: 'About & Roots',
			desc: 'Where TKA came from. The ideas behind it.'
		}
	];
</script>

<section class="whats-here">
	<h2>What's here</h2>
	<div class="grid">
		{#each DOORWAYS as doorway}
			<a
				href={doorway.href}
				class="card"
				target={doorway.href.startsWith('http') ? '_blank' : undefined}
				rel={doorway.href.startsWith('http') ? 'noopener noreferrer' : undefined}
			>
				<div class="icon-badge {doorway.iconClass}">
					<i class={doorway.icon} aria-hidden="true"></i>
				</div>
				<div class="content">
					<div class="title">{doorway.title}</div>
					<div class="desc">{doorway.desc}</div>
				</div>
				<div class="arrow">→</div>
			</a>
		{/each}
	</div>
</section>

<style>
	.whats-here {
		max-width: 960px;
		margin: 0 auto;
		padding: 72px 24px;
	}

	h2 {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: clamp(1.7rem, 3.5vw, 2.3rem);
		font-weight: 400;
		margin-bottom: 32px;
		color: inherit;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}

	.card {
		background: rgba(255, 240, 220, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		padding: 22px 24px;
		display: flex;
		gap: 16px;
		align-items: flex-start;
		text-decoration: none;
		color: inherit;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			transform 0.2s ease;
	}

	.card:hover {
		border-color: rgba(212, 129, 58, 0.25);
		box-shadow: 0 0 20px rgba(212, 129, 58, 0.15);
		transform: translateY(-2px);
	}

	.card:hover .arrow {
		transform: translateX(3px);
		color: #d4813a;
	}

	.icon-badge {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		flex-shrink: 0;
	}

	.icon-badge.composer {
		background: rgba(99, 102, 241, 0.12);
		color: #818cf8;
	}

	.icon-badge.library {
		background: rgba(34, 197, 94, 0.12);
		color: #4ade80;
	}

	.icon-badge.tutorials {
		background: rgba(244, 114, 182, 0.12);
		color: #f472b6;
	}

	.icon-badge.about {
		background: rgba(212, 129, 58, 0.12);
		color: #d4813a;
	}

	.content {
		flex: 1;
		min-width: 0;
	}

	.title {
		font-family: 'Instrument Serif', Georgia, serif;
		font-size: 1.1rem;
		font-weight: 400;
		margin-bottom: 4px;
	}

	.desc {
		font-size: 0.85rem;
		color: rgba(168, 159, 148, 1);
		line-height: 1.5;
	}

	.arrow {
		font-size: 1rem;
		opacity: 0.5;
		flex-shrink: 0;
		transition:
			transform 0.2s ease,
			color 0.2s ease;
		align-self: center;
	}

	@media (max-width: 600px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
