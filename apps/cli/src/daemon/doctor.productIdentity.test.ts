import { describe, expect, it } from 'vitest';

import { classifyHappyProcess } from './doctor';

describe('product process ownership', () => {
  it.each([
    ['happier.exe', 'C:\\Users\\alice\\.happier\\cli\\current\\happier.exe daemon start-sync'],
    ['node', 'node /home/alice/.happier/cli/current/package-dist/index.mjs daemon start-sync'],
    ['node', 'node /repo/apps/cli/dist/index.mjs daemon start-sync'],
    ['node', 'node /repo/apps/cli/.runner-snapshots/abcd/index.mjs --started-by daemon'],
    ['node', 'node /repo/node_modules/@happier-dev/cli/bin/happier.mjs daemon start-sync'],
  ])('does not adopt or clean an upstream process: %s %s', (name, cmd) => {
    expect(classifyHappyProcess({ pid: 123, name, cmd })).toBeNull();
  });

  // Every process an agent starts inside a session inherits the session's HAPPIEST_* variables, so
  // those variables say nothing about whether a process belongs to this product.
  it('does not claim a user project process that inherited the session environment', () => {
    expect(classifyHappyProcess({
      pid: 123,
      name: 'node',
      cmd: 'node --import tsx /home/alice/work/app/src/index.ts',
      daemonOwnershipEnvironmentVariables: { HAPPIEST_HOME_DIR: '/home/alice/.happiest' },
    })).toBeNull();
  });

  it.each([
    ['happiest.exe', 'C:\\Users\\alice\\.happiest\\cli\\current\\happiest.exe --started-by daemon'],
    ['node', 'node /home/alice/.happiest/cli/current/happiest-runtime/index.mjs --started-by daemon'],
    ['node', 'node /repo/apps/cli/.happiest-runner-snapshots/abcd/index.mjs --started-by daemon'],
    ['bun', 'bun /repo/apps/cli/bin/happiest.mjs --started-by daemon'],
  ])('recognizes its own session process: %s %s', (name, cmd) => {
    expect(classifyHappyProcess({ pid: 123, name, cmd })?.type).toBe('daemon-spawned-session');
  });
});
