import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

function extractInstallerFunction(raw, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`function ${escapedName}\\s*\\{[\\s\\S]*?\\n\\}(?=\\n\\nfunction )`));
  assert.ok(match, `expected ${name} to exist`);
  return match[0];
}

test('install.ps1 performs deterministic Windows lock hygiene before payload promotion', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const trimmed = raw.replace(/^\uFEFF?/, '').trimStart();

  assert.match(
    trimmed,
    /Invoke-InstallerPreInstallLockHygiene[\s\S]*\$promotionResult\s*=\s*Invoke-InstallerPayloadPromotionWithTimeout/i,
    'expected lock hygiene to run before payload promotion',
  );
  assert.ok(
    trimmed.includes('@("service", "stop", "--json")'),
    'expected lock hygiene to stop managed background services before payload promotion',
  );
  assert.ok(
    trimmed.includes('@("daemon", "stop", "--all", "--kill-sessions", "--json")'),
    'expected lock hygiene to stop managed daemon-owned sessions before payload promotion',
  );
  assert.match(
    trimmed,
    /\$productProcessNames\s*=\s*@\(\s*\$CliCommandName,\s*"\$CliCommandName-preview",\s*"\$CliCommandName-dev"\s*\)/i,
    'expected lock hygiene to target known Happiest process names only',
  );
  assert.match(
    trimmed,
    /Stop-Process\s+-Id\s+\$process\.ProcessId\s+-Force\s+-ErrorAction\s+SilentlyContinue/i,
    'expected lock hygiene to force-stop scoped holder processes',
  );
  assert.match(
    trimmed,
    /Wait-InstallerLockHygieneProcessesToExit/i,
    'expected lock hygiene to wait for holders to exit before promotion proceeds',
  );
});

test('install.ps1 cleans stale version backup directories before payload promotion', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const trimmed = raw.replace(/^\uFEFF?/, '').trimStart();

  assert.match(
    trimmed,
    /Remove-StaleInstallerVersionBackups/i,
    'expected lock hygiene to include stale backup cleanup',
  );
  assert.match(
    trimmed,
    /Get-ChildItem\s+-Path\s+\$versionsDir\s+-Directory[\s\S]*\.bak-/i,
    'expected stale backup cleanup to target versioned .bak-* directories',
  );
});

test('install.ps1 returns lock hygiene match needles as a string array', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const functionMatch = raw.match(/function Get-InstallerLockHygieneMatchNeedles\s*\{[\s\S]*?\n\}/);

  assert.ok(functionMatch, 'expected Get-InstallerLockHygieneMatchNeedles to exist');
  assert.match(
    functionMatch[0],
    /return\s+\$needles\.ToArray\(\)/i,
    'expected PowerShell to return a string[] instead of wrapping the generic list as one object',
  );
  assert.doesNotMatch(
    functionMatch[0],
    /return\s+@\(\$needles\)/i,
    'return @($needles) wraps the generic list and fails the typed -MatchNeedles binding on Windows',
  );
});

test('install.ps1 returns scoped process matches as an object array', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const functionMatch = raw.match(/function Get-InstallerScopedProductProcesses\s*\{[\s\S]*?\n\}/);

  assert.ok(functionMatch, 'expected Get-InstallerScopedProductProcesses to exist');
  assert.match(
    functionMatch[0],
    /return\s+\$matched\.ToArray\(\)/i,
    'expected PowerShell to return matched processes as an object[] instead of wrapping the generic list',
  );
  assert.doesNotMatch(
    functionMatch[0],
    /return\s+@\(\$matched\)/i,
    'return @($matched) wraps the generic list and throws on Windows when lock hygiene returns',
  );
});

test('install.ps1 matches scoped process paths by path boundary, not sibling-prefix substring', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const scopeHelper = extractInstallerFunction(raw, 'Test-InstallerLockHygienePathInScope');
  const commandLineParser = extractInstallerFunction(raw, 'Resolve-InstallerLockHygieneExecutablePathFromCommandLine');
  const processHelper = extractInstallerFunction(raw, 'Get-InstallerScopedProductProcesses');

  assert.match(
    scopeHelper,
    /-or\s+\$candidate\s+-eq\s+\$scope/i,
    'scoped matching should include exact normalized path equality',
  );
  assert.match(
    scopeHelper,
    /\$scopePrefix\s*=\s*"\$scope\/"[\s\S]*\.StartsWith\(\$scopePrefix\)/i,
    'scoped matching should require a path separator after the install root so .happiest2 is not in scope for .happiest',
  );
  assert.match(
    commandLineParser,
    /StartsWith\(["']"["']\)[\s\S]*IndexOf\(["']"["'],\s*1\)/i,
    'process command lines should parse a quoted executable path before scope matching',
  );
  assert.match(
    processHelper,
    /Resolve-InstallerLockHygieneExecutablePathFromCommandLine\s+-CommandLine\s+\(\[string\]\$process\.CommandLine\)/i,
    'process matching should parse the executable path from CommandLine when available',
  );
  assert.match(
    processHelper,
    /Test-InstallerLockHygienePathInScope\s+-CandidatePath\s+\$executablePath\s+-MatchNeedles\s+\$MatchNeedles/i,
    'process matching should scope the reported executable path with the boundary-aware helper',
  );
  assert.match(
    processHelper,
    /Test-InstallerLockHygienePathInScope\s+-CandidatePath\s+\$commandExecutablePath\s+-MatchNeedles\s+\$MatchNeedles/i,
    'process matching should scope the parsed command executable with the boundary-aware helper',
  );
  assert.doesNotMatch(
    processHelper,
    /\.Contains\(\$needle\)/i,
    'process matching must not use substring scope checks because .happiest2 contains .happiest',
  );
});

