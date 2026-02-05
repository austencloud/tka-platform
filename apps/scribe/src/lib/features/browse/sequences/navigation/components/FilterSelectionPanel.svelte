<script lang="ts">
  import QuickAccessSection from "./QuickAccessSection.svelte";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const { onFilterSelected = () => {} } = $props<{
    onFilterSelected?: (data: { type: string; value: unknown }) => void;
  }>();

  function handleQuickAccess(data: { type: string; value: unknown }) {
    // Call callback prop instead of dispatching event
    onFilterSelected({ type: data.type, value: data.value });
  }
</script>

<div class="filter-selection-panel">
  <div class="main-container">
    <div class="content-container">
      <!-- Header Section (fixed height) -->
      <div class="header-section">
        <!-- Header + Quick Access on same line -->
        <div class="header-row">
          <!-- Header on left -->
          <div class="header-content">
            <h1 class="header-title">Sequence Library</h1>
          </div>

          <!-- Stretch to push Quick Access to right -->
          <div class="header-spacer"></div>

          <!-- Quick Access buttons on right -->
          <QuickAccessSection onQuickAccess={handleQuickAccess} />
        </div>
      </div>

      <!-- Note: Accordion navigation removed - filtering is now handled by left-side navigation -->
    </div>
  </div>
</div>

<style>
  .filter-selection-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Main container with centering */
  /* Main container takes full width */
  .main-container {
    display: flex;
    height: 100%;
    align-items: stretch;
    width: 100%;
  }

  /* Content container takes full available width */
  .content-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 40px;
  }

  /* Header Section (fixed height) */
  .header-section {
    flex-shrink: 0;
    max-height: 120px;
    margin-bottom: 36px;
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .header-content {
    flex: 0 0 auto;
  }

  .header-spacer {
    flex: 1;
  }

  .header-title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: white;
    margin: 0;
    text-align: center;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .content-container {
      min-width: 400px;
      max-width: 500px;
      padding: 30px;
    }
  }

  @media (max-width: 768px) {
    .content-container {
      min-width: 300px;
      max-width: 400px;
      padding: 20px;
    }

    .header-row {
      flex-direction: column;
      gap: var(--spacing-md);
      align-items: flex-start;
    }

    .header-spacer {
      display: none;
    }

    .header-title {
      font-size: var(--font-size-2xl);
    }
  }
</style>
