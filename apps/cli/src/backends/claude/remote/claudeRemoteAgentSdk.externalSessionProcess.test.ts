import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CLAUDE_STAND_IN_CHILD_SOURCE,
  recordLiveClaudeSession,
  spawnClaudeStandInProcess,
} from '@/testkit/backends/claudeSessionRecord';
import { spawnInlineNodeParentWithChild } from '@/testkit/process/spawn';

import { claudeRemoteAgentSdk } from './claudeRemoteAgentSdk';
import { makeMode } from './claudeRemoteAgentSdk.testkit';

const ORIGINAL_CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR;
const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
  if (typeof ORIGINAL_CLAUDE_CONFIG_DIR === 'string') process.env.CLAUDE_CONFIG_DIR = ORIGINAL_CLAUDE_CONFIG_DIR;
  else delete process.env.CLAUDE_CONFIG_DIR;
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  cleanups.push(async () => await rm(dir, { recursive: true, force: true }));
  return dir;
}

async function startClaudeProcessOutsideThisRunner(): Promise<number> {
  // A grandchild, so its parent is not this process, which plays the Happier runner here.
  const { parent, childPid } = await spawnInlineNodeParentWithChild(CLAUDE_STAND_IN_CHILD_SOURCE);
  cleanups.push(() => {
    try {
      process.kill(childPid);
    } catch {
      // already gone
    }
    (parent as ChildProcess).kill();
  });
  return childPid;
}

function startClaudeProcessOwnedByThisRunner(): number {
  const child = spawnClaudeStandInProcess();
  cleanups.push(() => {
    child.kill();
  });
  return child.pid!;
}

async function resumeRecordedSession(params: Readonly<{ heldByPid: number }>) {
  const configDir = await createTempDir('happier-claude-held-config-');
  process.env.CLAUDE_CONFIG_DIR = configDir;
  const remoteSessionId = 'remote-held-session';
  await recordLiveClaudeSession({ configDir, pid: params.heldByPid, sessionId: remoteSessionId });
  const transcriptDir = await createTempDir('happier-claude-held-transcript-');
  const transcriptPath = join(transcriptDir, `${remoteSessionId}.jsonl`);
  await writeFile(transcriptPath, '{"type":"summary"}\n', 'utf8');

  const createQuery = vi.fn((_params: any) => ({
    async *[Symbol.asyncIterator]() {
      yield { type: 'result' } as any;
    },
    close: vi.fn(),
    setPermissionMode: vi.fn(),
    setModel: vi.fn(),
    setMaxThinkingTokens: vi.fn(),
    supportedCommands: vi.fn(async () => []),
    supportedModels: vi.fn(async () => []),
  } as any));
  const onPromptTransportFailure = vi.fn();
  const onCompletionEvent = vi.fn();
  let delivered = false;

  await claudeRemoteAgentSdk({
    sessionId: remoteSessionId,
    transcriptPath,
    path: transcriptDir,
    claudeArgs: [],
    claudeExecutablePath: '/tmp/claude',
    canCallTool: async () => ({ behavior: 'allow', updatedInput: {} }),
    isAborted: () => false,
    nextMessage: async () => {
      if (delivered) return null;
      delivered = true;
      return { message: 'hello', mode: makeMode(), userMessageLocalIds: ['local-held-1'] };
    },
    onReady: () => {},
    onSessionFound: () => {},
    onMessage: () => {},
    onCompletionEvent,
    onPromptTransportFailure,
    createQuery,
  } as any);

  return { createQuery, onPromptTransportFailure, onCompletionEvent };
}

describe('claudeRemoteAgentSdk resuming a Claude session that has a live Claude process on this computer', () => {
  it('does not resume the session and rejects the prompt before it has any effect when another program runs it', async () => {
    const heldByPid = await startClaudeProcessOutsideThisRunner();

    const { createQuery, onPromptTransportFailure, onCompletionEvent } = await resumeRecordedSession({ heldByPid });

    // A second Claude process on the same conversation would fork it into two writers.
    expect(createQuery).not.toHaveBeenCalled();
    expect(onPromptTransportFailure).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'rejected_before_effect',
      userMessageLocalIds: ['local-held-1'],
    }));
    expect(onCompletionEvent).toHaveBeenCalledWith(expect.any(String));
  }, 60_000);

  it('resumes the session when the live process is the Claude process this runner started', async () => {
    const heldByPid = startClaudeProcessOwnedByThisRunner();

    const { createQuery, onPromptTransportFailure } = await resumeRecordedSession({ heldByPid });

    expect(createQuery).toHaveBeenCalledTimes(1);
    expect(onPromptTransportFailure).not.toHaveBeenCalled();
  }, 60_000);
});
