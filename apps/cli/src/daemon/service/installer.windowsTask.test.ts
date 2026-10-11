// 真实全局计划任务命名空间与临时主目录会互相干扰，因此沿用服务测试的
// spawnSync 系统边界替身，隔离 Windows 计划任务的发现、状态读取和命令执行。
// 包装脚本、服务发现、冲突检测、安装器、计划生成与执行器全部使用真实实现。
import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildReadWindowsScheduledTaskStatusPowerShellCommand,
  buildWindowsScheduledTaskPowerShellAction,
  splitQualifiedWindowsScheduledTaskName,
  type WindowsScheduledTaskStatusSnapshot,
} from '@happier-dev/cli-common/service';

import { withTempDir } from '@/testkit/fs/tempDir';
import { installDaemonService, previewDaemonServiceInstall } from './installer';
import { resolveWindowsDaemonTaskName } from './plan';
import { discoverInstalledDaemonServiceEntries } from './discoverInstalledDaemonServiceEntries';

const { spawnSyncMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn<(
    command: string,
    args: readonly string[],
    options?: SpawnSyncOptions,
  ) => SpawnSyncReturns<string | Buffer>>(),
}));

vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  spawnSync: spawnSyncMock,
}));

describe.skipIf(process.platform !== 'win32')('installDaemonService Windows task registration', { concurrent: false }, () => {
  afterEach(() => spawnSyncMock.mockReset());
  for (const state of ['missing', 'matching', 'old-target'] as const) {
    it(`handles an existing wrapper with a ${state} scheduled task`, async () => {
      await withTempDir('happiest-计划任务 install-', async (homeDir) => {
        const instanceId = `test_${randomUUID()}`;
        const options = {
          platform: 'win32', mode: 'user', channel: 'stable', targetMode: 'pinned',
          instanceId, activeServerId: instanceId, userHomeDir: homeDir, happierHomeDir: homeDir,
          nodePath: process.execPath, entryPath: 'C:\\current\\index.mjs',
          autostart: 'on-demand', runCommands: true, commandFailureMode: 'strict',
        } as const;
        const taskName = resolveWindowsDaemonTaskName(options);
        let taskAction: string | null = null;
        const creates: string[][] = [];
        const runs: string[][] = [];
        let plannedPowerShellCommands: readonly string[] = [];
        const statusCommand = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); '
          + buildReadWindowsScheduledTaskStatusPowerShellCommand(splitQualifiedWindowsScheduledTaskName(taskName));
        spawnSyncMock.mockImplementation((command, args, spawnOptions) => {
          let text = '';
          if (command === 'schtasks' && args.join(' ') === '/Query /FO CSV /NH') {
            // 测试命名空间只有当前主目录；真实文件发现仍会读取本用例的包装脚本。
            text = '';
          } else if (command === 'powershell.exe' && args.at(-1) === statusCommand) {
            text = JSON.stringify({
              exists: taskAction !== null, enabled: taskAction !== null, active: false,
              stateLabel: taskAction === null ? 'not_installed' : 'Ready',
              stateValue: taskAction === null ? null : 3,
              lastRunTime: '', lastTaskResult: null, taskToRun: taskAction ?? '',
            } satisfies WindowsScheduledTaskStatusSnapshot);
          } else if (command === 'schtasks' && args[0] === '/Create') {
            expect(args[args.indexOf('/TN') + 1]).toBe(taskName);
            creates.push([...args]);
            taskAction = args[args.indexOf('/TR') + 1]!;
          } else if (command === 'schtasks' && args[0] === '/Run') {
            expect(args).toEqual(['/Run', '/TN', taskName]);
            runs.push([...args]);
          } else if (command !== 'powershell.exe' || !plannedPowerShellCommands.includes(args.at(-1) ?? '')) {
            throw new Error(`测试收到非预期系统命令：${command} ${args.join(' ')}`);
          }
          const stdout = spawnOptions?.encoding ? text : Buffer.from(text);
          const stderr = spawnOptions?.encoding ? '' : Buffer.from('');
          return { pid: 0, status: 0, signal: null, output: [null, stdout, stderr], stdout, stderr };
        });
        const { plan } = await previewDaemonServiceInstall(options);
        plannedPowerShellCommands = plan.commands
          .filter((command) => command.cmd === 'powershell.exe')
          .map((command) => command.args.at(-1)!);
        const wrapper = plan.files[0]!;
        mkdirSync(dirname(wrapper.path), { recursive: true });
        writeFileSync(wrapper.path, wrapper.content, 'utf8');
        if (state !== 'missing') {
          taskAction = buildWindowsScheduledTaskPowerShellAction({
            definitionPath: state === 'matching' ? wrapper.path : `${homeDir}\\old.ps1`,
          });
        }
        expect(await discoverInstalledDaemonServiceEntries({ ...options, serversById: {} })).toEqual([
          expect.objectContaining({
            serverId: instanceId, happierHomeDir: homeDir, path: wrapper.path,
            label: taskName, targetMode: 'pinned', releaseChannel: 'stable',
          }),
        ]);
        expect((await previewDaemonServiceInstall(options)).exactTargetMatchesExpectedDefinition).toBe(state === 'matching');
        await installDaemonService(options);
        expect(creates).toHaveLength(state === 'matching' ? 0 : 1);
        expect(runs).toHaveLength(state === 'matching' ? 0 : 1);
        if (state !== 'matching') {
          expect(creates[0]).toEqual(expect.arrayContaining([
            '/Create', '/F', '/SC', 'ONCE', '/TN', taskName, '/TR',
            buildWindowsScheduledTaskPowerShellAction({ definitionPath: wrapper.path }),
          ]));
        }
        expect(taskAction).toBe(buildWindowsScheduledTaskPowerShellAction({
          definitionPath: wrapper.path,
        }));
        const installed = await previewDaemonServiceInstall(options);
        expect(installed.exactTargetExists).toBe(true);
        expect(installed.exactTargetMatchesExpectedDefinition).toBe(true);
        await installDaemonService(options);
        expect(creates).toHaveLength(state === 'matching' ? 0 : 1);
        expect(runs).toHaveLength(state === 'matching' ? 0 : 1);
      });
    });
  }
});
