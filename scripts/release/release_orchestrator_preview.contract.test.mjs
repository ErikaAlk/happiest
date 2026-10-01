import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { validateReleaseDispatch } from '../pipeline/release/validate-release-dispatch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

async function loadWorkflow(name) {
  return readFile(join(repoRoot, '.github', 'workflows', name), 'utf8');
}

async function loadFile(rel) {
  return readFile(join(repoRoot, rel), 'utf8');
}

test('release workflow only promotes and publishes the exact prepared candidate source', async () => {
  const raw = await loadWorkflow('release.yml');

  // If CI gate fails, checks is skipped; downstream must not treat that as OK to promote/deploy.
  assert.doesNotMatch(
    raw,
    /needs\.plan\.result == 'success' \|\| needs\.plan\.result == 'skipped'/,
    'release orchestrator must not treat skipped checks as eligible for promotion/deploy',
  );

  // promote_main must remain reachable after plan success; final releases never create a post-admission bump commit.
  assert.match(
    raw,
    /promote_main:[\s\S]*?if:\s*always\(\)\s*&&[\s\S]*?inputs\.dry_run != true && inputs\.environment == 'production'[\s\S]*?needs\.plan\.result == 'success'/,
  );
  assert.doesNotMatch(raw, /^  bump_versions_dev:/m);
  assert.doesNotMatch(raw, /needs\.bump_versions_dev/);
  assert.match(raw, /node scripts\/pipeline\/release\/validate-release-dispatch\.mjs/);
  const previewDispatch = {
    authorizedPromotionSourceSha: 'a'.repeat(40),
    releaseNotesId: 'release-1',
    bump: 'none',
    deployTargets: 'ui,server_runner',
    environment: 'preview',
    dryRun: false,
  };
  assert.equal(validateReleaseDispatch({ ...previewDispatch, confirm: 'release dev to preview' }).mode, 'preview_release');
  assert.throws(
    () => validateReleaseDispatch({ ...previewDispatch, confirm: 'release dev to main' }),
    /Confirmation mismatch for preview releases/u,
  );

  assert.match(raw, /source_ref:\s*\$\{\{ needs\.prepare_release_candidate\.outputs\.source_sha \}\}/);
  assert.match(raw, /deploy_ui:[\s\S]*?bump:\s*none/);
  assert.match(
    raw,
    /sync_dev:[\s\S]*?if:\s*\$\{\{\s*inputs\.dry_run != true && inputs\.environment == 'production'[\s\S]*?needs\.release_verify\.result == 'success'/,
  );
  assert.doesNotMatch(raw, /needs\.release_verify\.result == 'skipped'/, 'production sync must not accept skipped release verification');
  assert.match(raw, /Compute versioned component changes \(latest release tags\.\.release head\)[\s\S]*?compute-versioned-component-changes\.mjs/);
  assert.match(raw, /VERSIONED_APP_CHANGED:\s*\$\{\{\s*steps\.versioned_plan\.outputs\.changed_app\s*\}\}/);
  assert.match(raw, /VERSIONED_CLI_CHANGED:\s*\$\{\{\s*steps\.versioned_plan\.outputs\.changed_cli\s*\}\}/);
});

test('release workflow publishes server runner only when explicitly requested', async () => {
  const raw = await loadWorkflow('release.yml');

  // Server runner publishing is an explicit target.
  // The logic lives in the shared pipeline script (not inline bash).
  assert.match(raw, /node \.\.\/scripts\/pipeline\/release\/resolve-bump-plan\.mjs/);
  assert.match(raw, /--deploy-targets "\$\{DEPLOY_TARGETS\}"/);

  assert.match(
    raw,
    /publish_server_runtime_needed:\s*\$\{\{[^\n]*inputs\.force_deploy == true[^\n]*steps\.bump_plan\.outputs\.publish_server == 'true'[^\n]*steps\.plan\.outputs\.changed_ui == 'true'[^\n]*steps\.plan\.outputs\.changed_server == 'true'[^\n]*steps\.plan\.outputs\.changed_shared == 'true'[^\n]*\}\}[\s\S]*?publish_server_runtime:[\s\S]*?needs\.plan\.outputs\.publish_server_runtime_needed == 'true'/,
    'server runtime artifacts should publish when server code or its embedded UI changes',
  );
  assert.match(
    raw,
    /publish_server_runtime:[\s\S]*?uses:\s*\.\/\.github\/workflows\/publish-server-runtime\.yml/,
    'server runtime publishing should be handled by a dedicated workflow',
  );
  assert.match(
    raw,
    /publish_server_runtime:[\s\S]*?channel:\s*\$\{\{\s*inputs\.environment == 'production' && 'stable' \|\| 'preview'\s*\}\}/,
    'server runtime publishing should select stable vs preview through the shared channel mapping',
  );
  assert.match(
    raw,
    /publish_server_runtime:[\s\S]*?source_ref:\s*\$\{\{\s*needs\.prepare_release_candidate\.outputs\.source_sha\s*\}\}/,
    'server runtime publishing should build from the exact prepared candidate',
  );
  assert.match(
    raw,
    /publish_server_runtime:[\s\S]*?allow_stable:\s*\$\{\{\s*inputs\.environment == 'production'\s*\}\}/,
    'server runtime publishing should explicitly unlock stable publishing only for production releases',
  );
});

test('release workflow accepts the public validation profile and routes its automatic suites', async () => {
  const raw = await loadWorkflow('release.yml');
  const workflow = parse(raw);
  const validationProfile = workflow?.on?.workflow_dispatch?.inputs?.validation_profile;
  const candidateVerifier = workflow?.jobs?.verify_release_candidates;

  assert.equal(validationProfile?.type, 'choice');
  assert.equal(validationProfile?.default, 'integrated');
  assert.deepEqual(validationProfile?.options, ['integrated', 'stable']);

  assert.equal(candidateVerifier?.with?.validation_profile, '${{ needs.plan.outputs.validation_profile }}');
  assert.equal(candidateVerifier?.with?.run_binary_smoke, undefined);
  assert.equal(candidateVerifier?.with?.run_session_continuity, undefined);
  assert.equal(candidateVerifier?.with?.run_cli_update_continuity, undefined);
  assert.equal(candidateVerifier?.with?.run_daemon_continuity, undefined);
  assert.equal(candidateVerifier?.with?.run_installers_smoke, undefined);
});

test('release workflow does not publish, verify, or promote HStack, which only the nightly workflow still builds', async () => {
  const [raw, verifierRaw, nightlyRaw] = await Promise.all([
    loadWorkflow('release.yml'),
    loadWorkflow('release-verify.yml'),
    loadWorkflow('nightly-dev.yml'),
  ]);
  const jobs = parse(raw)?.jobs ?? {};
  const candidateVerifier = jobs.verify_release_candidates;
  const finalVerifier = jobs.release_verify;
  const verifierInputs = parse(verifierRaw)?.on?.workflow_call?.inputs ?? {};

  assert.doesNotMatch(raw, /hstack|stack_requested|stack_rolling_complete|publish_stack|HSTACK|stack-\$CHANNEL_SUFFIX/i);
  assert.equal(jobs.publish_hstack_binaries, undefined);
  assert.equal(jobs.promote_hstack_binaries, undefined);
  assert.equal(candidateVerifier?.with?.candidate_stack_version, undefined);
  assert.equal(candidateVerifier?.with?.verify_stack_release, undefined);
  assert.equal(jobs.verify_resume_candidates?.with?.candidate_stack_version, undefined);
  assert.match(JSON.stringify(finalVerifier?.steps ?? []), /server-\$CHANNEL_SUFFIX cli-\$CHANNEL_SUFFIX ui-web-\$CHANNEL_SUFFIX/);

  // The nightly workflow still builds HStack, so the shared verifier keeps the candidate input but no release caller sets a stack verification requirement.
  assert.equal(verifierInputs?.candidate_stack_version?.type, 'string');
  assert.equal(verifierInputs?.verify_stack_release, undefined);
  assert.equal(
    parse(verifierRaw)?.jobs?.verify_candidate?.steps?.find((step) => step.name === 'Require requested HStack verification identity'),
    undefined,
  );
  assert.match(nightlyRaw, /candidate_stack_version:\s*\$\{\{ needs\.hstack\.outputs\.version \}\}/);
});

test('release workflow can publish self-host UI web bundle via a dedicated workflow', async () => {
  const raw = await loadWorkflow('release.yml');
  assert.match(
    raw,
    /publish_ui_web:[\s\S]*?uses:\s*\.\/\.github\/workflows\/publish-ui-web\.yml/,
    'self-host UI web bundle publishing should be handled by a dedicated workflow',
  );
  assert.match(
    raw,
    /publish_ui_web:[\s\S]*?channel:\s*\$\{\{\s*inputs\.environment == 'production' && 'stable' \|\| 'preview'\s*\}\}/,
    'ui web bundle publishing should select stable vs preview through the shared channel mapping',
  );
  assert.match(
    raw,
    /publish_ui_web:[\s\S]*?source_ref:\s*\$\{\{\s*needs\.prepare_release_candidate\.outputs\.source_sha\s*\}\}/,
    'ui web bundle publishing should build from the exact prepared candidate',
  );
  assert.match(
    raw,
    /publish_ui_web:[\s\S]*?allow_stable:\s*\$\{\{\s*inputs\.environment == 'production'\s*\}\}/,
    'ui web bundle publishing should explicitly unlock stable publishing only for production releases',
  );

  const plan = parse(raw)?.jobs?.plan;
  assert.match(plan?.outputs?.publish_ui_web_needed, /inputs\.deploy_targets/);
  assert.match(plan?.outputs?.publish_ui_web_needed, /steps\.plan\.outputs\.changed_ui == 'true'/);
  assert.match(parse(raw)?.jobs?.publish_ui_web?.if, /needs\.plan\.outputs\.publish_ui_web_needed == 'true'/);
});

test('release workflows do not embed invalid JS escaping in node -p/-e snippets', async () => {
  const release = await loadWorkflow('release.yml');
  const promoteServer = await loadWorkflow('promote-server.yml');

  // These sequences produce broken JavaScript (backslashes are passed literally to Node).
  for (const raw of [release, promoteServer]) {
    assert.doesNotMatch(raw, /require\(\\"/, 'do not use require(\\") style escaping in workflows');
    assert.doesNotMatch(raw, /require\(\\"node:fs\\"/, 'do not escape quotes inside node -e single-quoted strings');
  }
});

test('final release workflows only consume already-materialized version bumps', async () => {
  const orchestrator = await loadWorkflow('release.yml');
  const workflow = parse(orchestrator);

  assert.equal(
    workflow?.on?.workflow_dispatch?.inputs?.bump,
    undefined,
    'manual final release dispatch must not advertise version mutations',
  );

  assert.doesNotMatch(orchestrator, /bump-versions-dev\.mjs/);
  assert.doesNotMatch(orchestrator, /BUMP_STACK:\s*\$\{\{ needs\.plan\.outputs\.bump_stack \}\}/);
  assert.doesNotMatch(orchestrator, /--bump-stack "\$BUMP_STACK"/);
  assert.doesNotMatch(orchestrator, /node scripts\/release\/bump-version\.mjs --component stack/, 'release.yml should delegate version bumps to the pipeline script');
  assert.doesNotMatch(orchestrator, /BUMP="\$\{\{ needs\.plan\.outputs\.bump_stack \}\}" node - <<'NODE'/);
});

test('publish-github-release delegates release creation + asset upload to the pipeline script', async () => {
  const raw = await loadWorkflow('publish-github-release.yml');
  assert.match(raw, /node scripts\/pipeline\/run\.mjs github-publish-release/);
  assert.doesNotMatch(raw, /gh release upload/, 'publish-github-release should not embed gh release upload logic');
  assert.doesNotMatch(raw, /gh api -X DELETE/, 'publish-github-release should not embed release asset pruning logic');
});

test('promote-ui native_submit uses the shared Expo submit script and reports preview credential gaps after preserving siblings', async () => {
  const promoteUi = await loadWorkflow('promote-ui.yml');
  assert.match(promoteUi, /uses:\s*\.\/\.github\/workflows\/build-ui-mobile-local\.yml/);
  assert.match(promoteUi, /action:\s*\$\{\{\s*\(inputs\.expo_action == 'native_submit' \|\| inputs\.expo_action == 'full'\) && 'build_and_submit' \|\| 'build_only'\s*\}\}/);

  const buildUiMobileLocal = await loadWorkflow('build-ui-mobile-local.yml');
  assert.match(buildUiMobileLocal, /node scripts\/pipeline\/run\.mjs ui-mobile-release/);
  assert.match(buildUiMobileLocal, /--action "\$\{\{\s*inputs\.action == 'build_and_submit' && 'native_submit' \|\| 'native'\s*\}\}"/);
  assert.doesNotMatch(buildUiMobileLocal, /node scripts\/pipeline\/run\.mjs expo-submit/);

  const run = await loadFile('scripts/pipeline/run.mjs');
  assert.match(run, /path\.join\(repoRoot,\s*'scripts',\s*'pipeline',\s*'expo',\s*'submit\.mjs'\)/);

  const script = await loadFile('scripts/pipeline/expo/submit.mjs');
  assert.match(script, /\['ios', 'android'\]/);
  assert.match(script, /for \(const platform of platforms\)/);
  assert.match(script, /allowsBestEffortSubmit\(environment\)/);
  assert.match(script, /::warning::Expo submit failed for/);
  assert.match(script, /process\.exitCode = 1/);
});

test('promote-ui full publication prepares OTA and publishes native and APK surfaces', async () => {
  const promoteUi = await loadWorkflow('promote-ui.yml');
  assert.match(promoteUi, /- full\b/);
  assert.match(promoteUi, /inputs\.expo_action == 'ota' \|\| inputs\.expo_action == 'full'/);
  assert.match(promoteUi, /inputs\.expo_action == 'native_submit' \|\| inputs\.expo_action == 'full'/);
  assert.match(promoteUi, /inputs\.expo_action == 'native' \|\| inputs\.expo_action == 'native_submit' \|\| inputs\.expo_action == 'full'/);
  assert.match(promoteUi, /\(inputs\.expo_action == 'native_submit' \|\| inputs\.expo_action == 'full'\) && 'build_and_submit'/);
});

test('promote-ui prepares OTA bytes without secrets and publishes the exact bound artifacts with trusted control', async () => {
  const raw = await loadWorkflow('promote-ui.yml');
  const workflow = parse(raw);
  const validate = workflow?.jobs?.validate_candidate;
  const promote = workflow?.jobs?.promote;
  const validateText = JSON.stringify(validate);
  const promoteText = JSON.stringify(promote);

  assert.ok(validate, 'promote-ui must validate the exact candidate in a separate job');
  assert.equal(validate.environment, undefined, 'candidate OTA preparation must not receive release secrets');
  assert.doesNotMatch(validateText, /EXPO_TOKEN|RELEASE_BOT_PRIVATE_KEY/);
  assert.match(validateText, /--phase prepare/);
  assert.match(validateText, /--platform android/);
  assert.match(validateText, /--platform ios/);
  assert.match(validateText, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);

  assert.equal(promote?.environment, 'release-shared');
  assert.match(promoteText, /actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093/);
  assert.match(promoteText, /--phase publish/);
  assert.match(promoteText, /--expected-source-sha/);
  assert.match(promoteText, /EXPO_TOKEN/);
  assert.doesNotMatch(promoteText, /ui-mobile-release/);
  for (const step of promote.steps ?? []) {
    assert.doesNotMatch(String(step?.run ?? ''), /\$\{\{\s*inputs\.expo_update_message\s*\}\}/);
  }

  const script = await loadFile('scripts/pipeline/expo/ota-update.mjs');
  assert.match(script, /eas-cli@\$\{easCliVersion\}/);
  assert.match(script, /resolveMobileAppEnvironmentConfig\(normalizedEnvironment\)\.updatesChannel/);
  assert.match(script, /--channel/);
  assert.match(script, /resolveExpoInteractivity/);
  assert.match(script, /--message/);
  assert.match(script, /--skip-bundler/);
  assert.match(script, /--input-dir/);
});

test('release workflow lets promote-ui derive exact-candidate Expo notes from the approved release ID', async () => {
  const raw = await loadWorkflow('release.yml');
  const workflow = parse(raw);
  assert.equal(workflow?.on?.workflow_dispatch?.inputs?.release_message, undefined, 'release.yml must not accept operator-authored release notes');
  assert.match(raw, /deploy_ui:[\s\S]*?uses:\s*\.\/\.github\/workflows\/promote-ui\.yml/);
  assert.equal(workflow.jobs.deploy_ui.with.run_tests, false, 'release admission owns source tests; UI promotion must not rerun them after artifact verification');
  assert.doesNotMatch(raw, /deploy_ui:[\s\S]*?expo_update_message:/);
});

test('local release planning resolves remote identities without changing local refs', async () => {
  const run = await loadFile('scripts/pipeline/run.mjs');

  assert.match(run, /resolveRemoteReleasePlanningRefs\(\{/);
  assert.doesNotMatch(run, /'--prune'/);
  assert.doesNotMatch(run, /refs\/tags\/[^'"]+:[^'"]+/);
});
