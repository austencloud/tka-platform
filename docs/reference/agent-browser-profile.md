# Shared Agent Browser Profile

Codex and Claude share one dedicated TKA application profile for browser tasks
that Austen has approved. It prevents either agent from appearing as Austen or
as the Google reviewer.

There are two distinct names in this workflow:

- `Agent DevTools` is the Chrome shell profile and visible taskbar identity.
- `Codex + Claude` is the ordinary-user TKA application account used inside it.

## Identity

| Field        | Value                         |
| ------------ | ----------------------------- |
| Display name | `Codex + Claude`              |
| Username     | `codex-claude`                |
| Email        | `codex-claude@agents.invalid` |
| Firebase UID | `agent-codex-claude`          |
| Access       | Ordinary user                 |

The public bio states that this is a shared test profile used for
Austen-approved verification. It is hidden from creator listings. Test-account
markers live in private admin metadata, not in the public profile.

The account must remain enabled, email-verified, and limited to the `user`
role. Never grant it admin, tester, premium, contributor, or reviewer access.

## Credential storage

The credential is stored outside the repository at:

```text
C:\Users\Austen\.tka\agent-profile.credential.json
```

The password is protected for Austen's Windows user with DPAPI. It is not
stored as plaintext in the file or the repository. Both agents can use it when
running as the same Windows user on this computer.

Never print, log, inspect, commit, or paste the password into chat. Do not copy
the credential file to another computer. Provisioning on another computer can
rotate the shared password, so coordinate that change with Austen first.

## Sign-in workflow

Use the shared debug Chrome process and a task-owned background tab as required
by `AGENTS.md`. Interactive browser actions still require Austen's approval in
the current conversation.

The launcher always uses `Profile 1` inside
`C:\Users\Austen\.claude\chrome-profile`. Chrome displays that shell profile as
`Agent DevTools`; the non-default directory is also part of its Windows
taskbar identity. Do not launch this profile directly or substitute `Default`.

If the production browser session is already signed in as `Codex + Claude`, use
that session. If a sign-in is required, copy one field at a time:

```powershell
pwsh -NoProfile -File scripts/agent-profile-credential.ps1 -Action CopyEmail
pwsh -NoProfile -File scripts/agent-profile-credential.ps1 -Action ClearClipboard
pwsh -NoProfile -File scripts/agent-profile-credential.ps1 -Action CopyPassword
pwsh -NoProfile -File scripts/agent-profile-credential.ps1 -Action ClearClipboard
```

Paste each value only into the matching sign-in field. Clear the clipboard
immediately after each paste. Never read the password back from the clipboard
or from the protected credential file.

When verification ends, close only the task-owned tab. Leave the shared browser
and its authenticated session running unless Austen asks for a sign-out.

## Desktop and taskbar shortcuts

Create or repair the profile-specific desktop shortcuts in the background:

```powershell
pwsh -NoProfile -File launchers/install-chrome-profile-shortcuts.ps1
```

The installer creates:

- `Austen - Chrome`, which carries `Chrome.UserData.Default` and uses Austen's
  native `Default\Google Profile.ico` profile image.
- `Agent DevTools - Chrome`, which carries the agent profile AppUserModelID and
  uses the violet code-window fallback icon. Chrome shows the Agent DevTools
  profile badge while that window is running.

It does not restart Explorer, focus Chrome, or change taskbar pins. Windows
requires the user to unpin stale Chrome entries and pin these shortcuts once.
Keep the desktop shortcuts after pinning so the repair source remains obvious.
Do not pin Chrome from Start or from the profile-picker window: those use the
generic `Chrome` and `Chrome.UserData.SystemProfile` identities, which create
extra taskbar entries instead of opening Austen's `Default` profile group.

## Provisioning and audit

Read-only local credential status:

```powershell
pwsh -NoProfile -File scripts/agent-profile-credential.ps1 -Action Status
```

Provision or repair the known profile only when Austen approves that state
change:

```powershell
pwsh -NoProfile -File scripts/agent-profile-credential.ps1 -Action Provision
```

Password rotation requires separate approval:

```powershell
pwsh -NoProfile -File scripts/agent-profile-credential.ps1 -Action Provision -RotatePassword
```

The provisioner refuses UID, email, display-name, and username collisions. It
also verifies the Auth account, least-privilege claims, public/private profile
separation, hidden-listing status, private test metadata, and username
ownership. It does not change Austen's account or the Google reviewer account.

## Boundaries

- Use this identity only for an approved TKA browser task.
- Do not use it for Google, Firebase Console, GitHub, email, billing, deployment,
  or other infrastructure sign-ins.
- Do not elevate it to make an admin test pass. Admin verification requires a
  separately authorized identity and workflow.
- If the profile cannot perform an ordinary-user action, report the denial. Do
  not borrow another person's session.
