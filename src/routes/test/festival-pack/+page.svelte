<script lang="ts">
  import { onMount } from "svelte";
  import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
  } from "firebase/auth";
  import { getPrintCardRenderer } from "$lib/features/choreo-card/getPrintCardRenderer";
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
  import { getCatalogLayoutPolicy } from "$lib/features/choreo-card/domain/catalog-layout-policy";
  import {
    hydrateSequence,
    loadSequencesByIds,
  } from "$lib/features/choreo-card/services/catalog-loader";
  import { renderSignupCardPair } from "$lib/features/choreo-card/services/PrintCardRenderer";
  import type {
    CardPair,
    PrintRenderOptions,
  } from "$lib/features/choreo-card/services/types";
  import { getImageComposer } from "$lib/shared/render/get-image-composer";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import { getAuthInstance } from "$lib/shared/auth/firebase";
  import { getQRCodeGenerator } from "$lib/shared/qr/get-qr-code-generator";
  import { configureShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import selectedPack from "../../../../docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-selected.json";
  import publicSnapshot from "../../../../static/data/snapshots/public-sequences.json";
  import tndRecords from "../../../../docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-tnd-records.json";
  import localSequences from "../../../../docs/superpowers/specs/festival-sample-pack/evidence/festival-pack-local-sequences.json";

  interface SelectedCard {
    slot: string;
    source: "publicSequences" | "catalog" | "packLocal";
    id?: string;
    sourceRef?: string;
    catalogId?: string;
    docId?: string;
    name: string;
    vtgFamily?: string;
    element?: string;
    ratio?: string;
    turnIntensity?: number;
  }

  interface RenderedCard {
    slot: string;
    name: string;
    front: string;
    back: string;
    frontWidth: number;
    frontHeight: number;
    backWidth: number;
    backHeight: number;
  }

  const cards = (selectedPack.cards ?? []) as SelectedCard[];
  const publicDocuments = (publicSnapshot.documents ?? []) as unknown as Array<
    Record<string, unknown>
  >;
  const localTndRecords = (tndRecords.records ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const localSequenceRecords = (localSequences.records ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const theme = "rainbow";
  const classicPositions = new Set(["alpha1", "beta5", "gamma11"]);

  let status = $state("Preparing the selected festival pack...");
  let error = $state("");
  let rendered = $state<RenderedCard[]>([]);
  let signedIn = $state(false);
  let signingIn = $state(false);
  let exporting = $state(false);
  let email = $state("");
  let password = $state("");
  let cardPairs = $state<CardPair[]>([]);

  function canvasUrl(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL("image/png");
  }

  async function findPublicSequence(card: SelectedCard): Promise<SequenceData> {
    const indexed = publicDocuments.find(
      (sequence) =>
        sequence.id === card.id && sequence.sourceRef === card.sourceRef
    );
    if (!indexed) throw new Error(`Published sequence not found: ${card.name}`);
    const sequence = await getBrowseLoader().loadFullSequenceDataStrict(
      card.name,
      card.id
    );
    if (!sequence || sequence.steps.length === 0) {
      throw new Error(
        `Published sequence has no renderable steps: ${card.name}`
      );
    }
    return sequence;
  }

  async function loadCardSequence(card: SelectedCard): Promise<SequenceData> {
    if (card.source === "publicSequences") return findPublicSequence(card);
    if (card.source === "packLocal") {
      const sequence = localSequenceRecords[card.name];
      if (!sequence) {
        throw new Error(`Pack-local sequence not found: ${card.name}`);
      }
      return hydrateSequence(sequence);
    }
    if (!card.catalogId || !card.docId) {
      throw new Error(`Catalog source is incomplete: ${card.name}`);
    }
    const sequences = await loadSequencesByIds(card.catalogId, [card.docId]);
    const sequence =
      sequences[0] ??
      (localTndRecords[card.name]
        ? hydrateSequence(localTndRecords[card.name]!)
        : undefined);
    if (!sequence) throw new Error(`Catalog sequence not found: ${card.name}`);
    return sequence;
  }

  function assertClassicEndpoints(
    card: SelectedCard,
    sequence: SequenceData
  ): void {
    const startPosition =
      sequence.startPosition?.gridPosition ?? sequence.steps[0]?.startPosition;
    const endPosition =
      sequence.steps.at(-1)?.endPosition ??
      (sequence.isCircular ? startPosition : undefined);
    if (
      !classicPositions.has(startPosition ?? "") ||
      !classicPositions.has(endPosition ?? "")
    ) {
      throw new Error(
        `${card.name} must start and end in Alpha, Beta, or Gamma; got ${startPosition ?? "unknown"} → ${endPosition ?? "unknown"}`
      );
    }
  }

  function buildOptions(
    card: SelectedCard,
    sequence: SequenceData
  ): PrintRenderOptions {
    const familyId =
      card.vtgFamily === "Split-Same"
        ? "split-same"
        : card.vtgFamily === "Together-Same"
          ? "tog-same"
          : undefined;
    const element = familyId ? TND_BY_FAMILY[familyId] : undefined;
    const center = element
      ? `${card.vtgFamily} · ${card.element} · ${card.ratio}`
      : "Festival Sampler 2026";
    return {
      canvasWidth: 822,
      canvasHeight: 1122,
      bleedPx: 36,
      includeStartPosition: true,
      startPositionLayout: getCatalogLayoutPolicy(sequence.steps.length),
      showMandala: true,
      showQRCode: true,
      theme,
      tndElement: element,
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      leftLabel: element ? card.element : undefined,
      rightLabel: element ? `${card.turnIntensity} turn` : undefined,
      notes: center,
      iconPath: element?.iconPath,
      deckId: "festival-sampler-2026",
      deckName: "Festival Sampler 2026",
    };
  }

  async function renderPair(
    renderer: ReturnType<typeof getPrintCardRenderer>,
    card: SelectedCard
  ): Promise<{ pair: CardPair; rendered: RenderedCard }> {
    const sequence = await loadCardSequence(card);
    assertClassicEndpoints(card, sequence);
    const options = buildOptions(card, sequence);
    const [front, back] = await Promise.all([
      renderer.renderFront(sequence, options),
      renderer.renderBack(sequence, options),
    ]);
    return {
      pair: {
        front,
        back,
        label: card.name,
        renderMeta: { sequence, options },
      },
      rendered: {
        slot: card.slot,
        name: card.name,
        front: canvasUrl(front),
        back: canvasUrl(back),
        frontWidth: front.width,
        frontHeight: front.height,
        backWidth: back.width,
        backHeight: back.height,
      },
    };
  }

  async function renderPack() {
    try {
      error = "";
      rendered = [];
      configureShortCodeManager(getBrowseLoader());
      getImageComposer().setQRCodeGenerator(getQRCodeGenerator());
      const renderer = getPrintCardRenderer();
      const output: RenderedCard[] = [];
      const outputPairs: CardPair[] = [];

      for (let index = 0; index < cards.length; index++) {
        const card = cards[index]!;
        status = `Rendering ${index + 1} of ${cards.length}: ${card.name}`;
        const result = await renderPair(renderer, card);
        output.push(result.rendered);
        outputPairs.push(result.pair);
      }

      status = "Rendering signup card";
      const signup = await renderSignupCardPair({ theme, cardSize: "poker" });
      const signupCard: RenderedCard = {
        slot: "signup",
        name: "Start Here",
        front: canvasUrl(signup.front),
        back: canvasUrl(signup.back),
        frontWidth: signup.front.width,
        frontHeight: signup.front.height,
        backWidth: signup.back.width,
        backHeight: signup.back.height,
      };

      // The signup card occupies the center cell. The manifest that the capture
      // script reads is left-to-right, top-to-bottom in this exact order.
      rendered = [...output.slice(0, 4), signupCard, ...output.slice(4)];
      cardPairs = [
        ...outputPairs.slice(0, 4),
        {
          front: signup.front,
          back: signup.back,
          label: "Start Here",
        },
        ...outputPairs.slice(4),
      ];
      status = `Ready: ${rendered.length} cards`;
    } catch (cause) {
      console.error("[FestivalPackHarness] Render failed:", cause);
      error = cause instanceof Error ? cause.message : String(cause);
      status = "Render failed";
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPngs() {
    if (cardPairs.length !== 9 || exporting) return;
    exporting = true;
    error = "";
    try {
      const { exportDeckZIP } =
        await import("$lib/features/choreo-card/services/print-zip-exporter");
      const archive = await exportDeckZIP(cardPairs, "Festival_Sampler_2026");
      triggerDownload(archive, "Festival_Sampler_2026_cards.zip");
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      exporting = false;
    }
  }

  async function signIn() {
    if (!email || !password || signingIn) return;
    signingIn = true;
    error = "";
    try {
      await signInWithEmailAndPassword(
        await getAuthInstance(),
        email,
        password
      );
      password = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      signingIn = false;
    }
  }

  onMount(() => {
    let unsubscribe = () => {};
    void getAuthInstance().then((auth) => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        signedIn = !!user;
        if (user && rendered.length === 0) void renderPack();
      });
    });
    return () => unsubscribe();
  });
</script>

<svelte:head>
  <title>Festival Pack Capture</title>
</svelte:head>

<main>
  <header>
    <h1>Festival sampler capture</h1>
    <p data-testid="festival-pack-status">{status}</p>
    {#if cardPairs.length === 9}
      <button type="button" disabled={exporting} onclick={exportPngs}>
        {exporting ? "Building archive..." : "Download card PNGs"}
      </button>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </header>

  {#if !signedIn}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void signIn();
      }}
    >
      <label>
        Agent email
        <input
          name="email"
          type="email"
          autocomplete="username"
          bind:value={email}
        />
      </label>
      <label>
        Agent password
        <input
          name="password"
          type="password"
          autocomplete="current-password"
          bind:value={password}
        />
      </label>
      <button type="submit" disabled={signingIn}>
        {signingIn ? "Signing in..." : "Sign in to render"}
      </button>
    </form>
  {/if}

  <section aria-label="Rendered card pairs" data-card-count={rendered.length}>
    {#each rendered as card, index (card.slot)}
      <article
        data-card-index={index}
        data-card-slot={card.slot}
        data-card-name={card.name}
        data-front={card.front}
        data-back={card.back}
        data-front-width={card.frontWidth}
        data-front-height={card.frontHeight}
        data-back-width={card.backWidth}
        data-back-height={card.backHeight}
      >
        <img src={card.front} alt={`${card.name} front`} />
        <img src={card.back} alt={`${card.name} back`} />
        <strong>{index + 1}. {card.name}</strong>
        <span>{card.slot}</span>
      </article>
    {/each}
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #11131a;
    color: #f7f7fb;
    font-family: Inter, system-ui, sans-serif;
  }

  main {
    padding: 1.5rem;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  h1,
  p {
    margin: 0;
  }

  .error {
    color: #ff8f8f;
  }

  section {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1.25rem;
  }

  form {
    display: flex;
    align-items: end;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  label {
    display: grid;
    gap: 0.3rem;
    font-size: 0.8rem;
  }

  input,
  button {
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.6rem 0.8rem;
    color: inherit;
    background: #1a1d27;
    border: 1px solid #4b5168;
    border-radius: 0.5rem;
  }

  button {
    cursor: pointer;
  }

  article {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0.75rem;
    background: #1a1d27;
    border: 1px solid #35394a;
    border-radius: 0.75rem;
  }

  img {
    width: 100%;
    min-width: 0;
  }

  strong,
  span {
    grid-column: 1 / -1;
  }

  span {
    color: #aeb3c8;
    font-size: 0.8rem;
  }
</style>
