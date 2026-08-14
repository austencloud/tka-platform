<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { getContactLabContext } from "../context/contact-lab-context";
  import ContactBall from "./ContactBall.svelte";
  import ContactCamera from "./ContactCamera.svelte";
  import ContactHandRig from "./ContactHandRig.svelte";
  import ContactPalmGrid from "./ContactPalmGrid.svelte";

  interface Props {
    aspect: number;
  }

  let { aspect }: Props = $props();
  const labState = getContactLabContext();

  useTask((delta) => {
    labState.advance(delta);
  });
</script>

<ContactCamera {aspect} />

<T.HemisphereLight color="#dbe8ff" groundColor="#161b29" intensity={1.55} />
<T.DirectionalLight
  position={[-2.8, 5.2, 3.7]}
  intensity={3.1}
  color="#fff2e6"
/>
<T.DirectionalLight
  position={[3.5, 2.5, -2]}
  intensity={1.25}
  color="#85aaff"
/>

{#each labState.frame.hands as hand (hand.id)}
  <ContactPalmGrid {hand} />
  <ContactHandRig pose={hand} />
{/each}

{#each labState.frame.balls as ball (ball.id)}
  <ContactBall pose={ball} />
  <T.Mesh
    position={ball.contact.position}
    rotation.x={Math.PI / 2}
    renderOrder={4}
  >
    <T.CircleGeometry args={[0.038, 24]} />
    <T.MeshBasicMaterial
      color={ball.color === "blue" ? "#91bbff" : "#ff94a0"}
      transparent
      opacity={0.78}
      depthWrite={false}
      depthTest={false}
    />
  </T.Mesh>
{/each}
