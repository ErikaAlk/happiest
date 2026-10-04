import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const installPs1 = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');

// The shape `happiest doctor repair --json` printed on a fresh Windows install of 0.1.0: no
// background service yet, inventory under `existingServices`.
const FRESH_INSTALL_DOCTOR_REPAIR = JSON.stringify({
  ok: true,
  executed: false,
  report: { findings: [] },
  schemaVersion: 2,
  defaultFollowingMatchesSelectedReleaseChannel: null,
  existingServices: [],
  actions: [],
  manualWarnings: [],
  daemonStatus: null,
  relays: [],
  daemonRunning: false,
});

// Loads the installer's own functions from its AST and replaces only the call into the installed
// CLI process, which answers with the inventory above.
const HARNESS = String.raw`
param([string] $InstallPs1, [string] $Noninteractive)
$ErrorActionPreference = 'Stop'
$ProductDisplayName = 'Happiest'
$Channel = 'stable'
$DaemonServiceStateHomeDir = 'unused'
# install.ps1 -WithDaemon
$WithDaemonExplicit = $true
$WithDaemonPreference = '1'
$names = @(
  'ConvertTo-InstallerBoolean',
  'Get-InstalledBackgroundServiceInventory',
  'Invoke-NativeCommandCapturingOutput',
  'Test-DoctorRepairPreflightLooksLikePlainDoctorReport',
  'Test-DoctorRepairPreflightJsonIsSupported',
  'Test-InstallerCommandLooksUnsupported',
  'Resolve-WithDaemonPreference',
  'Resolve-ExistingBackgroundServiceInstallStrategy',
  'Test-BackgroundServiceInventoryHasMatchingDefaultFollowing',
  'Test-BackgroundServiceInventoryHasDefaultFollowing',
  'Get-BackgroundServiceDefaultFollowingChannel'
)
$ast = [System.Management.Automation.Language.Parser]::ParseFile($InstallPs1, [ref]$null, [ref]$null)
$definitions = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $names -contains $node.Name }, $true)
foreach ($definition in $definitions) { . ([scriptblock]::Create($definition.Extent.Text)) }
function Invoke-InstallerCommandWithDaemonServiceContext {
  param([string] $CliPath, [string[]] $CommandArgs, [string] $HomeDir)
  $global:LASTEXITCODE = 0
  Write-Output $env:DOCTOR_REPAIR_JSON
}
$inventory = Get-InstalledBackgroundServiceInventory -CliPath 'happiest.exe'
$withDaemon = Resolve-WithDaemonPreference -Entries $inventory.Entries -DefaultFollowingMatchesSelectedReleaseChannel $inventory.DefaultFollowingMatchesSelectedReleaseChannel
$strategy = Resolve-ExistingBackgroundServiceInstallStrategy -Entries $inventory.Entries -DefaultFollowingMatchesSelectedReleaseChannel $inventory.DefaultFollowingMatchesSelectedReleaseChannel
[ordered]@{
  withDaemon = $withDaemon
  supported = $inventory.Supported
  entriesIsArray = $inventory.Entries -is [array]
  entriesCount = @($inventory.Entries).Count
  relaysIsArray = $inventory.Relays -is [array]
  strategy = $strategy
} | ConvertTo-Json -Compress
`;

for (const noninteractive of ['1', '0']) {
  test(`install.ps1 plans automatic startup for a fresh install with no background service (noninteractive=${noninteractive})`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'install-ps1-inventory-'));
    try {
      const harness = join(dir, 'harness.ps1');
      writeFileSync(harness, HARNESS);
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', harness, '-InstallPs1', installPs1, '-Noninteractive', noninteractive], {
        encoding: 'utf8',
        env: { ...process.env, DOCTOR_REPAIR_JSON: FRESH_INSTALL_DOCTOR_REPAIR },
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
        withDaemon: '1',
        supported: true,
        entriesIsArray: true,
        entriesCount: 0,
        relaysIsArray: true,
        strategy: '',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
