/**
 * FuseAssemblyAnimator
 *
 * Animates both fuse panels sliding toward the center target using the same
 * FLIP technique and easing curve as DisassembleTransition. Both panels
 * translate + scale toward the target rect over 600ms, then fade out during
 * the last 150ms. Respects prefers-reduced-motion by resolving immediately.
 */

import type { IFuseAssemblyAnimator } from "../contracts/IFuseAssemblyAnimator";

const DURATION = 600;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const FADE_DURATION = 150;

function calcFlipTransform(
	sourceRect: DOMRect,
	targetRect: DOMRect
): { tx: number; ty: number; sx: number; sy: number } {
	const sourceCenterX = sourceRect.left + sourceRect.width / 2;
	const sourceCenterY = sourceRect.top + sourceRect.height / 2;
	const targetCenterX = targetRect.left + targetRect.width / 2;
	const targetCenterY = targetRect.top + targetRect.height / 2;

	return {
		tx: targetCenterX - sourceCenterX,
		ty: targetCenterY - sourceCenterY,
		sx: targetRect.width / sourceRect.width,
		sy: targetRect.height / sourceRect.height,
	};
}

function cancelAllAnimations(elements: HTMLElement[]): void {
	for (const el of elements) {
		for (const anim of el.getAnimations()) {
			anim.cancel();
		}
	}
}

export class FuseAssemblyAnimator implements IFuseAssemblyAnimator {
	async animate(
		leftEl: HTMLElement,
		rightEl: HTMLElement,
		targetEl: HTMLElement
	): Promise<void> {
		// Respect reduced motion preference - skip animation entirely
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const leftRect = leftEl.getBoundingClientRect();
		const rightRect = rightEl.getBoundingClientRect();
		const targetRect = targetEl.getBoundingClientRect();

		const leftFlip = calcFlipTransform(leftRect, targetRect);
		const rightFlip = calcFlipTransform(rightRect, targetRect);

		const moveOpts: KeyframeAnimationOptions = {
			duration: DURATION,
			easing: EASING,
			fill: "both",
		};

		// Slide both panels toward center
		leftEl.animate(
			[
				{ transform: "translate(0, 0) scale(1)" },
				{
					transform: `translate(${leftFlip.tx}px, ${leftFlip.ty}px) scale(${leftFlip.sx}, ${leftFlip.sy})`,
				},
			],
			moveOpts
		);

		const mainAnim = rightEl.animate(
			[
				{ transform: "translate(0, 0) scale(1)" },
				{
					transform: `translate(${rightFlip.tx}px, ${rightFlip.ty}px) scale(${rightFlip.sx}, ${rightFlip.sy})`,
				},
			],
			moveOpts
		);

		// Fade both panels out during the last 150ms
		const fadeOpts: KeyframeAnimationOptions = {
			duration: FADE_DURATION,
			delay: DURATION - FADE_DURATION,
			easing: "ease-in",
			fill: "both",
		};

		leftEl.animate([{ opacity: 1 }, { opacity: 0 }], fadeOpts);
		rightEl.animate([{ opacity: 1 }, { opacity: 0 }], fadeOpts);

		// Wait for the main animation to finish, then clean up
		await mainAnim.finished;
		cancelAllAnimations([leftEl, rightEl]);
	}
}
