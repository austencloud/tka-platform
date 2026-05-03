
export class KeyboardNavigator {
  private focusedIndex: number = -1;
  private enabled: boolean = false;
  private focusSubscriptions = new Set<(index: number) => void>();

  handleArrowKey(direction: "up" | "down" | "left" | "right"): void {
    if (!this.enabled) return;

    switch (direction) {
      case "up":
        this.moveFocus(-1);
        break;
      case "down":
        this.moveFocus(1);
        break;
      case "left":
        // Could be used for horizontal navigation in future
        break;
      case "right":
        // Could be used for horizontal navigation in future
        break;
    }
  }

  handleEnterKey(): void {
    if (!this.enabled || this.focusedIndex < 0) return;

    // Find the focused element and trigger click
    const focusedElement = this.getFocusedElement();
    if (focusedElement && focusedElement instanceof HTMLButtonElement) {
      focusedElement.click();
    }
  }

  handleEscapeKey(): void {
    if (!this.enabled) return;

    // Reset focus and emit escape event
    this.setFocusedIndex(-1);

    // Trigger close behavior - could emit custom event
    const event = new CustomEvent("keyboard-navigation-escape");
    document.dispatchEvent(event);
  }

  handleTabKey(shiftPressed: boolean): void {
    if (!this.enabled) return;

    const direction = shiftPressed ? -1 : 1;
    this.moveFocus(direction);
  }

  setFocusedIndex(index: number): void {
    const oldIndex = this.focusedIndex;
    this.focusedIndex = index;

    if (oldIndex !== index) {
      this.updateFocusedElement(oldIndex, index);
      this.notifyFocusChange(index);
    }
  }

  getFocusedIndex(): number {
    return this.focusedIndex;
  }

  enable(): void {
    this.enabled = true;
    this.setupEventListeners();
  }

  disable(): void {
    this.enabled = false;
    this.focusedIndex = -1;
    this.removeEventListeners();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  onFocusChange(callback: (index: number) => void): () => void {
    this.focusSubscriptions.add(callback);
    return () => {
      this.focusSubscriptions.delete(callback);
    };
  }

  private moveFocus(direction: number): void {
    const selectableElements = this.getSelectableElements();
    if (selectableElements.length === 0) return;

    let newIndex = this.focusedIndex + direction;

    // Wrap around navigation
    if (newIndex >= selectableElements.length) {
      newIndex = 0;
    } else if (newIndex < 0) {
      newIndex = selectableElements.length - 1;
    }

    this.setFocusedIndex(newIndex);
  }

  private getSelectableElements(): NodeListOf<HTMLElement> {
    // Get all focusable elements within the module selector
    return document.querySelectorAll(
      ".dropdown-module-item, .mobile-module-card, .cancel-button, .close-button"
    );
  }

  private getFocusedElement(): HTMLElement | null {
    const selectableElements = this.getSelectableElements();
    return selectableElements[this.focusedIndex] ?? null;
  }

  private updateFocusedElement(oldIndex: number, newIndex: number): void {
    const selectableElements = this.getSelectableElements();

    // Remove focus from old element
    if (oldIndex >= 0 && oldIndex < selectableElements.length) {
      const oldElement = selectableElements[oldIndex];
      if (oldElement) {
        oldElement.blur();
        oldElement.classList.remove("keyboard-focused");
      }
    }

    // Add focus to new element
    if (newIndex >= 0 && newIndex < selectableElements.length) {
      const newElement = selectableElements[newIndex];
      if (newElement) {
        newElement.focus();
        newElement.classList.add("keyboard-focused");
      }
    }
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        this.handleArrowKey("up");
        break;
      case "ArrowDown":
        event.preventDefault();
        this.handleArrowKey("down");
        break;
      case "ArrowLeft":
        event.preventDefault();
        this.handleArrowKey("left");
        break;
      case "ArrowRight":
        event.preventDefault();
        this.handleArrowKey("right");
        break;
      case "Enter":
        event.preventDefault();
        this.handleEnterKey();
        break;
      case "Escape":
        event.preventDefault();
        this.handleEscapeKey();
        break;
      case "Tab":
        event.preventDefault();
        this.handleTabKey(event.shiftKey);
        break;
    }
  };

  private setupEventListeners(): void {
    document.addEventListener("keydown", this.handleKeydown);
  }

  private removeEventListeners(): void {
    document.removeEventListener("keydown", this.handleKeydown);
  }

  private notifyFocusChange(index: number): void {
    this.focusSubscriptions.forEach((callback) => callback(index));
  }
}
