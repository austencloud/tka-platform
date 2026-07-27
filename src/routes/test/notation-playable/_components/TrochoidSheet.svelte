<!--
  Trochoid model artifact: the sourced pattern sheet (static/caps/original/
  model.jpg — the model as Zaltymbunk posted it) presented as drafting film.
  The photograph is the artifact; nothing is traced or redrawn from it.
-->
<script lang="ts">
	let { active = false }: { active?: boolean } = $props();
</script>

<div class="drafting" class:active>
	<div class="film">
		<img
			src="/caps/original/model.jpg"
			alt="The trochoid model, as posted: patterns defined as two turn counts and two radii"
			loading="lazy"
		/>
		<div class="film-label" aria-hidden="true">
			<span class="formula">Θ₁ Θ₂ ; ρ₁ ρ₂</span>
		</div>
	</div>
</div>

<style>
	.drafting {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		padding: clamp(0.8rem, 4cqi, 2rem);
	}

	.film {
		position: relative;
		max-width: 100%;
		max-height: 100%;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid oklch(0.75 0.06 250 / 0.35);
		background: oklch(0.94 0.01 250);
		box-shadow:
			0 14px 34px oklch(0 0 0 / 0.45),
			inset 0 0 60px oklch(0.8 0.05 250 / 0.15);
		transition: box-shadow 400ms ease;
	}

	.drafting.active .film {
		box-shadow:
			0 18px 44px oklch(0 0 0 / 0.5),
			0 0 30px oklch(0.75 0.1 250 / 0.25),
			inset 0 0 60px oklch(0.8 0.05 250 / 0.15);
	}

	.film img {
		display: block;
		max-width: 100%;
		max-height: min(58cqh, 30rem);
		object-fit: contain;
	}

	.film-label {
		position: absolute;
		right: 0.7rem;
		bottom: 0.55rem;
		padding: 0.25rem 0.6rem;
		border-radius: 7px;
		background: oklch(0.2 0.03 250 / 0.85);
	}

	.formula {
		font-family: ui-monospace, "Cascadia Code", monospace;
		font-size: clamp(0.7rem, 2cqi, 0.95rem);
		color: oklch(0.85 0.06 250);
	}
</style>