test('install.ps1 matches scoped service paths by path boundary, not sibling-prefix substring', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const labelHelper = extractInstallerFunction(raw, 'Test-InstallerLockHygieneDaemonServiceLabelInScope');
  const serviceHelper = extractInstallerFunction(raw, 'Get-InstallerScopedProductServices');
  const scheduledTaskHelper = extractInstallerFunction(raw, 'Get-InstallerScopedProductScheduledTasks');
  const preInstall = extractInstallerFunction(raw, 'Invoke-InstallerPreInstallLockHygiene');

  assert.match(
    raw,
    /\$DaemonServiceUnitPrefix\s*=\s*"happiest-daemon"/,
    'expected the daemon service label prefix to be the Happiest identity',
  );
  assert.match(
    labelHelper,
    /\$leafLabel\s+-eq\s+\$DaemonServiceUnitPrefix[\s\S]*\.StartsWith\("\$DaemonServiceUnitPrefix\."\)/i,
    'native service/task verification should only consider CLI daemon labels, not sibling services such as happiest-server',
  );
  assert.match(serviceHelper, /Win32_Service/i, 'service detection should use native Windows service inventory');
  assert.match(
    serviceHelper,
    /Test-InstallerLockHygieneDaemonServiceLabelInScope\s+-Label\s+\$service\.Name/i,
    'service matching should require a daemon-owned service name before checking scoped paths',
  );
  assert.match(
    serviceHelper,
    /running[\s\S]*start pending[\s\S]*stop pending/i,
    'service matching should only treat active or transitioning services as lock holders',
  );
  assert.match(
    serviceHelper,
    /\$servicePathText\s*=\s*\[string\]\$service\.PathName[\s\S]*Resolve-InstallerLockHygieneExecutablePathFromCommandLine\s+-CommandLine\s+\$servicePathText/i,
    'service matching should parse the executable path from service PathName when available',
  );
  assert.match(
    serviceHelper,
    /Test-InstallerLockHygienePathInScope\s+-CandidatePath\s+\$serviceExecutablePath\s+-MatchNeedles\s+\$MatchNeedles/i,
    'service matching should scope the parsed service executable with the boundary-aware helper',
  );
  assert.match(
    serviceHelper,
    /Test-InstallerLockHygieneTextContainsScopedPath\s+-Text\s+\$servicePathText\s+-MatchNeedles\s+\$MatchNeedles/i,
    'service matching should scope the full service PathName text so hosted PowerShell/node services remain visible',
  );
  assert.doesNotMatch(
    serviceHelper,
    /\.Contains\(\$needle\)/i,
    'service matching must not use substring scope checks because .happiest2 contains .happiest',
  );
  assert.match(
    raw,
    /\$WindowsTaskFolder\s*=\s*"Happiest"/,
    'expected the Windows task folder to be the Happiest identity',
  );
  assert.match(
    scheduledTaskHelper,
    /Get-ScheduledTask[\s\S]*-TaskPath\s+"\\\$WindowsTaskFolder\\"/i,
    'scheduled task detection should inspect the Happiest task folder used by the Windows background-service backend',
  );
  assert.match(
    scheduledTaskHelper,
    /Test-InstallerLockHygieneDaemonServiceLabelInScope\s+-Label\s+\$taskLabel/i,
    'scheduled task matching should require a daemon-owned task label before checking scoped paths',
  );
  assert.match(
    scheduledTaskHelper,
    /Test-InstallerLockHygieneTextContainsScopedPath\s+-Text\s+\$actionText\s+-MatchNeedles\s+\$MatchNeedles/i,
    'scheduled task action arguments should be scoped with boundary-aware text matching',
  );
  assert.doesNotMatch(
    scheduledTaskHelper,
    /\.Contains\(\$needle\)/i,
    'scheduled task matching must not use substring scope checks because .happiest2 contains .happiest',
  );
  assert.match(
    preInstall,
    /if\s*\(\$existingInvoker\)\s*\{[\s\S]*Invoke-InstallerCommandWithDaemonServiceContextCapturingOutputWithTimeout/i,
    'old-CLI stop commands must still run whenever an existing invoker is present because not all daemon shapes are visible to native process/service matching',
  );
  assert.doesNotMatch(preInstall, /Test-InstallerPreInstallOldCliStopNeeded|shouldRunOldCliStopCommands/i);
  assert.match(
    preInstall,
    /Get-InstallerScopedProductServices\s+-MatchNeedles\s+\$matchNeedles/i,
    'pre-install hygiene should still verify scoped running services with boundary-aware matching after old-CLI cleanup',
  );
  assert.match(
    preInstall,
    /Get-InstallerScopedProductScheduledTasks\s+-MatchNeedles\s+\$matchNeedles/i,
    'pre-install hygiene should verify active scheduled-task backed services with boundary-aware matching after old-CLI cleanup',
  );
});

