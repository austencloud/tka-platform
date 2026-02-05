<script lang="ts">
	import { authState } from '$lib/shared/auth/state/authState.svelte';
	import ReportsDashboard from './components/ReportsDashboard.svelte';
</script>

{#if authState.isAdmin}
	<ReportsDashboard />
{:else}
	<div class="access-denied">
		<i class="fa-solid fa-lock" aria-hidden="true"></i>
		<h2>Access Denied</h2>
		<p>You don't have permission to view this page.</p>
	</div>
{/if}

<style>
	.access-denied {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-xl, 48px);
		text-align: center;
	}

	.access-denied i {
		font-size: 64px;
		color: var(--theme-text-tertiary, rgba(255, 255, 255, 0.3));
	}

	.access-denied h2 {
		margin: 0;
		font-size: var(--font-size-xl, 20px);
		font-weight: 600;
		color: var(--theme-text, #ffffff);
	}

	.access-denied p {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
	}
</style>
