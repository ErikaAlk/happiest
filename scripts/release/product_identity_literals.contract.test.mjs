import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import { getFirstPartyComponentCatalogEntry } from '@happier-dev/cli-common/firstPartyRuntime';
import {
  BUG_REPORT_DEFAULT_ISSUE_OWNER,
  BUG_REPORT_DEFAULT_ISSUE_REPO,
  DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME,
} from '@happier-dev/protocol';
import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

// Files that cannot import packages/release-runtime/src/productIdentity.ts carry its values as
// literals. Each test below compares one family of them against the identity module, so changing
// an identity value fails here until every copy follows.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), 'utf8');
const releasesBaseUrl = `https://github.com/${productIdentity.githubRepo}/releases/download`;
// Installers also download minisign from its own releases when it is missing.
const thirdPartyRepos = new Set(['jedisct1/minisign']);

function assertContainsLine(source, line, file) {
  assert.ok(source.split(/\r?\n/u).some((candidate) => candidate.trim() === line), `${file} must contain: ${line}`);
}

function assertGitHubLinksUseProductRepo(source, file) {
  const repos = [...source.matchAll(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/gu)]
    .map((match) => match[1])
    .filter((repo) => !thirdPartyRepos.has(repo));
  assert.ok(repos.length > 0, `${file} links to the product repository`);
  for (const repo of repos) {
    assert.equal(repo, productIdentity.githubRepo, `${file} links to ${repo}`);
  }
}

test('installer scripts declare the product identity and download from the product releases', () => {
  const { productName, commandName, githubRepo, homeDirName, windowsTaskFolder, daemonServiceUnitPrefix } = productIdentity;

  const installSh = read('scripts/release/installers/install.sh');
  assertContainsLine(installSh, `PRODUCT_DISPLAY_NAME="${productName}"`, 'install.sh');
  assertContainsLine(installSh, `CLI_COMMAND_NAME="${commandName}"`, 'install.sh');
  assertContainsLine(installSh, `DEFAULT_GITHUB_REPO="${githubRepo}"`, 'install.sh');
  assertContainsLine(installSh, `DEFAULT_INSTALL_DIR="$HOME/${homeDirName}"`, 'install.sh');
  assertGitHubLinksUseProductRepo(installSh, 'install.sh');

  const installPs1 = read('scripts/release/installers/install.ps1');
  assertContainsLine(installPs1, `$ProductDisplayName = "${productName}"`, 'install.ps1');
  assertContainsLine(installPs1, `$CliCommandName = "${commandName}"`, 'install.ps1');
  assertContainsLine(installPs1, `$DefaultGitHubRepo = "${githubRepo}"`, 'install.ps1');
  assertContainsLine(installPs1, `$DefaultInstallDirName = "${homeDirName}"`, 'install.ps1');
  assertContainsLine(installPs1, `$WindowsTaskFolder = "${windowsTaskFolder}"`, 'install.ps1');
  assertContainsLine(installPs1, `$DaemonServiceUnitPrefix = "${daemonServiceUnitPrefix}"`, 'install.ps1');

  assertGitHubLinksUseProductRepo(read('scripts/release/installers/install-server.sh'), 'install-server.sh');
});

test('desktop channel configs install under the product name and identifier and update from the product releases', () => {
  const { productName, desktopAppIdentifier } = productIdentity;

  for (const [configName, name, identifier, updateTag] of [
    ['tauri.conf.json', productName, desktopAppIdentifier, 'ui-desktop-stable'],
    ['tauri.preview.conf.json', `${productName} (preview)`, `${desktopAppIdentifier}.preview`, 'ui-desktop-preview'],
    ['tauri.publicdev.conf.json', `${productName} (dev)`, `${desktopAppIdentifier}.publicdev`, 'ui-desktop-dev'],
  ]) {
    const config = JSON.parse(read(`apps/ui/src-tauri/${configName}`));
    assert.equal(config.productName, name, configName);
    assert.equal(config.identifier, identifier, configName);
    assert.deepEqual(config.app?.windows?.map((window) => window.title), [name], configName);
    assert.deepEqual(config.plugins?.updater?.endpoints, [`${releasesBaseUrl}/${updateTag}/latest.json`], configName);
  }
});

