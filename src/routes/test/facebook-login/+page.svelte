<!--
  /test/facebook-login — REAL Facebook login harness.

  Drives the actual auth services against REAL Firebase + Facebook (not the
  emulator), so it exercises the popup, consent, redirect URI, profile picture,
  and the collision → pending-link auto-resolution end to end.

  It calls signInWithFacebook() directly, so it works WITHOUT flipping the global
  FACEBOOK_LOGIN_ENABLED UI gate — flip nothing, just use this page.

  Prereq for FB to actually work: the external config in
  docs/reference/facebook-login-e2e-checklist.md (Firebase provider enabled, FB
  app Live, OAuth redirect URI). If those aren't done you'll see
  auth/operation-not-allowed or a "URL blocked" popup — this page surfaces both.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import {
    signInWithFacebook,
    linkFacebookAccount,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  } from "$lib/shared/auth/services/authenticator";
  import {
    hasPendingLink,
    getPendingLinkEmail,
    getPendingLinkProviderId,
    clearPendingLink,
  } from "$lib/shared/auth/services/pending-credential-link";
  import { FACEBOOK_LOGIN_ENABLED } from "$lib/shared/auth/services/auth-providers.config";
  import { app } from "$lib/shared/auth/firebase";

  type LogEntry = {
    time: string;
    action: string;
    ok: boolean;
    code?: string;
    message?: string;
    hint?: string;
  };

  let log = $state<LogEntry[]>([]);
  let busy = $state<string | null>(null);
  let email = $state("");
  let password = $state("");

  // Pending-link is module state (not a rune) — poll a snapshot so the card stays live.
  let pending = $state({ has: false, email: null as string | null, provider: null as string | null });
  function refreshPending() {
    pending = {
      has: hasPendingLink(),
      email: getPendingLinkEmail(),
      provider: getPendingLinkProviderId(),
    };
  }

  onMount(() => {
    refreshPending();
    const id = setInterval(refreshPending, 600);
    return () => clearInterval(id);
  });

  const HINTS: Record<string, string> = {
    "auth/operation-not-allowed":
      "Facebook provider is NOT enabled in the Firebase Console (Authentication → Sign-in method). Checklist step 1.",
    "auth/popup-blocked": "Browser blocked the popup. Allow popups for this origin and retry.",
    "auth/popup-closed-by-user": "You closed the popup before finishing.",
    "auth/cancelled-popup-request": "A previous popup was still open; harmless.",
    "auth/account-exists-with-different-credential":
      "Email already has an account via another provider. Pending FB credential stashed — now sign in with the ORIGINAL method below to auto-link.",
    "auth/credential-already-in-use":
      "This Facebook account is already linked to a different user.",
    "auth/unauthorized-domain":
      "This origin isn't in Firebase Auth → Settings → Authorized domains. Add it.",
    "auth/argument-error":
      "Likely an HMR-stale auth instance — hard-refresh the page.",
  };

  function note(action: string, ok: boolean, err?: unknown) {
    const code = (err as { code?: string })?.code;
    const message = err instanceof Error ? err.message : err ? String(err) : undefined;
    log = [
      {
        time: new Date().toLocaleTimeString(),
        action,
        ok,
        code,
        message,
        hint: code ? HINTS[code] : undefined,
      },
      ...log,
    ].slice(0, 50);
    refreshPending();
  }

  async function run(action: string, fn: () => Promise<void>) {
    if (busy) return;
    busy = action;
    try {
      await fn();
      note(action, true);
    } catch (err) {
      console.error(`[fb-test] ${action} failed`, err);
      note(action, false, err);
    } finally {
      busy = null;
    }
  }

  const u = $derived(authState.user);
  const providers = $derived(u?.providerData.map((p) => p.providerId) ?? []);

  async function copyDiagnostics() {
    const snapshot = {
      config: {
        FACEBOOK_LOGIN_ENABLED,
        authDomain: app.options.authDomain,
        projectId: app.options.projectId,
        origin: location.origin,
      },
      user: u
        ? {
            uid: u.uid,
            isAnonymous: u.isAnonymous,
            displayName: u.displayName,
            email: u.email,
            emailVerified: u.emailVerified,
            photoURL: u.photoURL,
            providers,
          }
        : null,
      pending,
      log,
    };
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    note("copy diagnostics", true);
  }
