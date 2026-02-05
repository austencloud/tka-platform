/**
 * Audio Library State
 *
 * Manages the audio library panel open/close state.
 */

class AudioLibraryState {
  isOpen = $state(false);

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }
}

export const audioLibraryState = new AudioLibraryState();
