<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth, getStorageInstance } from "$lib/shared/auth/firebase";
  import type {
    TeachingPortfolio,
    WorkshopTemplate,
    WorkshopLevel,
    ActTemplate,
    BioVersion,
  } from "../../domain/models/teaching-portfolio";
  import { AUSTEN_PORTFOLIO_SEED } from "../../data/portfolio-seed";
  import WorkshopTemplateCard from "./WorkshopTemplateCard.svelte";
  import ActTemplateCard from "./ActTemplateCard.svelte";
  import BioEditor from "./BioEditor.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import ModalFooter from "$lib/shared/foundation/ui/modal/ModalFooter.svelte";

  const { state: festivalState } = getFestivalContext();

  // ─── Workshop inline form ───────────────────────────────────────────────────
  let showWorkshopForm = $state(false);
  let editingWorkshopId = $state<string | null>(null);

  // Form fields
  let wTitle = $state("");
  let wLevel = $state<WorkshopLevel>("beginner");
  let wPropsRaw = $state("");
  let wDescription = $state("");
  let wSolo = $state(true);
  let wImageUrl = $state<string | undefined>(undefined);
  let wImageUploading = $state(false);
  let wImageProgress = $state(0);
  let imageFileInput: HTMLInputElement | undefined = $state(undefined);

  const LEVELS: WorkshopLevel[] = ["introductory", "beginner", "intermediate", "advanced", "mixed"];

  function openNewWorkshopForm() {
    editingWorkshopId = null;
    wTitle = "";
    wLevel = "beginner";
    wPropsRaw = "";
    wDescription = "";
    wSolo = true;
    wImageUrl = undefined;
    wImageUploading = false;
    wImageProgress = 0;
    showWorkshopForm = true;
  }

  function openEditWorkshopForm(workshop: WorkshopTemplate) {
    editingWorkshopId = workshop.id;
    wTitle = workshop.title;
    wLevel = workshop.level;
    wPropsRaw = workshop.props.join(", ");
    wDescription = workshop.description;
    wSolo = workshop.solo;
    wImageUrl = workshop.imageUrl;
    wImageUploading = false;
    wImageProgress = 0;
    showWorkshopForm = true;
  }

  async function handleImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Use existing workshop ID or generate one for new workshops
    const workshopId = editingWorkshopId ?? crypto.randomUUID();
    if (!editingWorkshopId) {
      editingWorkshopId = workshopId;
    }

    wImageUploading = true;
    wImageProgress = 0;

    try {
      const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
      const storage = await getStorageInstance();
      const storageRef = ref(storage, `workshops/${uid}/${workshopId}/cover`);

      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      uploadTask.on("state_changed", (snapshot) => {
        wImageProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      });

      await uploadTask;
      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      wImageUrl = downloadUrl;
    } catch (error) {
      console.error("Failed to upload workshop cover image:", error);
    } finally {
      wImageUploading = false;
      // Reset input so re-selecting the same file triggers change
      if (imageFileInput) imageFileInput.value = "";
    }
  }

  function cancelWorkshopForm() {
    showWorkshopForm = false;
    editingWorkshopId = null;
  }

  function saveWorkshopForm() {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;

    const props = wPropsRaw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (editingWorkshopId) {
      const updated: TeachingPortfolio = {
        ...portfolio,
        classes: portfolio.classes.map((c) =>
          c.id === editingWorkshopId
            ? { ...c, title: wTitle, level: wLevel, props, description: wDescription, solo: wSolo, imageUrl: wImageUrl }
            : c
        ),
      };
      festivalState.savePortfolio(uid, updated);
    } else {
      const newWorkshop: WorkshopTemplate = {
        id: crypto.randomUUID(),
        title: wTitle,
        level: wLevel,
        props,
        description: wDescription,
        themes: [],
        solo: wSolo,
        imageUrl: wImageUrl,
      };
      const updated: TeachingPortfolio = {
        ...portfolio,
        classes: [...portfolio.classes, newWorkshop],
      };
      festivalState.savePortfolio(uid, updated);
    }

    cancelWorkshopForm();
  }

  function deleteWorkshop(workshopId: string) {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;
    const updated: TeachingPortfolio = {
      ...portfolio,
      classes: portfolio.classes.filter((c) => c.id !== workshopId),
    };
    festivalState.savePortfolio(uid, updated);
  }

  // ─── Act inline form ─────────────────────────────────────────────────────────
  let showActForm = $state(false);
  let editingActId = $state<string | null>(null);

  let aTitle = $state("");
  let aDescription = $state("");
  let aDuration = $state("");
  let aPerformerCount = $state(1);
  let aSolo = $state(true);
  let aPropsRaw = $state("");
  let aFire = $state(false);
  let aRequirements = $state("");
  let aVideoUrl = $state("");
  let aActImageUrl = $state<string | undefined>(undefined);
  let aActImageUploading = $state(false);
  let aActImageProgress = $state(0);
  let actImageFileInput: HTMLInputElement | undefined = $state(undefined);

  function openNewActForm() {
    editingActId = null;
    aTitle = "";
    aDescription = "";
    aDuration = "";
    aPerformerCount = 1;
    aSolo = true;
    aPropsRaw = "";
    aFire = false;
    aRequirements = "";
    aVideoUrl = "";
    aActImageUrl = undefined;
    aActImageUploading = false;
    aActImageProgress = 0;
    showActForm = true;
  }

  function openEditActForm(act: ActTemplate) {
    editingActId = act.id;
    aTitle = act.title;
    aDescription = act.description;
    aDuration = act.duration;
    aPerformerCount = act.performerCount;
    aSolo = act.solo;
    aPropsRaw = act.props.join(", ");
    aFire = act.fire;
    aRequirements = act.requirements;
    aVideoUrl = act.videoUrl ?? "";
    aActImageUrl = act.imageUrl;
    aActImageUploading = false;
    aActImageProgress = 0;
    showActForm = true;
  }

  async function handleActImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const actId = editingActId ?? crypto.randomUUID();
    if (!editingActId) {
      editingActId = actId;
    }

    aActImageUploading = true;
    aActImageProgress = 0;

    try {
      const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
      const storage = await getStorageInstance();
      const storageRef = ref(storage, `acts/${uid}/${actId}/cover`);

      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      uploadTask.on("state_changed", (snapshot) => {
        aActImageProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      });

      await uploadTask;
      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      aActImageUrl = downloadUrl;
    } catch (error) {
      console.error("Failed to upload act cover image:", error);
    } finally {
      aActImageUploading = false;
      if (actImageFileInput) actImageFileInput.value = "";
    }
  }

  function cancelActForm() {
    showActForm = false;
    editingActId = null;
  }

  function saveActForm() {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;

    const props = aPropsRaw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (editingActId) {
      const updated: TeachingPortfolio = {
        ...portfolio,
        acts: portfolio.acts.map((a) =>
          a.id === editingActId
            ? {
                ...a,
                title: aTitle,
                description: aDescription,
                duration: aDuration,
                performerCount: aPerformerCount,
                solo: aSolo,
                props,
                fire: aFire,
                requirements: aRequirements,
                videoUrl: aVideoUrl || undefined,
                imageUrl: aActImageUrl,
              }
            : a
        ),
      };
      festivalState.savePortfolio(uid, updated);
    } else {
      const newAct: ActTemplate = {
        id: crypto.randomUUID(),
        title: aTitle,
        description: aDescription,
        duration: aDuration,
        performerCount: aPerformerCount,
        solo: aSolo,
        props,
        fire: aFire,
        requirements: aRequirements,
        videoUrl: aVideoUrl || undefined,
        imageUrl: aActImageUrl,
      };
      const updated: TeachingPortfolio = {
        ...portfolio,
        acts: [...portfolio.acts, newAct],
      };
      festivalState.savePortfolio(uid, updated);
    }

    cancelActForm();
  }

  function deleteAct(actId: string) {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;
    const updated: TeachingPortfolio = {
      ...portfolio,
      acts: portfolio.acts.filter((a) => a.id !== actId),
    };
    festivalState.savePortfolio(uid, updated);
  }

  // ─── Bio management (add triggers modal in BioEditor) ──────────────────────
  let editBioId = $state<string | null>(null);

  function addBio() {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio) return;
    const newBio: BioVersion = {
      id: crypto.randomUUID(),
      label: "New Bio",
      text: "",
    };
    const updated: TeachingPortfolio = {
      ...festivalState.portfolio,
      bios: [...festivalState.portfolio.bios, newBio],
    };
    festivalState.savePortfolio(uid, updated);
    editBioId = newBio.id;
  }

  // ─── Performance credits ────────────────────────────────────────────────────
  let newCredit = $state("");

  function addCredit() {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio || !newCredit.trim()) return;
    const updated: TeachingPortfolio = {
      ...portfolio,
      performanceCredits: [...portfolio.performanceCredits, newCredit.trim()],
    };
    festivalState.savePortfolio(uid, updated);
    newCredit = "";
  }

  function removeCredit(index: number) {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;
    const credits = portfolio.performanceCredits.filter((_, i) => i !== index);
    festivalState.savePortfolio(uid, { ...portfolio, performanceCredits: credits });
  }

  // ─── Performance videos ─────────────────────────────────────────────────────
  let newVideo = $state("");

  function addVideo() {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio || !newVideo.trim()) return;
    const updated: TeachingPortfolio = {
      ...portfolio,
      performanceVideos: [...portfolio.performanceVideos, newVideo.trim()],
    };
    festivalState.savePortfolio(uid, updated);
    newVideo = "";
  }

  function removeVideo(index: number) {
    const uid = auth.currentUser?.uid;
    const portfolio = festivalState.portfolio;
    if (!uid || !portfolio) return;
    const videos = portfolio.performanceVideos.filter((_, i) => i !== index);
    festivalState.savePortfolio(uid, { ...portfolio, performanceVideos: videos });
  }

  // ─── YouTube thumbnail helper ──────────────────────────────────────────────
  function extractYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|(?:v|embed|shorts)[=\/])([a-zA-Z0-9_-]{11})/);
    return match?.[1] ?? null;
  }

  let failedThumbnails = $state<Set<string>>(new Set());

  // ─── Social links & About — debounced auto-save ─────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function debounceSave(updater: () => TeachingPortfolio) {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const portfolio = festivalState.portfolio;
      if (!uid || !portfolio) return;
      festivalState.savePortfolio(uid, updater());
    }, 600);
  }

  // Social link fields — mirrors current portfolio when it loads
  let slWebsite = $state("");
  let slInstagram = $state("");
  let slFacebook = $state("");
  let slYoutube = $state("");
  let slTiktok = $state("");

  // About fields
  let aHomeCity = $state("");
  let aHomeCountry = $state("");
  let aYearsTeaching = $state(0);
  let aYearsPerforming = $state(0);
  let aInsuranceProvider = $state("");

  // Sync local fields whenever portfolio loads or changes
  $effect(() => {
    const p = festivalState.portfolio;
    if (!p) return;
    slWebsite = p.socialLinks.website ?? "";
    slInstagram = p.socialLinks.instagram ?? "";
    slFacebook = p.socialLinks.facebook ?? "";
    slYoutube = p.socialLinks.youtube ?? "";
    slTiktok = p.socialLinks.tiktok ?? "";
    aHomeCity = p.homeCity ?? "";
    aHomeCountry = p.homeCountry ?? "";
    aYearsTeaching = p.yearsTeaching ?? 0;
    aYearsPerforming = p.yearsPerforming ?? 0;
    aInsuranceProvider = p.insuranceInfo?.provider ?? "";
  });

  function handleSocialChange() {
    debounceSave(() => ({
      ...festivalState.portfolio!,
      socialLinks: {
        website: slWebsite || undefined,
        instagram: slInstagram || undefined,
        facebook: slFacebook || undefined,
        youtube: slYoutube || undefined,
        tiktok: slTiktok || undefined,
      },
    }));
  }

  function handleAboutChange() {
    debounceSave(() => ({
      ...festivalState.portfolio!,
      homeCity: aHomeCity,
      homeCountry: aHomeCountry,
      yearsTeaching: Number(aYearsTeaching) || 0,
      yearsPerforming: Number(aYearsPerforming) || 0,
      insuranceInfo: aInsuranceProvider
        ? { provider: aInsuranceProvider }
        : undefined,
    }));
  }

  // ─── Inline edit state for Profile card ────────────────────────────────────
  let editingField = $state<string | null>(null);
  let editingFieldOriginal = $state<string | number>("");

  function startFieldEdit(field: string) {
    editingField = field;
    switch (field) {
      case "website": editingFieldOriginal = slWebsite; break;
      case "instagram": editingFieldOriginal = slInstagram; break;
      case "facebook": editingFieldOriginal = slFacebook; break;
      case "youtube": editingFieldOriginal = slYoutube; break;
      case "tiktok": editingFieldOriginal = slTiktok; break;
      case "homeCity": editingFieldOriginal = aHomeCity; break;
      case "homeCountry": editingFieldOriginal = aHomeCountry; break;
      case "yearsTeaching": editingFieldOriginal = aYearsTeaching; break;
      case "yearsPerforming": editingFieldOriginal = aYearsPerforming; break;
      case "insuranceProvider": editingFieldOriginal = aInsuranceProvider; break;
    }
  }

  function finishFieldEdit(field: string) {
    editingField = null;
    if (["website", "instagram", "facebook", "youtube", "tiktok"].includes(field)) {
      handleSocialChange();
    } else {
      handleAboutChange();
    }
  }

  function cancelFieldEdit(field: string) {
    switch (field) {
      case "website": slWebsite = editingFieldOriginal as string; break;
      case "instagram": slInstagram = editingFieldOriginal as string; break;
      case "facebook": slFacebook = editingFieldOriginal as string; break;
      case "youtube": slYoutube = editingFieldOriginal as string; break;
      case "tiktok": slTiktok = editingFieldOriginal as string; break;
      case "homeCity": aHomeCity = editingFieldOriginal as string; break;
      case "homeCountry": aHomeCountry = editingFieldOriginal as string; break;
      case "yearsTeaching": aYearsTeaching = editingFieldOriginal as number; break;
      case "yearsPerforming": aYearsPerforming = editingFieldOriginal as number; break;
      case "insuranceProvider": aInsuranceProvider = editingFieldOriginal as string; break;
    }
    editingField = null;
  }

  function handleFieldKeydown(e: KeyboardEvent, field: string) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      finishFieldEdit(field);
    } else if (e.key === "Escape") {
      cancelFieldEdit(field);
    }
  }

  function getSocialValue(key: string): string {
    switch (key) {
      case "website": return slWebsite;
      case "instagram": return slInstagram;
      case "facebook": return slFacebook;
      case "youtube": return slYoutube;
      case "tiktok": return slTiktok;
      default: return "";
    }
  }

  function setSocialValue(key: string, value: string) {
    switch (key) {
      case "website": slWebsite = value; break;
      case "instagram": slInstagram = value; break;
      case "facebook": slFacebook = value; break;
      case "youtube": slYoutube = value; break;
      case "tiktok": slTiktok = value; break;
    }
  }

  function getAboutValue(key: string): string | number {
    switch (key) {
      case "homeCity": return aHomeCity;
      case "homeCountry": return aHomeCountry;
      case "yearsTeaching": return aYearsTeaching;
      case "yearsPerforming": return aYearsPerforming;
      case "insuranceProvider": return aInsuranceProvider;
      default: return "";
    }
  }

  function setAboutValue(key: string, value: string) {
    switch (key) {
      case "homeCity": aHomeCity = value; break;
      case "homeCountry": aHomeCountry = value; break;
      case "yearsTeaching": aYearsTeaching = Number(value) || 0; break;
      case "yearsPerforming": aYearsPerforming = Number(value) || 0; break;
      case "insuranceProvider": aInsuranceProvider = value; break;
    }
  }

  // ─── Empty state / seed import ───────────────────────────────────────────────
  function importSeed() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const now = { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp;
    const portfolio: TeachingPortfolio = {
      ...AUSTEN_PORTFOLIO_SEED,
      userId: uid,
      createdAt: now,
      updatedAt: now,
    };
    festivalState.savePortfolio(uid, portfolio);
  }
