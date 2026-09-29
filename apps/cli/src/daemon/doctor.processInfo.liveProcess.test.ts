import type { ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import { spawnInlineNodeTestProcess } from '@/testkit/process/spawn';

import { readProcessInfoByPid } from './doctor';

const children: ChildProcess[] = [];

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});

describe('readProcessInfoByPid (live processes)', () => {
  it('reports the parent process of a live process', async () => {
    const child = spawnInlineNodeTestProcess('setInterval(() => {}, 1000)', { windowsHide: true });
    children.push(child);

    const info = await readProcessInfoByPid(child.pid!);

    // Callers tell a process they spawned apart from an unrelated one with the same executable.
    expect(info?.parentPid).toBe(process.pid);
  }, 60_000);
});
