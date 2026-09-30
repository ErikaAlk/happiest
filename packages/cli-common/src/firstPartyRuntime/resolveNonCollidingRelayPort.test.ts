import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { productIdentity } from '@happier-dev/release-runtime/productIdentity';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveNonCollidingRelayPort, readSiblingRelayPorts } from './resolveNonCollidingRelayPort.js';

function setupFakeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'happier-relay-port-'));
  return home;
}

function writeSiblingServerEnv(home: string, channelSuffix: string, port: number): void {
  // Mirror resolveRelayRuntimeDefaults layout: <home>/<product home>/self-host[-<channel>]/config/server.env
  const suffix = channelSuffix ? `-${channelSuffix}` : '';
  const configDir = join(home, productIdentity.homeDirName, `self-host${suffix}`, 'config');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'server.env'), `PORT=${port}\n`, 'utf8');
}

const listeners: Server[] = [];

async function listenOnLoopback(port: number): Promise<number> {
  const server = createServer();
  listeners.push(server);
  return await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('listener has no address'));
        return;
      }
      resolve(address.port);
    });
  });
}

async function findFreePort(): Promise<number> {
  const server = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('listener has no address'));
        return;
      }
      resolve(address.port);
    });
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

afterEach(async () => {
  await Promise.all(listeners.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('resolveNonCollidingRelayPort', () => {
  it('returns the default port when no other channels are installed', async () => {
    const home = setupFakeHome();
    const defaultPort = await findFreePort();
    const port = await resolveNonCollidingRelayPort({
      platform: 'darwin',
      mode: 'user',
      channel: 'publicdev',
      homeDir: home,
      defaultPort,
      configuredPort: null,
    });
    expect(port).toBe(defaultPort);
  });

  it('honors the configured port when it does not collide with siblings', async () => {
    const home = setupFakeHome();
    writeSiblingServerEnv(home, 'preview', 4321);
    const port = await resolveNonCollidingRelayPort({
      platform: 'darwin',
      mode: 'user',
      channel: 'publicdev',
      homeDir: home,
      defaultPort: 3005,
      configuredPort: 9999,
    });
    expect(port).toBe(9999);
  });

  it('picks an ephemeral port when the default collides with a sibling channel', async () => {
    const home = setupFakeHome();
    // stable is installed on 3005 — installing dev should avoid it
    writeSiblingServerEnv(home, '', 3005);
    const port = await resolveNonCollidingRelayPort({
      platform: 'darwin',
      mode: 'user',
      channel: 'publicdev',
      homeDir: home,
      defaultPort: 3005,
      configuredPort: null,
    });
    expect(port).not.toBe(3005);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });

  // Another program on this machine (for example an upstream Happier relay) already listens on the
  // default port without any server.env this product could read.
  it('picks another port when a process already listens on the default port', async () => {
    const home = setupFakeHome();
    const occupiedPort = await listenOnLoopback(0);
    const port = await resolveNonCollidingRelayPort({
      platform: 'darwin',
      mode: 'user',
      channel: 'stable',
      homeDir: home,
      defaultPort: occupiedPort,
      configuredPort: null,
    });
    expect(port).not.toBe(occupiedPort);
    expect(port).toBeGreaterThan(0);
  });

  // The configured port belongs to this channel's own installed relay, which is listening on it
  // while an update runs.
  it('keeps the configured port while the installed relay is listening on it', async () => {
    const home = setupFakeHome();
    const configuredPort = await listenOnLoopback(0);
    const port = await resolveNonCollidingRelayPort({
      platform: 'darwin',
      mode: 'user',
      channel: 'stable',
      homeDir: home,
      defaultPort: 3005,
      configuredPort,
    });
    expect(port).toBe(configuredPort);
  });

  it('ignores the current channel when scanning for collisions', async () => {
    const home = setupFakeHome();
    // dev is already installed on 3005 — reinstalling dev should honor 3005
    writeSiblingServerEnv(home, 'dev', 3005);
    const ports = await readSiblingRelayPorts({
      platform: 'darwin',
      mode: 'user',
      channel: 'publicdev',
      homeDir: home,
    });
    expect([...ports]).toEqual([]);
  });

  it('reads PORT from every other channel\'s server.env', async () => {
    const home = setupFakeHome();
    writeSiblingServerEnv(home, '', 3005);
    writeSiblingServerEnv(home, 'preview', 4327);
    const ports = await readSiblingRelayPorts({
      platform: 'darwin',
      mode: 'user',
      channel: 'publicdev',
      homeDir: home,
    });
    expect(new Set(ports)).toEqual(new Set([3005, 4327]));
  });
});
