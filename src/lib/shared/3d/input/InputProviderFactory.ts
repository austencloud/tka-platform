/**
 * InputProviderFactory
 *
 * Creates the appropriate input provider(s) based on InputCapabilities.
 * Handles combining multiple providers (e.g., keyboard + pointer lock + gamepad).
 */

import type { IInputProvider, LookDelta, MovementInput, InputProviderConfig } from "./contracts/IInputProvider";
import { KeyboardProvider } from "./providers/KeyboardProvider";
import { TouchLookProvider } from "./providers/TouchLookProvider";
import { PointerLockProvider } from "./providers/PointerLockProvider";
import { GamepadProvider } from "./providers/GamepadProvider";

/**
 * Composite provider that combines multiple input sources
 */
class CompositeInputProvider implements IInputProvider {
	readonly type = "composite" as const;

	private providers: IInputProvider[] = [];
	private enabled = false;

	addProvider(provider: IInputProvider): void {
		this.providers.push(provider);
		if (this.enabled) {
			provider.enable();
		}
	}

	getLookDelta(): LookDelta {
		let yaw = 0;
		let pitch = 0;

		for (const provider of this.providers) {
			const delta = provider.getLookDelta();
			yaw += delta.yaw;
			pitch += delta.pitch;
		}

		return { yaw, pitch };
	}

	getMovementInput(): MovementInput {
		let forward = 0;
		let strafe = 0;

		for (const provider of this.providers) {
			const input = provider.getMovementInput();
			// Use max absolute value to allow any provider to contribute
			if (Math.abs(input.forward) > Math.abs(forward)) forward = input.forward;
			if (Math.abs(input.strafe) > Math.abs(strafe)) strafe = input.strafe;
		}

		return { forward, strafe };
	}

	isJumpPressed(): boolean {
		return this.providers.some((p) => p.isJumpPressed());
	}

	isSprintHeld(): boolean {
		return this.providers.some((p) => p.isSprintHeld());
	}

	update(deltaTime: number): void {
		for (const provider of this.providers) {
			provider.update(deltaTime);
		}
	}

	enable(): void {
		if (this.enabled) return;
		this.enabled = true;
		for (const provider of this.providers) {
			provider.enable();
		}
	}

	disable(): void {
		if (!this.enabled) return;
		this.enabled = false;
		for (const provider of this.providers) {
			provider.disable();
		}
	}

	dispose(): void {
		for (const provider of this.providers) {
			provider.dispose();
		}
		this.providers = [];
		this.enabled = false;
	}

	/**
	 * Get a specific provider by type
	 */
	getProvider<T extends IInputProvider>(type: IInputProvider["type"]): T | null {
		return (this.providers.find((p) => p.type === type) as T) ?? null;
	}
}

export interface InputCapabilitiesLike {
	current: {
		currentPointerType: "mouse" | "touch" | "pen" | null;
		hasGamepad: boolean;
		isPointerLocked: boolean;
	};
	shouldShowTouchUI(): boolean;
	canUsePointerLock(): boolean;
}

export interface InputProviderFactoryOptions {
	element: HTMLElement;
	config?: InputProviderConfig;
	/** Include gamepad support */
	enableGamepad?: boolean;
	/** Include keyboard for movement */
	enableKeyboard?: boolean;
}

/**
 * Create input providers based on current capabilities
 */
export function createInputProvider(
	capabilities: InputCapabilitiesLike,
	options: InputProviderFactoryOptions
): IInputProvider {
	const { element, config = {}, enableGamepad = true, enableKeyboard = true } = options;

	const composite = new CompositeInputProvider();

	// Always add keyboard if enabled (works on all platforms)
	if (enableKeyboard) {
		composite.addProvider(new KeyboardProvider(config));
	}

	// Add look provider based on current pointer type
	if (capabilities.shouldShowTouchUI()) {
		// Touch mode: use touch look provider
		composite.addProvider(new TouchLookProvider(element, config));
	} else {
		// Mouse mode: use pointer lock provider
		composite.addProvider(new PointerLockProvider(element, config));
	}

	// Add gamepad if enabled and available
	if (enableGamepad && capabilities.current.hasGamepad) {
		composite.addProvider(new GamepadProvider(config));
	}

	return composite;
}

/**
 * Create a provider that switches based on active input type
 */
export class AdaptiveInputProvider implements IInputProvider {
	readonly type = "composite" as const;

	private touchProvider: TouchLookProvider;
	private pointerLockProvider: PointerLockProvider;
	private keyboardProvider: KeyboardProvider;
	private gamepadProvider: GamepadProvider;

	private capabilities: InputCapabilitiesLike;
	private enabled = false;

	constructor(
		capabilities: InputCapabilitiesLike,
		element: HTMLElement,
		config: InputProviderConfig = {}
	) {
		this.capabilities = capabilities;

		this.touchProvider = new TouchLookProvider(element, config);
		this.pointerLockProvider = new PointerLockProvider(element, config);
		this.keyboardProvider = new KeyboardProvider(config);
		this.gamepadProvider = new GamepadProvider(config);
	}

	private get activeLookProvider(): IInputProvider {
		if (this.capabilities.shouldShowTouchUI()) {
			return this.touchProvider;
		}
		return this.pointerLockProvider;
	}

	getLookDelta(): LookDelta {
		// Combine look from active provider and gamepad
		const primary = this.activeLookProvider.getLookDelta();
		const gamepad = this.gamepadProvider.getLookDelta();

		return {
			yaw: primary.yaw + gamepad.yaw,
			pitch: primary.pitch + gamepad.pitch,
		};
	}

	getMovementInput(): MovementInput {
		// Combine keyboard and gamepad movement
		const keyboard = this.keyboardProvider.getMovementInput();
		const gamepad = this.gamepadProvider.getMovementInput();

		// Use whichever has larger magnitude
		const kMag = Math.abs(keyboard.forward) + Math.abs(keyboard.strafe);
		const gMag = Math.abs(gamepad.forward) + Math.abs(gamepad.strafe);

		return kMag > gMag ? keyboard : gamepad;
	}

	isJumpPressed(): boolean {
		return this.keyboardProvider.isJumpPressed() || this.gamepadProvider.isJumpPressed();
	}

	isSprintHeld(): boolean {
		return this.keyboardProvider.isSprintHeld() || this.gamepadProvider.isSprintHeld();
	}

	update(deltaTime: number): void {
		this.touchProvider.update(deltaTime);
		this.pointerLockProvider.update(deltaTime);
		this.keyboardProvider.update(deltaTime);
		this.gamepadProvider.update(deltaTime);
	}

	enable(): void {
		if (this.enabled) return;
		this.enabled = true;

		this.touchProvider.enable();
		this.pointerLockProvider.enable();
		this.keyboardProvider.enable();
		this.gamepadProvider.enable();
	}

	disable(): void {
		if (!this.enabled) return;
		this.enabled = false;

		this.touchProvider.disable();
		this.pointerLockProvider.disable();
		this.keyboardProvider.disable();
		this.gamepadProvider.disable();
	}

	dispose(): void {
		this.touchProvider.dispose();
		this.pointerLockProvider.dispose();
		this.keyboardProvider.dispose();
		this.gamepadProvider.dispose();
		this.enabled = false;
	}

	/**
	 * Get the pointer lock provider for manual lock requests
	 */
	getPointerLockProvider(): PointerLockProvider {
		return this.pointerLockProvider;
	}
}
