import { describe, expect, it } from 'vitest';

import { resolveCodexStartingMode } from './resolveCodexStartingMode';

describe('resolveCodexStartingMode', () => {
  it('respects an explicit startingMode override', () => {
    expect(
      resolveCodexStartingMode({
        explicitStartingMode: 'remote',
        startedBy: 'cli',
        hasTtyForLocal: true,
        localControlEnabled: true,
      }),
    ).toBe('remote');

    expect(
      resolveCodexStartingMode({
        explicitStartingMode: 'local',
        startedBy: 'cli',
        hasTtyForLocal: true,
        localControlEnabled: false,
      }),
    ).toBe('local');
  });

  it('respects an explicit local startingMode override even without a TTY', () => {
    expect(
      resolveCodexStartingMode({
        explicitStartingMode: 'local',
        startedBy: 'cli',
        hasTtyForLocal: false,
        localControlEnabled: true,
      }),
    ).toBe('local');
  });

  it('forces remote when started by daemon outside a Windows window even with an explicit local override', () => {
    expect(
      resolveCodexStartingMode({
        explicitStartingMode: 'local',
        startedBy: 'daemon',
        terminalMode: 'plain',
        hasTtyForLocal: true,
        localControlEnabled: true,
      }),
    ).toBe('remote');
  });

  it.each(['windows_console', 'windows_terminal'])('honors the daemon starting a %s window in local mode', (terminalMode) => {
    expect(
      resolveCodexStartingMode({
        explicitStartingMode: 'local',
        startedBy: 'daemon',
        terminalMode,
        hasTtyForLocal: true,
        localControlEnabled: true,
      }),
    ).toBe('local');
  });

  it('defaults to remote when started by daemon', () => {
    expect(
      resolveCodexStartingMode({
        explicitStartingMode: undefined,
        startedBy: 'daemon',
        hasTtyForLocal: true,
        localControlEnabled: true,
      }),
    ).toBe('remote');
  });

  it('defaults to local when local control is enabled and a TTY is available', () => {
    expect(
      resolveCodexStartingMode({
        explicitStartingMode: undefined,
        startedBy: 'cli',
        hasTtyForLocal: true,
        localControlEnabled: true,
      }),
    ).toBe('local');
  });

  it('defaults to remote when local control is disabled or a TTY is unavailable', () => {
    expect(
      resolveCodexStartingMode({
        explicitStartingMode: undefined,
        startedBy: 'cli',
        hasTtyForLocal: true,
        localControlEnabled: false,
      }),
    ).toBe('remote');

    expect(
      resolveCodexStartingMode({
        explicitStartingMode: undefined,
        startedBy: 'cli',
        hasTtyForLocal: false,
        localControlEnabled: true,
      }),
    ).toBe('remote');
  });
});