test('install.ps1 bounds pre-install service stop commands so stale CLIs cannot hang upgrades', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const timeoutResolver = raw.match(/function Resolve-InstallerPreInstallCommandTimeoutMs\s*\{[\s\S]*?\n\}(?=\n\nfunction )/);
  const timeoutHelper = raw.match(
    /function Invoke-InstallerCommandWithDaemonServiceContextCapturingOutputWithTimeout\s*\{[\s\S]*?\n\}(?=\n\nfunction )/,
  );
  const preInstall = raw.match(/function Invoke-InstallerPreInstallLockHygiene\s*\{[\s\S]*?\n\}(?=\n\nfunction )/);

  assert.ok(timeoutResolver, 'expected a pre-install command timeout resolver');
  assert.ok(timeoutHelper, 'expected a bounded daemon-service command helper');
  assert.ok(preInstall, 'expected Invoke-InstallerPreInstallLockHygiene to exist');
  assert.match(timeoutHelper[0], /\.WaitForExit\(\$timeoutMs\)/);
  assert.match(timeoutHelper[0], /Stop-InstallerProcessTree\s+-Process\s+\$process/i);
  assert.match(timeoutHelper[0], /ExitCode\s*=\s*124/);
  assert.match(
    preInstall[0],
    /Invoke-InstallerCommandWithDaemonServiceContextCapturingOutputWithTimeout[\s\S]*-TimeoutMs\s+\$preInstallCommandTimeoutMs/i,
    'expected pre-install service and daemon stop commands to use the bounded helper',
  );
  assert.doesNotMatch(
    preInstall[0],
    /Invoke-NativeCommandCapturingOutput\s*\{[\s\S]*?Invoke-InstallerCommandWithDaemonServiceContext/i,
    'pre-install lock hygiene must not invoke existing CLIs through an unbounded native capture',
  );
});

test('install.ps1 uses a PowerShell 5.1-compatible process-tree cleanup helper for timeout paths', async () => {
  const path = join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1');
  const raw = await readFile(path, 'utf8');
  const processTreeHelper = raw.match(/function Stop-InstallerProcessTree\s*\{[\s\S]*?\n\}(?=\n\nfunction )/);
  const preInstallTimeoutHelper = raw.match(
    /function Invoke-InstallerCommandWithDaemonServiceContextCapturingOutputWithTimeout\s*\{[\s\S]*?\n\}(?=\n\nfunction )/,
  );
  const payloadPromotionTimeoutHelper = raw.match(
    /function Invoke-InstallerPayloadPromotionWithTimeout\s*\{[\s\S]*?\n\}(?=\n\nfunction )/,
  );

  assert.ok(processTreeHelper, 'expected a shared timeout process-tree cleanup helper');
  assert.match(
    processTreeHelper[0],
    /\.Kill\(\$true\)/i,
    'expected the helper to try the modern .NET process-tree kill first',
  );
  assert.match(
    processTreeHelper[0],
    /taskkill(?:\.exe)?[\s\S]*\/T[\s\S]*\/F[\s\S]*\/PID|Win32_Process[\s\S]*ParentProcessId/i,
    'expected the helper to include a Windows PowerShell 5.1-compatible descendant cleanup fallback',
  );

  assert.ok(preInstallTimeoutHelper, 'expected a bounded pre-install command helper');
  assert.ok(payloadPromotionTimeoutHelper, 'expected a bounded payload promotion helper');
  for (const [label, helper] of [
    ['pre-install', preInstallTimeoutHelper[0]],
    ['payload promotion', payloadPromotionTimeoutHelper[0]],
  ]) {
    assert.match(
      helper,
      /Stop-InstallerProcessTree\s+-Process\s+\$process/i,
      `expected ${label} timeout cleanup to use the shared process-tree helper`,
    );
    assert.doesNotMatch(
      helper,
      /catch\s*\{[\s\S]*?Stop-Process\s+-Id\s+\$process\.Id\s+-Force/i,
      `expected ${label} timeout cleanup not to fall back to direct-PID-only Stop-Process`,
    );
  }
});