</script>

<div class="portfolio-editor">
  {#if !festivalState.portfolio}
    <!-- Empty state -->
    <div class="empty-state">
      <i class="fas fa-chalkboard-teacher empty-icon" aria-hidden="true"></i>
      <h3 class="empty-title">Set up your teaching portfolio</h3>
      <p class="empty-body">
        Add your workshops, bios, and performance history so festival organizers can find you.
      </p>
      <div class="empty-actions">
        <button
          class="primary-btn"
          onclick={() => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            const now = { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp;
            festivalState.savePortfolio(uid, {
              userId: uid,
              classes: [],
              acts: [],
              bios: [],
              performanceCredits: [],
              performanceVideos: [],
              socialLinks: {},
              homeCity: "",
              homeCountry: "",
              yearsTeaching: 0,
              yearsPerforming: 0,
              createdAt: now,
              updatedAt: now,
            });
          }}
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
          Start from scratch
        </button>
        <button class="secondary-btn" onclick={importSeed}>
          <i class="fas fa-file-import" aria-hidden="true"></i>
          Import sample portfolio
        </button>
      </div>
    </div>
  {:else}
    <div class="portfolio-grid">
    <!-- ── Workshops section ─────────────────────────────────────────────────── -->
    <section class="section-card workshops-card">
      <div class="section-header">
        <h3 class="section-title">Workshops</h3>
        <button
          class="add-btn"
          onclick={openNewWorkshopForm}
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Workshop
        </button>
      </div>

      {#if festivalState.portfolio.classes.length > 0}
        <div class="workshop-list">
          {#each festivalState.portfolio.classes as workshop (workshop.id)}
            <WorkshopTemplateCard
              {workshop}
              onclick={() => openEditWorkshopForm(workshop)}
            />
          {/each}
        </div>
      {:else if !showWorkshopForm}
        <p class="empty-section">No workshops yet.</p>
      {/if}
    </section>

    <!-- ── Acts section ──────────────────────────────────────────────────────── -->
    <section class="section-card acts-card">
      <div class="section-header">
        <h3 class="section-title">Acts</h3>
        <button
          class="add-btn act-add-btn"
          onclick={openNewActForm}
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Act
        </button>
      </div>

      {#if festivalState.portfolio.acts.length > 0}
        <div class="act-list">
          {#each festivalState.portfolio.acts as act (act.id)}
            <ActTemplateCard
              {act}
              onclick={() => openEditActForm(act)}
            />
          {/each}
        </div>
      {:else if !showActForm}
        <p class="empty-section">No acts yet.</p>
      {/if}
    </section>

    <!-- ── Bios section ──────────────────────────────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">Bios</h3>
        <button class="ghost-add-btn" onclick={addBio}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          Add Bio
        </button>
      </div>
      <BioEditor bind:editBioId />
    </section>

    <!-- ── Profile (social links + about merged) ─────────────────────────────── -->
    <section class="section-card">
      <div class="section-header">
        <h3 class="section-title">
          <i class="fas fa-user" aria-hidden="true" style="margin-right: 6px; opacity: 0.5;"></i>
          Profile
        </h3>
      </div>

      <div class="profile-layout">
        <!-- Social Links column -->
        <div class="profile-column">
          <div class="profile-column-title">Social Links</div>
          {#each [
            { key: "website", icon: "fa-globe", iconClass: "fas", placeholder: "yourwebsite.com" },
            { key: "instagram", icon: "fa-instagram", iconClass: "fab", placeholder: "@handle" },
            { key: "facebook", icon: "fa-facebook", iconClass: "fab", placeholder: "facebook.com/page" },
            { key: "youtube", icon: "fa-youtube", iconClass: "fab", placeholder: "youtube.com/@channel" },
            { key: "tiktok", icon: "fa-tiktok", iconClass: "fab", placeholder: "@handle" },
          ] as link (link.key)}
            <div
              class="social-row"
              onclick={() => editingField !== link.key && startFieldEdit(link.key)}
            >
              <i
                class="{link.iconClass} {link.icon} social-icon"
                aria-hidden="true"
              ></i>
              {#if editingField === link.key}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="social-edit-input"
                  type="text"
                  value={getSocialValue(link.key)}
                  oninput={(e) => setSocialValue(link.key, (e.target as HTMLInputElement).value)}
                  placeholder={link.placeholder}
                  onblur={() => finishFieldEdit(link.key)}
                  onkeydown={(e) => handleFieldKeydown(e, link.key)}
                  aria-label={link.key}
                  autofocus
                />
              {:else}
                {@const val = getSocialValue(link.key)}
                <span class="social-value" class:empty={!val}>
                  {val || "Not set"}
                </span>
              {/if}
            </div>
          {/each}
        </div>

        <!-- About column -->
        <div class="profile-column">
          <div class="profile-column-title">About</div>
          {#each [
            { key: "homeCity", label: "City", type: "text", placeholder: "Chicago" },
            { key: "homeCountry", label: "Country", type: "text", placeholder: "USA" },
            { key: "yearsTeaching", label: "Years Teaching", type: "number", placeholder: "" },
            { key: "yearsPerforming", label: "Years Performing", type: "number", placeholder: "" },
            { key: "insuranceProvider", label: "Insurance", type: "text", placeholder: "e.g. Specialty Insurance" },
          ] as field (field.key)}
            <div
              class="about-row"
              onclick={() => editingField !== field.key && startFieldEdit(field.key)}
            >
              <span class="about-label">{field.label}</span>
              {#if editingField === field.key}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="social-edit-input"
                  type={field.type}
                  value={getAboutValue(field.key)}
                  oninput={(e) => setAboutValue(field.key, (e.target as HTMLInputElement).value)}
                  placeholder={field.placeholder}
                  min={field.type === "number" ? "0" : undefined}
                  onblur={() => finishFieldEdit(field.key)}
                  onkeydown={(e) => handleFieldKeydown(e, field.key)}
                  aria-label={field.label}
                  autofocus
                />
              {:else}
                {@const val = getAboutValue(field.key)}
                <span
                  class="about-value"
                  class:empty={!val && val !== 0}
                >
                  {#if val || val === 0}
                    {val}
                  {:else}
                    Not set
                  {/if}
                </span>
              {/if}
            </div>
          {/each}
        </div>
        <!-- Performance Credits (inside profile) -->
        <div class="profile-column profile-credits-column">
          <div class="profile-column-title">Credits</div>
          <div class="credits-flow">
            {#each festivalState.portfolio.performanceCredits as credit, i (i)}
              <div class="credit-pill">
                <span>{credit}</span>
                <button
                  class="credit-remove"
                  onclick={() => removeCredit(i)}
                  aria-label="Remove {credit}"
                  tabindex="0"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {/each}
            <input
              class="credit-add-input"
              type="text"
              bind:value={newCredit}
              placeholder="Add credit..."
              onkeydown={(e) => e.key === "Enter" && addCredit()}
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ── Performance videos (full width) ───────────────────────────────────── -->
    <section class="section-card videos-card">
      <div class="section-header">
        <h3 class="section-title">Performance Videos</h3>
      </div>

      {#if festivalState.portfolio.performanceVideos.length > 0}
        <div class="video-grid">
          {#each festivalState.portfolio.performanceVideos as video, i (i)}
            {@const videoId = extractYouTubeId(video)}
            <div class="video-card">
              {#if videoId && !failedThumbnails.has(videoId)}
                <img
                  class="video-thumbnail"
                  src="https://img.youtube.com/vi/{videoId}/mqdefault.jpg"
                  alt="Video thumbnail"
                  onerror={() => {
                    failedThumbnails = new Set([...failedThumbnails, videoId]);
                  }}
                />
              {:else}
                <div class="video-thumbnail-placeholder">
                  <i class="fas fa-video" aria-hidden="true"></i>
                </div>
              {/if}
              <div class="video-overlay">
                <button
                  class="video-remove-btn"
                  onclick={() => removeVideo(i)}
                  aria-label="Remove video"
                  tabindex="0"
                >
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
              <div class="video-url-label" title={video}>{video}</div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="video-add-row">
        <input
          class="add-input"
          type="url"
          bind:value={newVideo}
          placeholder="Paste YouTube URL..."
          onkeydown={(e) => e.key === "Enter" && addVideo()}
        />
        <button class="add-inline-btn" onclick={addVideo} disabled={!newVideo.trim()}>
          Add
        </button>
      </div>
    </section>
    </div>
  {/if}
</div>

<BaseModal
  bind:open={showWorkshopForm}
  onclose={() => cancelWorkshopForm()}
  size="fit"
  animation="pop"
>
  {#snippet header()}
    <ModalHeader
      title={editingWorkshopId ? "Edit Workshop" : "New Workshop"}
      icon={editingWorkshopId ? "fa-pencil-alt" : "fa-plus"}
      iconColor="var(--theme-accent, #6366f1)"
      onClose={() => cancelWorkshopForm()}
    />
  {/snippet}

  <div class="workshop-form-body" data-animate="3">
    <input
      type="file"
      accept="image/*"
      class="hidden-file-input"
      bind:this={imageFileInput}
      onchange={handleImageSelected}
    />
    <button
      type="button"
      class="image-upload-area"
      class:has-image={!!wImageUrl}
      onclick={() => imageFileInput?.click()}
      disabled={wImageUploading}
    >
      {#if wImageUrl}
        <img src={wImageUrl} alt="Workshop cover preview" />
        <div class="image-change-overlay">
          <i class="fas fa-camera" aria-hidden="true"></i>
          <span>Change image</span>
        </div>
      {:else}
        <div class="upload-placeholder">
          <i class="fas fa-camera" aria-hidden="true"></i>
          <span>Click to add a cover image</span>
        </div>
      {/if}
      {#if wImageUploading}
        <div class="upload-progress-overlay">
          <div class="upload-progress-bar" style="width: {wImageProgress}%"></div>
        </div>
      {/if}
    </button>

    <label class="field-label">
      Title
      <input
        class="field-input"
        type="text"
        bind:value={wTitle}
        placeholder="Workshop title"
      />
    </label>

    <label class="field-label">
      Level
      <div class="level-toggle-row">
        {#each LEVELS as level (level)}
          <button
            class="level-btn"
            class:active={wLevel === level}
            onclick={() => (wLevel = level)}
            type="button"
          >
            {level}
          </button>
        {/each}
      </div>
    </label>

    <label class="field-label">
      Props (comma-separated)
      <input
        class="field-input"
        type="text"
        bind:value={wPropsRaw}
        placeholder="double-staves, clubs"
      />
    </label>

    <label class="field-label">
      Description
      <textarea
        class="field-textarea"
        bind:value={wDescription}
        rows={6}
        placeholder="What you teach in this workshop..."
      ></textarea>
    </label>

    <label class="field-label">
      Format
      <div class="level-toggle-row">
        <button class="level-btn" class:active={wSolo} onclick={() => (wSolo = true)} type="button">Solo</button>
        <button class="level-btn" class:active={!wSolo} onclick={() => (wSolo = false)} type="button">Partner</button>
      </div>
    </label>
  </div>

  {#snippet footer()}
    <ModalFooter align="between">
      <div class="modal-left-actions">
        {#if editingWorkshopId}
          <button
            class="ghost"
            onclick={() => navigator.clipboard.writeText(wDescription)}
            title="Copy description to clipboard"
            type="button"
          >
            <i class="fas fa-copy" aria-hidden="true"></i>
            Copy
          </button>
          <button
            class="ghost danger-text"
            onclick={() => { deleteWorkshop(editingWorkshopId!); cancelWorkshopForm(); }}
            title="Delete this workshop"
            type="button"
          >
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete
          </button>
        {/if}
      </div>
      <div class="modal-right-actions">
        <button class="secondary" onclick={cancelWorkshopForm} type="button">Cancel</button>
        <button class="primary" onclick={saveWorkshopForm} disabled={!wTitle.trim()} type="button">
          {editingWorkshopId ? "Save Changes" : "Add Workshop"}
        </button>
      </div>
    </ModalFooter>
  {/snippet}
</BaseModal>

<BaseModal
  bind:open={showActForm}
  onclose={() => cancelActForm()}
  size="fit"
  animation="pop"
>
  {#snippet header()}
    <ModalHeader
      title={editingActId ? "Edit Act" : "New Act"}
      icon={editingActId ? "fa-pencil-alt" : "fa-plus"}
      iconColor="#f59e0b"
      onClose={() => cancelActForm()}
    />
  {/snippet}

  <div class="act-form-body" data-animate="3">
    <input
      type="file"
      accept="image/*"
      class="hidden-file-input"
      bind:this={actImageFileInput}
      onchange={handleActImageSelected}
    />
    <button
      type="button"
      class="image-upload-area"
      class:has-image={!!aActImageUrl}
      onclick={() => actImageFileInput?.click()}
      disabled={aActImageUploading}
    >
      {#if aActImageUrl}
        <img src={aActImageUrl} alt="Act cover preview" />
        <div class="image-change-overlay">
          <i class="fas fa-camera" aria-hidden="true"></i>
          <span>Change image</span>
        </div>
      {:else}
        <div class="upload-placeholder">
          <i class="fas fa-camera" aria-hidden="true"></i>
          <span>Click to add a promo image</span>
        </div>
      {/if}
      {#if aActImageUploading}
        <div class="upload-progress-overlay">
          <div class="upload-progress-bar" style="width: {aActImageProgress}%"></div>
        </div>
      {/if}
    </button>

    <label class="field-label">
      Title
      <input
        class="field-input"
        type="text"
        bind:value={aTitle}
        placeholder="e.g. Fire Ensemble, Solo LED Staff"
      />
    </label>

    <label class="field-label">
      Description
      <textarea
        class="field-textarea"
        bind:value={aDescription}
        rows={4}
        placeholder="What the audience sees..."
      ></textarea>
    </label>

    <label class="field-label">
      Duration
      <input
        class="field-input"
        type="text"
        bind:value={aDuration}
        placeholder="e.g. 8 minutes, 30-60 min roaming"
      />
    </label>

    <label class="field-label">
      Performer Count
      <input
        class="field-input"
        type="number"
        bind:value={aPerformerCount}
        min="1"
        max="20"
      />
    </label>

    <label class="field-label">
      Format
      <div class="level-toggle-row">
        <button class="level-btn" class:active={aSolo} onclick={() => (aSolo = true)} type="button">Solo</button>
        <button class="level-btn" class:active={!aSolo} onclick={() => (aSolo = false)} type="button">Group</button>
      </div>
    </label>

    <label class="field-label">
      Props (comma-separated)
      <input
        class="field-input"
        type="text"
        bind:value={aPropsRaw}
        placeholder="double-staves, fans"
      />
    </label>

    <label class="field-label">
      Fire
      <div class="level-toggle-row">
        <button class="level-btn" class:active={aFire} onclick={() => (aFire = true)} type="button">
          <i class="fas fa-fire" aria-hidden="true" style="margin-right: 4px;"></i>Fire
        </button>
        <button class="level-btn" class:active={!aFire} onclick={() => (aFire = false)} type="button">Non-fire</button>
      </div>
    </label>

    <label class="field-label">
      Requirements
      <textarea
        class="field-textarea"
        bind:value={aRequirements}
        rows={3}
        placeholder="Stage dimensions, safety needs, sound, lighting..."
      ></textarea>
    </label>

    <label class="field-label">
      Video URL
      <input
        class="field-input"
        type="url"
        bind:value={aVideoUrl}
        placeholder="https://youtu.be/..."
      />
    </label>
  </div>

  {#snippet footer()}
    <ModalFooter align="between">
      <div class="modal-left-actions">
        {#if editingActId}
          <button
            class="ghost"
            onclick={() => navigator.clipboard.writeText(aDescription)}
            title="Copy description to clipboard"
            type="button"
          >
            <i class="fas fa-copy" aria-hidden="true"></i>
            Copy
          </button>
          <button
            class="ghost danger-text"
            onclick={() => { deleteAct(editingActId!); cancelActForm(); }}
            title="Delete this act"
            type="button"
          >
            <i class="fas fa-trash" aria-hidden="true"></i>
            Delete
          </button>
        {/if}
      </div>
      <div class="modal-right-actions">
        <button class="secondary" onclick={cancelActForm} type="button">Cancel</button>
        <button class="primary" onclick={saveActForm} disabled={!aTitle.trim()} type="button">
          {editingActId ? "Save Changes" : "Add Act"}
        </button>
      </div>
    </ModalFooter>
  {/snippet}
</BaseModal>

<style>
  .portfolio-editor {
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .portfolio-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
    gap: 1.25rem;
    padding: 1.25rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ─── Empty state ─────────────────────────────────────────────────────────── */

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    color: var(--theme-accent, #6366f1);
    opacity: 0.5;
  }

  .empty-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-body {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    max-width: 360px;
    line-height: 1.6;
  }

  .empty-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .primary-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .primary-btn:hover {
    opacity: 0.85;
  }

  .secondary-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 6px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
  }

  .secondary-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  /* ─── Sections ────────────────────────────────────────────────────────────── */

  .section-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .workshops-card,
  .acts-card,
  .videos-card {
    grid-column: 1 / -1;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-section {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.45));
    font-style: italic;
  }

  /* ─── Add button ──────────────────────────────────────────────────────────── */

  .add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
    border-radius: 8px;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: background var(--transition-fast, 0.15s);
  }

  .add-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .add-btn:not(:disabled):hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .ghost-add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: none;
    border: none;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: color var(--transition-fast, 0.15s);
  }

  .ghost-add-btn:hover {
    color: var(--theme-accent, #6366f1);
  }

  /* ─── Workshop modal (uses BaseModal) ─────────────────────────────────────── */

  .workshop-form-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .modal-left-actions {
    display: flex;
    gap: 8px;
  }

  .modal-right-actions {
    display: flex;
    gap: 8px;
  }

  .danger-text {
    color: var(--semantic-error, #ef4444) !important;
  }

  .danger-text:hover {
    background: rgba(239, 68, 68, 0.1) !important;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .field-input,
  .field-textarea {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 7px 10px;
    font-family: inherit;
  }

  .field-input:focus,
  .field-textarea:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .level-toggle-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .level-btn {
    padding: 4px 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    background: none;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    text-transform: capitalize;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .level-btn.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: #fff;
  }

  /* ─── Image upload area ──────────────────────────────────────────────────── */

  .hidden-file-input {
    display: none;
  }

  .image-upload-area {
    all: unset;
    position: relative;
    width: 100%;
    height: 120px;
    border: 2px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: hidden;
    transition: border-color var(--transition-fast, 0.15s);
    box-sizing: border-box;
  }

  .image-upload-area:hover {
    border-color: var(--theme-accent, #6366f1);
  }

  .image-upload-area:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .image-upload-area.has-image {
    border: none;
  }

  .image-upload-area img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.35));
    font-size: var(--font-size-compact, 12px);
  }

  .upload-placeholder i {
    font-size: 20px;
  }

  .image-change-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.5);
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-compact, 12px);
    opacity: 0;
    transition: opacity var(--transition-fast, 0.15s);
  }

  .image-upload-area:hover .image-change-overlay {
    opacity: 1;
  }

  .upload-progress-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: rgba(0, 0, 0, 0.3);
  }

  .upload-progress-bar {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    transition: width 0.2s;
  }

  @media (prefers-reduced-motion: reduce) {
    .image-upload-area,
    .image-change-overlay,
    .upload-progress-bar {
      transition: none;
    }
  }

  /* ─── Workshop list ───────────────────────────────────────────────────────── */

  .workshop-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  /* ─── Act list ──────────────────────────────────────────────────────────── */

  .act-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .act-add-btn {
    background: color-mix(in srgb, #f59e0b 15%, transparent);
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
    color: #f59e0b;
  }

  .act-add-btn:not(:disabled):hover {
    background: color-mix(in srgb, #f59e0b 25%, transparent);
  }

  .act-form-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* ─── Performance credits (pill flow) ─────────────────────────────────────── */

  .credits-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .profile-credits-column {
    min-width: 0;
    overflow: hidden;
  }

  .credit-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border-radius: 16px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #ffffff);
    max-width: 100%;
  }

  .credit-pill span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .credit-remove {
    opacity: 0;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    border-radius: 50%;
    font-size: 10px;
    transition: opacity 0.15s, color 0.15s;
  }

  .credit-pill:hover .credit-remove,
  .credit-pill:focus-within .credit-remove {
    opacity: 1;
  }

  .credit-remove:hover {
    color: var(--semantic-error, #ef4444);
  }

  .credit-add-input {
    background: none;
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 16px;
    padding: 4px 10px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #ffffff);
    min-width: 0;
    width: 100%;
    max-width: 160px;
  }

  .credit-add-input::placeholder {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
  }

  .credit-add-input:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
    border-style: solid;
  }

  @media (max-width: 768px) {
    .credit-remove {
      opacity: 1;
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .credit-remove {
      transition: none;
    }
  }

  /* ─── Performance videos (thumbnail grid) ─────────────────────────────────── */

  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .video-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    position: relative;
  }

  .video-thumbnail {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
  }

  .video-thumbnail-placeholder {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.3));
    font-size: 24px;
  }

  .video-overlay {
    position: absolute;
    inset: 0;
    bottom: auto;
    aspect-ratio: 16 / 9;
    background: transparent;
    pointer-events: none;
  }

  .video-remove-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    opacity: 0;
    pointer-events: auto;
    transition: opacity 0.15s, background 0.15s;
  }

  .video-card:hover .video-remove-btn,
  .video-card:focus-within .video-remove-btn {
    opacity: 1;
  }

  /* Overlay scrim colors are intentionally hardcoded -- they sit on
     dynamic thumbnail backgrounds, not themed surfaces. */

  .video-remove-btn:hover {
    background: var(--semantic-error, #ef4444);
  }

  .video-url-label {
    padding: 8px 10px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .video-add-row {
    display: flex;
    gap: 8px;
  }

  @media (max-width: 768px) {
    .video-remove-btn {
      opacity: 1;
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .video-remove-btn {
      transition: none;
    }
  }

  /* ─── Video add row inputs ───────────────────────────────────────────────── */

  .add-input {
    flex: 1;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 7px 10px;
  }

  .add-input:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .add-inline-btn {
    padding: 7px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
  }

  .add-inline-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .add-inline-btn:not(:disabled):hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  /* ─── Profile card (social + about) ──────────────────────────────────────── */

  .profile-layout {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 900px) {
    .profile-layout {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 600px) {
    .profile-layout {
      grid-template-columns: 1fr;
    }
  }

  .profile-column-title {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }

  .social-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    cursor: pointer;
  }

  .social-row:last-child {
    border-bottom: none;
  }

  .social-icon {
    width: 20px;
    text-align: center;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    flex-shrink: 0;
  }

  .social-value {
    flex: 1;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #ffffff);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .social-value.empty {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.3));
    font-style: italic;
  }

  .social-edit-input {
    flex: 1;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-accent, #6366f1);
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 4px 8px;
  }

  .social-edit-input:focus {
    outline: none;
  }

  .about-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    cursor: pointer;
  }

  .about-row:last-child {
    border-bottom: none;
  }

  .about-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    flex-shrink: 0;
    min-width: 0;
  }

  .about-value {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, #ffffff);
    font-weight: 500;
    word-break: break-word;
    text-align: right;
  }

  .about-value.empty {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.3));
    font-style: italic;
    font-weight: 400;
  }
</style>
