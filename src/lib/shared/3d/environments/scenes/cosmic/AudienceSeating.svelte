<script lang="ts">
  import { T } from "@threlte/core";
  import { BoxGeometry, MeshStandardMaterial, Color } from "three";

  interface Props {
    rows: number;
    accentColor: string;
    groundY: number;
  }

  let { rows, accentColor, groundY }: Props = $props();

  const SEAT_WIDTH = 0.5;
  const SEAT_HEIGHT = 0.4;
  const SEAT_DEPTH = 0.3;
  const SEATS_PER_ROW = [6, 8, 10, 12, 14];
  const ROW_RADII = [5, 6.5, 8, 9.5, 11];
  const ARC_SPAN = Math.PI * 0.7;

  const seatGeometry = new BoxGeometry(SEAT_WIDTH, SEAT_HEIGHT, SEAT_DEPTH);

  const seatMaterial = $derived.by(() => {
    return new MeshStandardMaterial({
      color: new Color("#0c0c1e"),
      metalness: 0.7,
      roughness: 0.3,
      emissive: new Color(accentColor),
      emissiveIntensity: 0.08,
    });
  });

  const accentGeometry = new BoxGeometry(SEAT_WIDTH * 0.9, 0.02, 0.01);

  const accentMaterial = $derived.by(() => {
    return new MeshStandardMaterial({
      color: new Color(accentColor),
      emissive: new Color(accentColor),
      emissiveIntensity: 0.6,
    });
  });

  interface SeatPosition {
    x: number;
    y: number;
    z: number;
    rotY: number;
  }

  const seats = $derived.by(() => {
    const result: SeatPosition[][] = [];
    const clampedRows = Math.min(rows, 5);
    for (let r = 0; r < clampedRows; r++) {
      const rowSeats: SeatPosition[] = [];
      const count = SEATS_PER_ROW[r] ?? 6 + r * 2;
      const radius = ROW_RADII[r] ?? 5 + r * 1.5;
      const startAngle = Math.PI / 2 - ARC_SPAN / 2;
      for (let i = 0; i < count; i++) {
        const angle = startAngle + (ARC_SPAN / (count - 1)) * i;
        rowSeats.push({
          x: Math.cos(angle) * radius,
          y: groundY + SEAT_HEIGHT / 2,
          z: Math.sin(angle) * radius,
          rotY: -angle + Math.PI / 2,
        });
      }
      result.push(rowSeats);
    }
    return result;
  });
</script>

{#each seats as row}
  {#each row as seat}
    <T.Mesh
      geometry={seatGeometry}
      material={seatMaterial}
      position.x={seat.x}
      position.y={seat.y}
      position.z={seat.z}
      rotation.y={seat.rotY}
    />
    <T.Mesh
      geometry={accentGeometry}
      material={accentMaterial}
      position.x={seat.x + Math.sin(seat.rotY) * (SEAT_DEPTH / 2 + 0.005)}
      position.y={seat.y - SEAT_HEIGHT * 0.3}
      position.z={seat.z + Math.cos(seat.rotY) * (SEAT_DEPTH / 2 + 0.005)}
      rotation.y={seat.rotY}
    />
  {/each}
{/each}
