<script lang="ts">
	interface Props {
		size?: "sm" | "md";
		tooltip?: string;
	}

	let { size = "sm", tooltip = "Premium feature" }: Props = $props();

	const sizeMap = {
		sm: "0.75rem",
		md: "1rem",
	};
</script>

<span
	class="premium-badge"
	style:font-size={sizeMap[size]}
	title={tooltip}
	aria-label={tooltip}
>
	<i class="fas fa-crown" aria-hidden="true"></i>
</span>

<style>
	.premium-badge {
		color: #fbbf24;
		display: inline-flex;
		align-items: center;
		cursor: help;
	}
</style>
