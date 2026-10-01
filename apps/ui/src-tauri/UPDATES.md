# Desktop updates & signing (Tauri)

This folder contains the Tauri (desktop) app for Happiest. Desktop releases are built for Windows x64 and Linux x64.

## Current status

- Automatic updates are implemented via the Tauri v2 updater plugin:
  - Rust registers the updater plugin and exposes Tauri commands used by the UI.
  - `tauri.conf.json` configures the stable update endpoint; `tauri.preview.conf.json` and `tauri.publicdev.conf.json` override it for preview/dev feeds.
  - GitHub Actions publishes platform updater artifacts plus a `latest.json` feed used by the app.
- The app's name and identifier (`Happiest`, `click.erikaalk.happiest`; preview and dev append ` (preview)`/` (dev)` and `.preview`/`.publicdev`) differ from upstream Happier, so both desktop apps install side by side with separate data directories.

## Two different “signing” concepts

### 1) Updater signing (update integrity)

Tauri’s updater mechanism verifies that update metadata and artifacts were produced by the release pipeline (tamper protection). This is *not* the same as OS-level code signing.

Setup:

1. Generate an updater signing keypair (private key + public key), e.g. `yarn tauri signer generate -w ~/.tauri/happiest.key` in `apps/ui`.
2. Embed the **public key** in `plugins.updater.pubkey` of all three Tauri configs so the app can verify signatures.
3. Store the **private key** and its password in the `release-shared` GitHub environment of the repository:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### 2) Code signing (OS trust / installer UX)

Code signing reduces “unknown publisher” warnings (Windows Authenticode / SmartScreen). Happiest's Windows installers are not code-signed; updater signing works without it.

## Release model (repo convention)

We publish UI Desktop component releases on `ErikaAlk/happiest`:

- Production: tag/release `ui-desktop-vX.Y.Z`
- Preview (rolling prerelease): tag/release `ui-desktop-preview` (assets replaced on each build)
- Stable update feed (rolling): tag/release `ui-desktop-stable` (hosts `latest.json` pointing at the latest `ui-desktop-vX.Y.Z` assets)

Desktop updater artifacts and feeds are published by `.github/workflows/build-tauri.yml` through the centralized publisher `.github/workflows/publish-ui-release.yml`.

## Implementing auto-updates

We use the official Tauri updater plugin and a static JSON feed (`latest.json`) published to GitHub Releases.

Key pieces:

- Rust: `tauri-plugin-updater` in `Cargo.toml`, registered in `src/lib.rs`.
- Config: `plugins.updater` in `tauri.conf.json`:
  - `endpoints` (stable) and `pubkey` (base64-encoded minisign public key; Tauri updater signing uses minisign, not PEM)
  - preview overrides endpoints in `tauri.preview.conf.json`
  - public dev overrides endpoints in `tauri.publicdev.conf.json`
- Local builds: `bundle.createUpdaterArtifacts` is disabled by default so contributors can build the desktop app without updater signing keys.
- CI: the finalizer requires `TAURI_SIGNING_PRIVATE_KEY`, enables `bundle.createUpdaterArtifacts` and publishes:
  - platform update bundles (per target)
  - `latest.json` (public dev: `ui-desktop-dev/latest.json`, preview: `ui-desktop-preview/latest.json`, stable: `ui-desktop-stable/latest.json`)
