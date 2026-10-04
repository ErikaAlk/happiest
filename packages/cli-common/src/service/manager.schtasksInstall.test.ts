import { describe, expect, it } from 'vitest';

import { planServiceAction } from './manager';

describe('planServiceAction (schtasks install)', () => {
  it('creates Windows user tasks with a hidden non-interactive PowerShell action', () => {
    const plan = planServiceAction({
      backend: 'schtasks-user',
      action: 'install',
      label: 'happier-daemon.default',
      taskName: 'Happier\\happier-daemon.default',
      definitionPath: 'C:\\Users\\test\\.happier\\services\\happier-daemon.default.ps1',
      definitionContents: '$ErrorActionPreference = "Stop"',
      persistent: true,
    });

    const create = plan.commands.find((command) =>
      command.cmd === 'schtasks' && command.args.includes('/Create'));
    // stop-if-running, /Create, apply service policy (restart + long-running
    // hardening, which schtasks cannot express), /Run.
    expect(plan.commands.map((command) => command.cmd)).toEqual(['powershell.exe', 'schtasks', 'powershell.exe', 'schtasks']);
    expect(plan.commands[0]?.args).toEqual(expect.arrayContaining([
      '-NoProfile',
      '-NonInteractive',
      '-Command',
    ]));
    expect(plan.commands[0]?.args.at(-1)).toContain('Stop-ScheduledTask');
    expect(create).toBeDefined();
    expect(create?.args).toContain('/SC');
    expect(create?.args).toContain('ONLOGON');
    expect(create?.args).not.toContain('/IT');
    expect(create?.args).toContain('/TR');
    expect(create?.args[create.args.indexOf('/TR') + 1]).toBe('powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\\Users\\test\\.happier\\services\\happier-daemon.default.ps1"');
    // The logon trigger stays as schtasks created it.
    expect(String(plan.commands[2]?.args.at(-1) ?? '')).not.toContain('-Trigger');
  });

  /**
   * `persistent: false` means "registered, startable, but nothing starts it for me". schtasks has
   * no manual-only schedule, so the trigger has to be one that can never come due — and that must
   * be stated in the definition, not inferred from the clock at install time.
   */
  it('registers a non-persistent task with a trigger that can never come due', () => {
    const plan = planServiceAction({
      backend: 'schtasks-user',
      action: 'install',
      label: 'happier-daemon.default',
      taskName: 'Happier\\happier-daemon.default',
      definitionPath: 'C:\\Users\\test\\.happier\\services\\happier-daemon.default.ps1',
      definitionContents: '$ErrorActionPreference = "Stop"',
      persistent: false,
    });
    const create = plan.commands.find((command) =>
      command.cmd === 'schtasks' && command.args.includes('/Create'));
    const args = create?.args ?? [];

    expect(args).toContain('ONCE');
    expect(args).not.toContain('ONLOGON');
    expect(args).not.toContain('ONSTART');
    // schtasks reads /SD in the host's regional date format (yyyy/mm/dd on a Chinese Windows,
    // MM/DD/YYYY or DD/MM/YYYY elsewhere), so no single /SD string is valid everywhere.
    expect(args).not.toContain('/SD');
    expect(args[args.indexOf('/ST') + 1]).toBe('00:00');

    // The policy step pins the start boundary in the past as a DateTime, which no regional format
    // can misread, and Task Scheduler may not catch it up: `-StartWhenAvailable` runs a *missed*
    // scheduled start as soon as possible, which is exactly what a past start boundary is.
    const settings = plan.commands.find((entry) =>
      entry.cmd === 'powershell.exe'
      && String(entry.args.at(-1) ?? '').includes('New-ScheduledTaskSettingsSet'));
    const policy = String(settings?.args.at(-1) ?? '');
    expect(policy).toContain('New-ScheduledTaskTrigger -Once -At ([datetime]::new(2000, 1, 1))');
    expect(policy).toContain('-Trigger $trigger');
    expect(policy).not.toContain('-StartWhenAvailable');
    // The task is still started now, and still hardened for a long-running process.
    expect(plan.commands.some((entry) => entry.cmd === 'schtasks' && entry.args.includes('/Run'))).toBe(true);
    expect(String(settings?.args.at(-1) ?? '')).toContain('-ExecutionTimeLimit');
  });
});
