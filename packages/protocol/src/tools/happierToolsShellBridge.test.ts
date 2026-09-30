import { describe, expect, it } from 'vitest';

import { parseHappierToolsShellBridgeCommand } from './happierToolsShellBridge.js';

const productCommandName = 'happiest';

function parse(command: string) {
  return parseHappierToolsShellBridgeCommand(command, productCommandName);
}

describe('parseHappierToolsShellBridgeCommand', () => {
  it('parses product tools list invocations', () => {
    expect(
      parse('happiest tools list --session-id "sess-1" --directory "/tmp/workspace" --json'),
    ).toEqual({
      kind: 'list',
      rawCommand: 'happiest tools list --session-id "sess-1" --directory "/tmp/workspace" --json',
      sessionId: 'sess-1',
      directory: '/tmp/workspace',
      json: true,
    });
  });

  it('parses node-invoked tools list bridge commands', () => {
    expect(
      parse(
        `'/Users/leeroy/.nvm/versions/node/v22.14.0/bin/node' '--no-warnings' '--no-deprecation' '/Users/leeroy/Documents/Development/happiest/dev/apps/cli/dist/index.mjs' 'tools' 'list' '--session-id' 'sess-1' '--directory' '/tmp/workspace' '--json'`,
      ),
    ).toEqual({
      kind: 'list',
      rawCommand:
        `'/Users/leeroy/.nvm/versions/node/v22.14.0/bin/node' '--no-warnings' '--no-deprecation' '/Users/leeroy/Documents/Development/happiest/dev/apps/cli/dist/index.mjs' 'tools' 'list' '--session-id' 'sess-1' '--directory' '/tmp/workspace' '--json'`,
      sessionId: 'sess-1',
      directory: '/tmp/workspace',
      json: true,
    });
  });

  it('parses bun-invoked bridge commands of an installed runtime payload', () => {
    expect(
      parse(
        `'/usr/bin/bun' '/home/alice/.happiest/cli/versions/0.1.0/happiest-runtime/index.mjs' 'tools' 'list' '--json'`,
      ),
    ).toMatchObject({ kind: 'list', json: true });
  });

  it('parses tools call invocations with JSON args', () => {
    expect(
      parse(
        `happiest tools call --session-id "sess-1" --directory "/tmp/workspace" --source happier --tool change_title --args-json '{"title":"Renamed"}' --json`,
      ),
    ).toEqual({
      kind: 'call',
      rawCommand:
        `happiest tools call --session-id "sess-1" --directory "/tmp/workspace" --source happier --tool change_title --args-json '{"title":"Renamed"}' --json`,
      sessionId: 'sess-1',
      directory: '/tmp/workspace',
      source: 'happier',
      tool: 'change_title',
      argsJson: '{"title":"Renamed"}',
      args: { title: 'Renamed' },
      json: true,
    });
  });

  it('rejects unset preludes', () => {
    expect(
      parse(
        'unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN; FOO=bar happiest tools call --source playwright --tool open_page --args-json \'{"url":"https://example.com"}\'',
      ),
    ).toBeNull();
  });

  it('parses env preludes when quoted values contain spaces', () => {
    expect(
      parse(
        'HAPPIER_SPAWN_HOOK=\'/Applications/Test Hook/hook.js\' NODE_OPTIONS=\'--require /Applications/Test Hook/register.js\' happiest tools list --session-id "sess-1" --directory "/tmp/workspace" --json',
      ),
    ).toEqual({
      kind: 'list',
      rawCommand:
        'HAPPIER_SPAWN_HOOK=\'/Applications/Test Hook/hook.js\' NODE_OPTIONS=\'--require /Applications/Test Hook/register.js\' happiest tools list --session-id "sess-1" --directory "/tmp/workspace" --json',
      sessionId: 'sess-1',
      directory: '/tmp/workspace',
      json: true,
    });
  });

  it('returns null for unrelated shell commands', () => {
    expect(parse('git status --short')).toBeNull();
  });

  it.each([
    'happiest tools call --source happier --tool save_memory --json; touch /tmp/happiest-pwn',
    'happiest tools call --source happier --tool save_memory --json && touch /tmp/happiest-pwn',
    'happiest tools call --source happier --tool save_memory --json || touch /tmp/happiest-pwn',
    'happiest tools call --source happier --tool save_memory --json | cat',
    'happiest tools call --source happier --tool save_memory --json > /tmp/happiest-pwn',
    'happiest tools call --source happier --tool save_memory --json $(touch /tmp/happiest-pwn)',
    'happiest tools call --source happier --tool save_memory --json `touch /tmp/happiest-pwn`',
    'happiest tools call --source happier --tool save_memory --json\n touch /tmp/happiest-pwn',
    'happiest tools call --source happier --tool save_memory --json extra-token',
  ])('rejects shell bridge commands with trailing shell execution: %s', (command) => {
    expect(parse(command)).toBeNull();
  });

  it.each([
    'happiest tools list --json --json',
    'happiest tools list --session-id one --session-id two',
    'happiest tools call --source happier --source custom --tool think',
    'happiest tools call --source happier --tool think --tool save_memory',
  ])('rejects duplicate flags: %s', (command) => {
    expect(parse(command)).toBeNull();
  });

  it('rejects invalid JSON arguments', () => {
    expect(
      parse(`happiest tools call --source happier --tool save_memory --args-json '{'`),
    ).toBeNull();
  });
});

// The bridge belongs to the product whose CLI the caller runs. Another product's command on the same
// machine (an upstream `happier` next to `happiest`) runs a different CLI and is not this bridge.
describe('parseHappierToolsShellBridgeCommand for a named product command', () => {
  it('parses the product command and the product binary', () => {
    expect(parse('happiest tools list --json')).toMatchObject({
      kind: 'list',
      json: true,
    });
    expect(
      parse(
        `'/usr/bin/bun' '/home/alice/.happiest/bin/happiest' 'tools' 'call' '--source' 'happier' '--tool' 'change_title' '--json'`,
      ),
    ).toMatchObject({ kind: 'call', source: 'happier', tool: 'change_title' });
  });

  it('does not take another product’s command for the bridge', () => {
    expect(parse('happier tools list --json')).toBeNull();
    expect(
      parse(`'/usr/bin/bun' '/home/alice/.happier/bin/happier' 'tools' 'list' '--json'`),
    ).toBeNull();
  });
});