</script>

<div class="page">
  <h1>Facebook Login — real test harness</h1>
  <p class="sub">
    Calls the real auth services against real Firebase + Facebook. Bypasses the
    <code>FACEBOOK_LOGIN_ENABLED</code> UI gate. See
    <code>docs/reference/facebook-login-e2e-checklist.md</code> for external config.
  </p>

  <div class="grid">
    <!-- Config -->
    <section class="card">
      <h2>Config</h2>
      <dl>
        <dt>FACEBOOK_LOGIN_ENABLED (UI gate)</dt>
        <dd>{String(FACEBOOK_LOGIN_ENABLED)}</dd>
        <dt>authDomain</dt><dd>{app.options.authDomain}</dd>
        <dt>projectId</dt><dd>{app.options.projectId}</dd>
        <dt>origin</dt><dd>{typeof location !== "undefined" ? location.origin : "—"}</dd>
      </dl>
    </section>

    <!-- Auth state -->
    <section class="card">
      <h2>Auth state {authState.loading ? "(loading…)" : ""}</h2>
      {#if u}
        <div class="who">
          {#if u.photoURL}
            <img class="avatar" src={u.photoURL} alt="profile" referrerpolicy="no-referrer" />
          {:else}
            <div class="avatar avatar--empty">no photo</div>
          {/if}
          <dl>
            <dt>uid</dt><dd class="mono">{u.uid}</dd>
            <dt>displayName</dt><dd>{u.displayName ?? "—"}</dd>
            <dt>email</dt><dd>{u.email ?? "—"} {u.emailVerified ? "✓" : "(unverified)"}</dd>
            <dt>isAnonymous</dt><dd>{String(u.isAnonymous)}</dd>
            <dt>isFullAccount</dt><dd>{String(authState.isFullAccount)}</dd>
            <dt>providers</dt><dd>{providers.length ? providers.join(", ") : "—"}</dd>
          </dl>
        </div>
        {#if u.photoURL?.includes("graph.facebook.com")}
          <p class="warn">
            Photo is a graph.facebook.com URL (finding F4). If the avatar above is
            broken, the URL was rejected — fallback avatar applies.
          </p>
        {/if}
      {:else}
        <p class="dim">Signed out.</p>
      {/if}
    </section>

    <!-- Pending link -->
    <section class="card">
      <h2>Pending credential link (F2/F3)</h2>
      <dl>
        <dt>hasPendingLink</dt><dd>{String(pending.has)}</dd>
        <dt>email</dt><dd>{pending.email ?? "—"}</dd>
        <dt>provider</dt><dd>{pending.provider ?? "—"}</dd>
      </dl>
      {#if pending.has}
        <p class="warn">
          A Facebook credential is stashed. Sign in with the original method
          ({pending.email}) below — it should auto-link Facebook.
        </p>
        <button onclick={() => { clearPendingLink(); refreshPending(); }}>Clear pending</button>
      {/if}
    </section>
  </div>

  <!-- Actions -->
  <section class="card">
    <h2>Actions</h2>
    <div class="actions">
      <button class="primary fb" disabled={!!busy} onclick={() => run("signInWithFacebook", signInWithFacebook)}>
        {busy === "signInWithFacebook" ? "…" : "Sign in with Facebook"}
      </button>
      <button class="fb" disabled={!!busy || !u} onclick={() => run("linkFacebookAccount", linkFacebookAccount)}>
        Link Facebook to current account
      </button>
      <button class="google" disabled={!!busy} onclick={() => run("signInWithGoogle", signInWithGoogle)}>
        Sign in with Google
      </button>
      <button disabled={!!busy || !u} onclick={() => run("signOut", signOut)}>Sign out</button>
      <button disabled={!!busy} onclick={() => run("refreshUser", () => authState.refreshUser())}>Refresh user</button>
    </div>

    <div class="email-form">
      <strong>Email / password</strong>
      <span class="dim">(reproduce the collision: sign up here with email X, sign out, FB-login with the same X, then sign back in here to watch the auto-link)</span>
      <div class="row">
        <input type="email" placeholder="email" bind:value={email} autocomplete="off" />
        <input type="password" placeholder="password (8+)" bind:value={password} autocomplete="off" />
        <button disabled={!!busy || !email || !password} onclick={() => run("signInWithEmail", () => signInWithEmail(email, password))}>Sign in</button>
        <button disabled={!!busy || !email || !password} onclick={() => run("signUpWithEmail", () => signUpWithEmail(email, password))}>Sign up</button>
      </div>
    </div>
  </section>

  <!-- Log -->
  <section class="card">
    <div class="log-head">
      <h2>Event log</h2>
      <div>
        <button onclick={copyDiagnostics}>Copy diagnostics</button>
        <button onclick={() => (log = [])}>Clear log</button>
      </div>
    </div>
    {#if log.length === 0}
      <p class="dim">No events yet.</p>
    {:else}
      <ul class="log">
        {#each log as e}
          <li class={e.ok ? "ok" : "err"}>
            <span class="t">{e.time}</span>
            <span class="a">{e.action}</span>
            <span class="s">{e.ok ? "OK" : "FAIL"}</span>
            {#if e.code}<code class="code">{e.code}</code>{/if}
            {#if e.message}<span class="msg">{e.message}</span>{/if}
            {#if e.hint}<span class="hint">→ {e.hint}</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 24px;
    color: var(--theme-text, #e5e7eb);
    font-family: system-ui, sans-serif;
  }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 0 0 10px; }
  .sub { color: var(--theme-text-dim, #9ca3af); margin: 0 0 20px; font-size: 0.85rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .card {
    background: var(--theme-card-bg, #1f2937);
    border: 1px solid var(--theme-stroke, #374151);
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 16px;
  }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 0.85rem; }
  dt { color: var(--theme-text-dim, #9ca3af); }
  dd { margin: 0; word-break: break-word; }
  .mono, .code { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .who { display: flex; gap: 14px; align-items: flex-start; }
  .avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #374151; }
  .avatar--empty { display: grid; place-items: center; font-size: 0.65rem; color: #9ca3af; }
  .dim { color: var(--theme-text-dim, #9ca3af); }
  .warn { color: #fbbf24; font-size: 0.8rem; margin: 10px 0 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  button {
    min-height: 40px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, #374151);
    background: var(--theme-card-bg, #374151);
    color: var(--theme-text, #e5e7eb);
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.primary { border: none; }
  button.fb { background: #1877f2; color: #fff; border: none; }
  button.google { background: #fff; color: #111827; border: none; }
  .email-form { border-top: 1px solid var(--theme-stroke, #374151); padding-top: 14px; font-size: 0.85rem; }
  .email-form .dim { display: block; margin: 4px 0 10px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  input {
    min-height: 40px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, #374151);
    background: #111827;
    color: var(--theme-text, #e5e7eb);
  }
  .log-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .log-head > div { display: flex; gap: 8px; }
  .log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; }
  .log li { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; padding: 8px; border-radius: 6px; background: #111827; }
  .log li.err { background: color-mix(in srgb, #ef4444 14%, #111827); }
  .log .t { color: #6b7280; }
  .log .a { font-weight: 700; }
  .log li.ok .s { color: #34d399; }
  .log li.err .s { color: #f87171; font-weight: 700; }
  .log .code { color: #fbbf24; }
  .log .msg { color: #d1d5db; flex-basis: 100%; }
  .log .hint { color: #93c5fd; flex-basis: 100%; }
</style>
