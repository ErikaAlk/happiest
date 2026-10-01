import { describe, expect, it, vi } from 'vitest';

const {
  handleServiceRepairCliCommandMock,
  runDaemonServiceCliCommandMock,
} = vi.hoisted(() => ({
  handleServiceRepairCliCommandMock: vi.fn(async () => undefined),
  runDaemonServiceCliCommandMock: vi.fn(async () => undefined),
}));

vi.mock('@/daemon/service/cli', () => ({
  runDaemonServiceCliCommand: runDaemonServiceCliCommandMock,
}));

vi.mock('./serviceRepair/handleServiceRepairCliCommand', () => ({
  handleServiceRepairCliCommand: handleServiceRepairCliCommandMock,
}));

import { handleServiceCliCommand } from './service';

describe('service command routing', () => {
  it('routes top-level service actions through the daemon service CLI', async () => {
    await handleServiceCliCommand({
      args: ['service', 'install', '--json'],
      rawArgv: ['node', 'happiest', 'service', 'install', '--json'],
      terminalRuntime: null,
    });

    expect(runDaemonServiceCliCommandMock).toHaveBeenCalledWith({
      argv: ['install', '--json'],
      commandPath: 'happiest service',
    });
  });

  it('routes service repair through the bounded repair command handler', async () => {
    await handleServiceCliCommand({
      args: ['service', 'repair', '--json'],
      rawArgv: ['node', 'happiest', 'service', 'repair', '--json'],
      terminalRuntime: null,
    });

    expect(handleServiceRepairCliCommandMock).toHaveBeenCalledWith({
      argv: ['repair', '--json'],
      commandPath: 'happiest service',
    });
    expect(runDaemonServiceCliCommandMock).not.toHaveBeenCalledWith({
      argv: ['repair', '--json'],
    });
  });
});
