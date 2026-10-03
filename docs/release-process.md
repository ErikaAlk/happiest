# Release process

Happiest publishes GitHub Releases on `ErikaAlk/happiest`, cut from this fork's `dev` branch and
recorded on `main`. Only the stable channel is published.

- `dev` is the integration branch where changes land first (default branch; can be unstable).
- `main` is the stable release branch. A release fast-forwards it to the exact `dev` commit it
  publishes.
- `preview` is not used. The release workflow still accepts `environment=preview`, but Happiest does
  not publish a preview channel.
- `deploy/**` branches are not used: Happiest deploys no hosted service.

## Contributing flow (recommended)

1. Create a feature branch from `dev`.
2. Open a pull request targeting `dev`.
3. After review, changes are merged into `dev`.

Notes:

- Maintainers may push directly to `dev` when needed (depending on branch rules).
- External contributors should assume **PRs must target `dev`**, not `main`.

## What a release publishes

Each product gets an immutable `<product>-v<version>` Release and a rolling `<product>-stable`
Release that always points at the newest stable bytes. Versions start at `0.1.0`.

| Product | Tags | Platforms | Published by |
| --- | --- | --- | --- |
| CLI binaries, plus `install.sh`, `install.ps1`, `install-server.sh` and the minisign public key `happier-release.pub` | `cli-v<version>`, `cli-stable` | Linux x64, Linux arm64, Windows x64 | `publish-cli-binaries.yml` |
| Relay server runtime | `server-v<version>`, `server-stable` | Linux x64, Linux arm64, Windows x64 | `publish-server-runtime.yml` |
| UI web bundle (served by self-hosted relays) | `ui-web-v<version>`, `ui-web-stable` | platform independent | `publish-ui-web.yml` |
| Desktop app | `ui-desktop-v<version>`, `ui-desktop-stable` | Windows x64, Linux x64 | `promote-ui.yml` → `build-tauri.yml` |

Product names, release titles and targets come from
`scripts/pipeline/release/publishing/product-specs.mjs`, which repeats the product identity and the
component catalog and is checked against them by
`scripts/release/publish_binary_product_specs.contract.test.mjs`. Installer scripts, Tauri configs,
Dockerfiles and workflows carry identity literals checked by
`scripts/release/product_identity_literals.contract.test.mjs`. The mobile app variants derive their
Android application ids from the identity's `androidPackage` (`apps/ui/appVariantConfig.cjs`); the
dev-client ids in `apps/ui/eas.json` are checked by the `ui_mobile_eas_*_profile` contract tests,
and `apps/ui/sources/__tests__/config/googleServices.variantPackages.test.ts` checks that
`apps/ui/google-services.json` registers every id the app is built with.

