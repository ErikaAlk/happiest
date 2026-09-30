import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { resolveHappyHomeDirFromEnvironment } from './resolveHappyHomeDir.js';

// The passwd lookup is an OS boundary; only its answer is replaced.
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawnSync: vi.fn(),
}));
const mockedSpawnSync = vi.mocked(spawnSync);

function resolveOriginalPlatformDescriptor(): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  if (!descriptor) {
    throw new Error('process.platform descriptor is unavailable');
  }
  return descriptor;
}
const originalPlatformDescriptor: PropertyDescriptor = resolveOriginalPlatformDescriptor();

function withPlatform(platform: NodeJS.Platform, fn: () => void): void {
  Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: platform });
  try {
    fn();
  } finally {
    Object.defineProperty(process, 'platform', originalPlatformDescriptor);
  }
}

describe('resolveHappyHomeDirFromEnvironment', () => {
  it('returns an absolute override path unchanged', () => {
    expect(resolveHappyHomeDirFromEnvironment({ HAPPIEST_HOME_DIR: '/tmp/happiest-home' })).toBe('/tmp/happiest-home');
  });

  it('expands ~/ override paths against the configured home directory', () => {
    expect(resolveHappyHomeDirFromEnvironment({
      HAPPIEST_HOME_DIR: '~/custom-happiest-home',
      HOME: '/Users/tester',
    })).toBe(join('/Users/tester', 'custom-happiest-home'));
  });

  it('resolves relative override paths to absolute paths', () => {
    expect(resolveHappyHomeDirFromEnvironment({ HAPPIEST_HOME_DIR: 'relative-home' })).toBe(resolvePath('relative-home'));
  });

  it('preserves Windows-shaped absolute overrides on Windows', () => {
    withPlatform('win32', () => {
      expect(resolveHappyHomeDirFromEnvironment({
        HAPPIEST_HOME_DIR: 'C:\\Users\\tester\\.happiest-custom',
        USERPROFILE: 'C:\\Users\\tester',
      })).toBe('C:\\Users\\tester\\.happiest-custom');
    });
  });

  it('rejects Windows-shaped absolute overrides on non-Windows hosts', () => {
    withPlatform('darwin', () => {
      expect(() => resolveHappyHomeDirFromEnvironment({
        HAPPIEST_HOME_DIR: 'C:\\Users\\tester\\.happiest-custom',
        HOME: '/Users/tester',
      })).toThrow(/windows/i);
    });
  });

  it('defaults to $HOME/.happiest when HOME is present', () => {
    expect(resolveHappyHomeDirFromEnvironment({ HOME: '/tmp/home' })).toBe(join('/tmp/home', '.happiest'));
  });

  it('falls back to os.homedir() when HOME and USERPROFILE are missing', () => {
    expect(resolveHappyHomeDirFromEnvironment({})).toBe(join(homedir(), '.happiest'));
  });

  it('ignores the home directory of an upstream Happier installation', () => {
    expect(resolveHappyHomeDirFromEnvironment({
      HAPPIER_HOME_DIR: '/Users/tester/.happier',
      HOME: '/Users/tester',
    })).toBe(join('/Users/tester', '.happiest'));
  });

  it('resolves the sudo invoker home instead of root home', () => {
    withPlatform('linux', () => {
      // `process.getuid` only exists on POSIX hosts, so it is assigned rather than spied.
      const originalGetuid = process.getuid;
      process.getuid = () => 0;
      mockedSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'tester:x:1000:1000:Tester:/home/tester:/bin/bash\n',
      } as unknown as ReturnType<typeof spawnSync>);
      try {
        expect(resolveHappyHomeDirFromEnvironment({ HOME: '/root', SUDO_USER: 'tester', SUDO_UID: '1000' }))
          .toBe(join('/home/tester', '.happiest'));
        expect(mockedSpawnSync).toHaveBeenCalledWith('getent', ['passwd', 'tester'], expect.anything());
      } finally {
        process.getuid = originalGetuid;
      }
    });
  });
});
