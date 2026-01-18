<!--
	PropTrackingLabModule.svelte

	Module wrapper for the Prop Tracking Lab.
	Provides the proof-of-concept for video-to-TKA notation conversion.

	Access: Testers and Admins only (experimental feature)
-->
<script lang="ts">
	import PropTrackingLab from './PropTrackingLab.svelte';
</script>

<div class="prop-tracking-lab-module">
	<PropTrackingLab />
</div>

<style>
	.prop-tracking-lab-module {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
