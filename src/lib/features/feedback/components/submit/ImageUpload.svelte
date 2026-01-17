<!-- ImageUpload - Upload and preview images for feedback -->
<script lang="ts">
  import { onMount } from "svelte";

  // Props
  const {
    images = $bindable([]),
    maxImages = 5,
    disabled = false,
  } = $props<{
    images?: File[];
    maxImages?: number;
    disabled?: boolean;
  }>();

  let fileInput: HTMLInputElement | undefined = $state(undefined);
  let isDragging = $state(false);
  let previews = $state<{ file: File; url: string }[]>([]);

  // Track previous URLs for cleanup
  let previousUrls: string[] = [];

  // Generate previews when images change
  $effect(() => {
    // Clean up old previews
    previousUrls.forEach((url) => URL.revokeObjectURL(url));

    // Generate new previews
    const newPreviews = images.map((file: File) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    // Store URLs for next cleanup
    previousUrls = newPreviews.map((p: { file: File; url: string }) => p.url);

    // Update previews
    previews = newPreviews;

    // Clean up on unmount
    return () => {
      previousUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  // Handle file selection
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      addFiles(Array.from(target.files));
      target.value = ""; // Reset input
    }
  }

  // Handle drag and drop
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    if (disabled) return;

    const files = event.dataTransfer?.files;
    if (files) {
      addFiles(Array.from(files));
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!disabled) {
      isDragging = true;
    }
  }

  function handleDragLeave() {
    isDragging = false;
  }

  // Handle clipboard paste
  function handlePaste(event: ClipboardEvent) {
    if (disabled) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      event.preventDefault();
      addFiles(imageFiles);
    }
  }

  // Add files to the list
  function addFiles(newFiles: File[]) {
    const imageFiles = newFiles.filter((file) =>
      file.type.startsWith("image/")
    );
    const remainingSlots = maxImages - images.length;
    const filesToAdd = imageFiles.slice(0, remainingSlots);

    // Mutate in place to work with $bindable
    images.push(...filesToAdd);
  }

  // Remove a file
  function removeImage(index: number) {
    // Mutate in place to work with $bindable
    images.splice(index, 1);
  }

  // Set up paste listener
  onMount(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  });
</script>

<div class="image-upload">
  <!-- Minimal upload button -->
  {#if images.length < maxImages}
    <button
      type="button"
      class="upload-button"
      class:dragging={isDragging}
      onclick={() => !disabled && fileInput?.click()}
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      {disabled}
      title="Upload image or paste screenshot"
    >
      <i class="fas fa-paperclip" aria-hidden="true"></i>
      <span>Attach image</span>
    </button>
    <input
      type="file"
      bind:this={fileInput}
      onchange={handleFileSelect}
      accept="image/*"
      multiple
      {disabled}
      aria-label="Upload images"
      class="sr-only"
    />
  {/if}

  <!-- Previews -->
  {#if previews.length > 0}
    <div class="previews">
      {#each previews as { file, url }, index}
        <div class="preview-item">
          <img src={url} alt={file.name} />
          <button
            type="button"
            class="remove-btn"
            onclick={() => removeImage(index)}
            {disabled}
            aria-label="Remove image"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
          <div class="preview-name">{file.name}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .image-upload {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .upload-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    min-height: var(--min-touch-target, 44px); /* WCAG AAA touch target */
    padding: 0 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 6px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .upload-button:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(
      in srgb,
      var(--theme-stroke-strong) 150%,
      transparent
    );
    color: var(--theme-text);
  }

  .upload-button.dragging {
    border-color: var(--theme-accent-strong, var(--theme-accent));
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, var(--theme-accent)) 15%,
      transparent
    );
    color: var(--theme-accent-strong, var(--theme-accent));
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent)) 20%,
        transparent
      );
  }

  .upload-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .upload-button i {
    font-size: 0.75rem;
  }

  .previews {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }

  .preview-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.7);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .remove-btn:hover:not(:disabled) {
    background: var(--semantic-error, var(--semantic-error));
    transform: scale(1.1);
  }

  .remove-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .preview-name {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px 8px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    color: var(--theme-text, var(--theme-text));
    font-size: 0.6875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
