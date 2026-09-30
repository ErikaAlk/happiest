import { describe, expect, it } from 'vitest';
import { classifyHappyProcess } from './doctor';
import { projectPath } from '@/projectPath';

describe('classifyHappyProcess', () => {
  it('should ignore unrelated processes with "happy" in the name', () => {
    const res = classifyHappyProcess({ pid: 123, name: 'happy-hour', cmd: 'happy-hour --serve' });
    expect(res).toBeNull();
  });

  it('should detect a daemon process started from dist', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: `/usr/bin/node "${projectPath()}/dist/index.mjs" daemon start-sync`,
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('daemon');
  });

  it('should detect a daemon-spawned session process', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: `/usr/bin/node "${projectPath()}/dist/index.mjs" --started-by daemon`,
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('daemon-spawned-session');
  });

  it('should detect a daemon-spawned session process from happiest-runtime when ps-list reports MainThread', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'MainThread',
      cmd: '/usr/bin/node /repo/cli-preview/versions/0.2.4/happiest-runtime/index.mjs codex --happy-starting-mode remote --started-by daemon',
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('daemon-spawned-session');
  });

  it('should detect a daemon-spawned dev session when ps reports the full node executable path', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: '/Users/leeroy/.local/share/fnm/node-versions/v22.22.1/installation/bin/node',
      cmd: `/Users/leeroy/.local/share/fnm/node-versions/v22.22.1/installation/bin/node --no-warnings --no-deprecation --import /repo/node_modules/tsx/dist/esm/index.mjs "${projectPath()}/src/index.ts" codex --happy-starting-mode remote --started-by daemon`,
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('dev-daemon-spawned');
  });

  it('should detect a packaged Windows daemon-spawned session process when ps-list reports happiest.exe', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'happiest.exe',
      cmd: 'C:\\hq\\windetachedfix-007\\happiest-v0.2.4-windows-x64\\happiest.exe C:\\hq\\windetachedfix-007\\happiest-v0.2.4-windows-x64\\happiest-runtime\\index.mjs opencode --happy-starting-mode remote --started-by daemon --existing-session session-123',
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('daemon-spawned-session');
  });

  it('should detect a dev daemon started from tsx', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: `/usr/bin/node /repo/apps/cli/node_modules/.bin/tsx "${projectPath()}/src/index.ts" daemon start-sync`,
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('dev-daemon');
  });

  it('preserves daemon ownership scope extracted from the process environment', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: `/usr/bin/node /repo/apps/cli/node_modules/.bin/tsx "${projectPath()}/src/index.ts" daemon start-sync`,
      daemonOwnershipEnvironmentVariables: {
        HAPPIEST_HOME_DIR: '/tmp/happier-stack/cli',
        HAPPIEST_ACTIVE_SERVER_ID: 'stack_current__id_default',
        HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID: 'stack_repo-current__id_default',
      },
    });
    expect(res).not.toBeNull();
    expect(res!.daemonOwnershipEnvironmentVariables).toEqual({
      HAPPIEST_HOME_DIR: '/tmp/happier-stack/cli',
      HAPPIEST_ACTIVE_SERVER_ID: 'stack_current__id_default',
      HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID: 'stack_repo-current__id_default',
    });
  });

  it('should detect a daemon-spawned source session started through the tsx import hook', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: `/usr/bin/node --preserve-symlinks --preserve-symlinks-main --import /repo/node_modules/tsx/dist/esm/index.mjs "${projectPath()}/src/index.ts" claude --happy-starting-mode remote --started-by daemon`,
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('dev-daemon-spawned');
  });

  it('should ignore source snapshots whose product ownership cannot be established', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: '/usr/bin/node --preserve-symlinks --preserve-symlinks-main --import /repo/node_modules/tsx/dist/esm/index.mjs /repo/.project/logs/e2e/run/cli-update-continuity/cli-update-from/src/index.ts claude --happy-starting-mode remote --started-by daemon',
    });
    expect(res).toBeNull();
  });

  it('should detect daemon-spawned source sessions launched without tsx import hook', () => {
    const res = classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: `/usr/bin/node "${projectPath()}/src/index.ts" claude --happy-starting-mode remote --started-by daemon`,
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('daemon-spawned-session');
  });

  it('should detect F4 runner snapshot sessions launched from .happiest-runner-snapshots index.mjs', () => {
    const res = classifyHappyProcess({
      pid: 67178,
      name: 'node',
      cmd: '/managed/node /repo/apps/cli/.happiest-runner-snapshots/f4abcd123/index.mjs claude --happy-starting-mode remote --started-by daemon --existing-session sess-live',
    });
    expect(res).not.toBeNull();
    expect(res!.type).toBe('daemon-spawned-session');
  });
});
