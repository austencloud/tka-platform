<script lang="ts">
  import type { SheetSize } from "../domain/sticker-types";

  interface Props {
    value: SheetSize;
    onChange: (size: SheetSize) => void;
  }
  let { value, onChange }: Props = $props();

  const sizes: Array<{ id: SheetSize; label: string; sub: string }> = [
    { id: "8.5x11", label: "Letter", sub: "8.5 × 11 in" },
    { id: "13x19", label: "Tabloid", sub: "13 × 19 in" },
  ];
</script>

<fieldset class="picker">
  <legend>Sheet size</legend>
  {#each sizes as s}
    <label class:active={value === s.id}>
      <input
        type="radio"
        name="sheet-size"
        value={s.id}
        checked={value === s.id}
        onchange={() => onChange(s.id)}
      />
      <div>
        <strong>{s.label}</strong>
        <span>{s.sub}</span>
      </div>
    </label>
  {/each}
</fieldset>

<style>
  .picker {
    border: none;
    padding: 0;
    margin: 0 0 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  legend {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-muted, rgba(255,255,255,0.5));
    margin-bottom: 4px;
  }
  label {
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
    cursor: pointer;
    align-items: center;
    font-size: 12px;
  }
  label.active { background: rgba(139, 92, 246, 0.15); }
  label div { display: flex; flex-direction: column; }
  label strong { color: white; font-weight: 600; }
  label span { color: rgba(255,255,255,0.5); font-size: 11px; }
</style>