test('desktop Rust sources use the product name and home directory', () => {
  const { productName, homeDirName } = productIdentity;

  assertContainsLine(read('apps/ui/src-tauri/src/system_tasks/mod.rs'), `const HOME_DIR_NAME: &str = "${homeDirName}";`, 'system_tasks/mod.rs');
  assertContainsLine(read('apps/ui/src-tauri/src/tray.rs'), `const TRAY_TOOLTIP: &str = "${productName}";`, 'tray.rs');

  const sourceDir = join(repoRoot, 'apps', 'ui', 'src-tauri', 'src');
  const sources = readdirSync(sourceDir, { recursive: true })
    .filter((file) => String(file).endsWith('.rs'))
    .map((file) => [String(file), readFileSync(join(sourceDir, String(file)), 'utf8')]);
  const allSources = sources.map(([, source]) => source).join('\n');
  for (const literal of [`"Open ${productName}"`, `"Quit ${productName}"`, `"${productName} Pet Overlay"`]) {
    assert.ok(allSources.includes(literal), `the desktop Rust sources must contain ${literal}`);
  }
  for (const [file, source] of sources) {
    assert.doesNotMatch(source, /"[^"\n]*\bHappier\b[^"\n]*"/u, `${file} names upstream Happier in a string`);
    assert.doesNotMatch(source, /"[^"\n]*\.happier\b[^"\n]*"/u, `${file} uses upstream Happier's home directory`);
  }
});

test('Dockerfiles fetch the product release artifacts', () => {
  const { commandName } = productIdentity;
  const serverProduct = getFirstPartyComponentCatalogEntry('happier-server').releaseProductName;
  const cliProduct = getFirstPartyComponentCatalogEntry('happier-cli').releaseProductName;

  const dockerfile = read('Dockerfile');
  assertContainsLine(dockerfile, `ARG HAPPIER_RELEASE_BASE_URL="${releasesBaseUrl}"`, 'Dockerfile');
  assertContainsLine(dockerfile, `--product ${serverProduct} \\`, 'Dockerfile');
  assertContainsLine(dockerfile, `CMD ["run-server", "/opt/happier/server/${serverProduct}"]`, 'Dockerfile');

  const devBox = read('docker/dev-box/Dockerfile');
  assertContainsLine(devBox, `ARG HAPPIER_RELEASE_BASE_URL="${releasesBaseUrl}"`, 'docker/dev-box/Dockerfile');
  assertContainsLine(devBox, `--product ${cliProduct} \\`, 'docker/dev-box/Dockerfile');
  assertContainsLine(devBox, `RUN chmod +x /opt/happier/cli/${commandName} \\`, 'docker/dev-box/Dockerfile');
  assertContainsLine(devBox, `&& ln -sf /opt/happier/cli/${commandName} /usr/local/bin/${commandName}`, 'docker/dev-box/Dockerfile');
});

test('the desktop workflow builds against the default server and titles releases with the product name', () => {
  const { productName, defaultServerUrl } = productIdentity;
  const source = read('.github/workflows/build-tauri.yml');
  const workflow = YAML.parse(source);

  const buildEnv = workflow.jobs.build.env;
  for (const key of ['EXPO_PUBLIC_HAPPIER_SERVER_URL', 'EXPO_PUBLIC_HAPPY_SERVER_URL', 'EXPO_PUBLIC_SERVER_URL']) {
    assert.equal(buildEnv[key], defaultServerUrl, key);
  }

  const titles = Object.values(workflow.jobs)
    .map((job) => job.with?.title)
    .filter((title) => typeof title === 'string');
  assert.ok(titles.length > 0);
  for (const title of titles) {
    assert.ok(title.startsWith(`${productName} UI Desktop`), title);
  }
  assert.ok(source.includes(`--title "${productName} UI Desktop Stable"`));
});

test('GitHub issue template links point to the product repository', () => {
  const config = YAML.parse(read('.github/ISSUE_TEMPLATE/config.yml'));
  assertGitHubLinksUseProductRepo(config.contact_links.map((link) => link.url).join('\n'), 'ISSUE_TEMPLATE/config.yml');
});

test('protocol constants built before release-runtime match the product identity', () => {
  assert.equal(`${BUG_REPORT_DEFAULT_ISSUE_OWNER}/${BUG_REPORT_DEFAULT_ISSUE_REPO}`, productIdentity.githubRepo);
  // Windows Terminal groups sessions into one named window; upstream Happier uses `happier`, so the
  // two products would open their sessions as tabs of the same window.
  assert.equal(DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME, productIdentity.commandName);
});