Not published: npm packages, Homebrew formulae or casks, Docker images (the repository `Dockerfile`
and `docker/dev-box/Dockerfile` download these releases and can be built locally), hstack binaries
(its command name is the same as upstream's), mobile builds and Expo updates, and hosted
deployments of the web app, website, docs or server.

Signing:

- CLI, server runtime and UI web artifacts are signed with minisign. The workflows read
  `MINISIGN_SECRET_KEY` and `MINISIGN_PASSPHRASE`; installers and the CLI's self-update verify with
  the public key embedded in the installers and shipped as `happier-release.pub`.
- Desktop updates are signed with the Tauri updater key (`TAURI_SIGNING_PRIVATE_KEY`,
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`); the matching public key is in the Tauri configs, which
  update from `ui-desktop-stable/latest.json`.
- The Windows desktop installer is not code-signed.

## Cutting a release

Run **RELEASE — Publish (preview + production)** (`release.yml`) from the Actions tab on `dev`.
Writes use the workflow's own `github.token` with `contents: write`, and `release_actor_guard`
admits only actors with admin permission on the repository.

1. Move the product version past the one on `main`
   (`node scripts/pipeline/release/bump-version.mjs --component product --bump <patch|minor|major>`).
   The release publishes the committed version and refuses a CLI or server version equal to
   `main`'s.
2. Add the release entry to `apps/ui/CHANGELOG.md` with the product version as its id (the
   `release_notes_id` input), then regenerate the changelog screen's data
   (`yarn --cwd apps/ui tsx sources/scripts/parseChangelog.ts`).
3. Dispatch once with `dry_run=true` to see the plan without pushing or publishing.
4. Dispatch the release:
   - `environment=production`, `confirm=release dev to main`, `validation_profile=stable`;
   - `authorized_promotion_source_sha` — the exact 40-character `dev` SHA you reviewed (required
     whenever `dry_run` is false);
   - `deploy_targets=ui,cli,server_runner` and `desktop_mode=build_and_publish`;
   - `release_notes_id` from step 2;
   - `waive_ci=true` with an `override_reason`, because the fork does not run upstream's push CI
     (most of its lanes need provider API keys and Android emulators);
   - leave `hmaint_operation_id` and `workflow_control_sha` empty; they belong to upstream's private
     release conductor;
   - `qualified_v4_activation_approval` stays false.
5. The workflow binds that SHA, fast-forwards `main` to it, builds and publishes each product as an
   immutable Release, verifies the published bytes, promotes them to the rolling Releases, and
   fast-forwards `dev` back onto `main`.

`validation_profile` selects the evidence contract (`node scripts/pipeline/run.mjs release-contract`
prints it): `integrated` is the input default, but release admission refuses it for production, so
Happiest releases use `stable`, which adds full source checks. A dry run stops before admission and
does not catch this. `deep` is manual comprehensive source certification (the `deep` profile of
`tests-dispatch.yml`); the release dispatch rejects it.

A non-dry release needs the repository owner's human go-ahead first. The go-ahead names the
validation profile and the exact SHA of the reviewed `dev` commit, passed as
`authorized_promotion_source_sha`; a branch name or a moving channel pointer never stands in for the
exact SHA. Waivers are narrow and recorded in the terminal release status:

| Approval | May bypass | Never bypasses |
| --- | --- | --- |
| `waive_ci` with a reason | exact-SHA source CI plus source-only MySQL and platform-service checks | trust-root checks, candidate identity, signing, artifact verification, binary smoke, or publication authorization |
| `waive_validation_suites` with a reason | selected risk-based suites such as installer, continuity, or Docker compatibility checks | `artifact-verify` and `binary-smoke` |
| guarded branch reset | fast-forward-only branch topology | release admission, candidate verification, or publication checks |

Do not translate "test-only failure" into a blanket waiver. First identify the incorrect test or
harness at its owner; use a bounded waiver only when you explicitly accept the missing evidence for
this exact candidate.

### Release authority and binary integrity

For CLI, server-runtime, and UI-web binary releases:

1. The hosted workflow binds the authorized source commit once.
2. It creates or resumes the version-tagged Release as a draft, uploads missing
   assets, and remotely verifies every asset's bytes before publishing the draft.
   Failed uploads or audits leave the draft private for retry. Existing public
   immutable releases are verified without adding assets or changing visibility;
   missing or different assets fail. Tags and existing bytes are never moved or
   clobbered.
3. It downloads that Release and verifies the complete checksummed and signed
   asset set.
4. A separate promotion step projects those exact bytes into the rolling
   Release, downloads them again, and checks byte equality, checksums, and the
   minisign signature.
5. Promotion creates or reuses one SHA-qualified staging draft, uploads the
   complete unversioned rolling asset set, and audits that draft by Release id.
   Older staging drafts for the same rolling tag are removed.
6. If a predecessor exists, promotion preserves it under one bounded backup tag,
   moves the audited staging Release onto the real rolling tag, verifies the
   public Release and tag, then removes staging and backup refs. Recovery restores
   the predecessor when an interrupted attempt left only the backup visible.

The immutable version-tagged Release remains available throughout. Re-running
the same promotion reuses and re-audits the same-SHA staging draft or recognizes
an already exact rolling Release; it does not create a second publication owner
or blindly append assets to a partial rolling Release.

Immutable publication audits and all rolling-promotion asset downloads share
the read-retry owner in `scripts/pipeline/github/lib/release-asset-transfer.mjs`.
They reuse the existing transfer budget: `HAPPIER_PIPELINE_GH_RELEASE_UPLOAD_RETRIES`
(three attempts), `HAPPIER_PIPELINE_GH_RELEASE_UPLOAD_RETRY_DELAY_MS` (2,000 ms),
and `HAPPIER_PIPELINE_GH_RELEASE_TRANSFER_TIMEOUT_MS` (ten minutes per command).
The legacy `UPLOAD` names already govern publication audit reads as well as
uploads. A failed read restarts with a truncated or clobbered local destination;
retry warnings retain the original error. Transient transport failures and
`gh`'s `unexpected end of JSON input` are retryable reads, not evidence that an
artifact is corrupt. Authorization failures and other permanent errors stop
immediately. Byte, checksum, and signature verification remain outside retries,
and a read retry never repeats a publication mutation.

### Recovering a failed release

| Evidence | Recovery |
| --- | --- |
| Same control SHA; transient runner, download, read-only API, or safely recoverable external failure | `gh run rerun <run-id> --repo ErikaAlk/happiest --failed` |
| Corrected workflow control, tests, or validation; unchanged candidate bytes; terminal origin with verified candidates | dispatch the release again with `resume_run_id` set to the richest valid completed run |
| Changed source, package/build dependency, signing input, or immutable candidate bytes | Prepare a fresh release |
| Ambiguous publication mutation | Inspect the canonical remote state, then use the owning recovery-aware job; never blind-retry |

If a rolling upload is interrupted after the immutable Release was published,
rerun the owning publisher with `channel=stable` and its version as
`retry_version`. Leave `source_ref=auto`: recovery derives the exact authorized
SHA from the product's immutable version tag. Recovery accepts only the latest
published immutable Release for that product; it does not permit rollback to an
arbitrary older version. The supported publishers are:

- **PUBLISH — CLI Binaries (GitHub)** (`publish-cli-binaries.yml`)
- **PUBLISH — Server Runtime (GitHub)** (`publish-server-runtime.yml`)
- **PUBLISH — UI Web Bundle (GitHub)** (`publish-ui-web.yml`)

This recovery path copies the existing immutable bytes; it does not rebuild,
allocate a new version, sign new bytes, or mutate the immutable Release. For
example:

```bash
gh workflow run publish-server-runtime.yml \
  --repo ErikaAlk/happiest \
  --ref dev \
  -f channel=stable \
  -f source_ref=auto \
  -f allow_stable=true \
  -f retry_version=0.1.0
```

Independent jobs should be allowed to finish so one attempt exposes every
reachable failure. Publication and trust-dependent jobs still remain gated by
their real prerequisites: a consumer cannot be tested before its candidate
exists. Poll long builds and publication every 5–20 minutes and use step-level
progress plus the owning timeout; duration alone is not failure evidence.

### Desktop macOS build tooling

Happiest releases build no macOS desktop app; this matters only for local macOS builds. Repository
desktop builds use the shared UI tooling adapter `apps/ui/scripts/tauriActoolEnvironment.mjs`: the
release pipeline's build/bundle commands, `hstack build --tauri`, and UI `tauri:build:*` scripts all
consume it. It temporarily wraps the resolved Xcode `actool` executable to reopen stdin on
`/dev/null`, preserving arguments, environment, exit status, and layered icons. The native Node
Tauri CLI otherwise closes inherited stdin at exec, which can leave Apple's persistent `ibtoold`
helper failing on later invocations too. The adapter warns when active and removes its private
executable directory when the command settles; it does not restart shared Apple helpers or set
private Apple process-registry options. Raw third-party `tauri` invocations are unchanged. Remove
the adapter and its callers once the pinned CLI includes
[the upstream captured-command stdin fix](https://github.com/tauri-apps/tauri/pull/15991), then
verify a real layered-icon bundle with a fresh macOS build worker.

## Why fast-forward?

Fast-forwarding is the safest “no merge commit” promotion:

- It never rewrites history.
- It fails if branches diverged (so you can decide what to do next).

The reset option exists for rare cases where you intentionally want `target` to match `source` exactly.

## Database migrations (server)

For the server, database migrations should be automated as part of the deployment runtime:

- For a single unmanaged container, the default entrypoint may run `prisma migrate deploy` before server startup.
- For health-managed or multi-replica deployments, run `run-server --migrate-only` once in an explicit platform pre-deploy operation. Start API and worker replicas with `RUN_MIGRATIONS=0` only after that operation succeeds.
- When an application platform cannot run and await a blocking pre-deploy operation, designate exactly one API service as the migration owner and set `RUN_MIGRATIONS=0` on workers and all other replicas. Protect that owner with start-first rollout, rollback on failure, and sufficient health-check startup grace; webhook acceptance alone does not prove migration or deployment completion.
- Do not rely on API and worker startup races as migration ownership. Prisma's database lock serializes contenders, but it cannot preserve the winning migration when an orchestrator terminates that container for missing its startup-health window.
- Avoid running migrations at image build-time (Dockerfile), since migrations require a live DB connection.
