import type { PermissionMode } from '@/api/types';
import type { MessageQueue2 } from '@/agent/runtime/modeMessageQueue';
import type { ApiSessionClient } from '@/api/session/sessionClient';

import { discardQueuedAndPendingForLocalSwitch } from '@/agent/localControl/discardQueuedAndPendingForLocalSwitch';

import { codexLocalLauncher, type CodexLauncherResult } from '../codexLocalLauncher';

type QueueModeWithLocalId = { localId?: string | null };

type DiscardController = (args: Parameters<typeof discardQueuedAndPendingForLocalSwitch>[0]) => Promise<
  Awaited<ReturnType<typeof discardQueuedAndPendingForLocalSwitch>>
>;

export type CodexLocalModePassResult =
  | { type: 'remote'; resumeId: string | null }
  /** Local mode did not start; remote mode continues as if it had never been left. */
  | { type: 'handed_to_remote' }
  | { type: 'exit' };

export async function runCodexLocalModePass<Mode extends QueueModeWithLocalId>(opts: {
  session: ApiSessionClient;
  messageQueue: MessageQueue2<Mode>;
  workspaceDir: string;
  api: unknown;
  permissionMode: PermissionMode;
  resumeId: string | null;
  codexArgs?: readonly string[];
  formatError: (error: unknown) => string;
  /**
   * What to do with input already waiting when local mode would start. `confirm_discard` (the
   * default) is for a user switching to local mode. `hand_to_remote` is for a runner the daemon
   * opened in a window in local mode: a message that arrived meanwhile is the user's, and remote mode
   * runs it.
   */
  waitingInput?: 'confirm_discard' | 'hand_to_remote';
  launchLocal?: (args: {
    path: string;
    api: unknown;
    session: ApiSessionClient;
    messageQueue: MessageQueue2<Mode>;
    permissionMode: PermissionMode;
    resumeId: string | null;
    codexArgs?: readonly string[];
  }) => Promise<CodexLauncherResult>;
  discardController?: DiscardController;
}): Promise<CodexLocalModePassResult> {
  let cachedServerPendingCount: number | null = null;
  const getServerPendingCount = async (): Promise<number> => {
    if (cachedServerPendingCount !== null) return cachedServerPendingCount;
    cachedServerPendingCount = (await opts.session.listPendingMessageQueueV2LocalIds()).length;
    return cachedServerPendingCount;
  };

  if (opts.messageQueue.size() > 0 || (await getServerPendingCount()) > 0) {
    if (opts.waitingInput === 'hand_to_remote') {
      return { type: 'handed_to_remote' };
    }
    const discardController = opts.discardController ?? discardQueuedAndPendingForLocalSwitch;
    const discardResult = await discardController({
      queue: opts.messageQueue,
      getServerPendingCount,
      discardServerPending: () =>
        opts.session.discardPendingMessageQueueV2All({ reason: 'switch_to_local' }),
      markQueuedAsDiscarded: (localIds) =>
        opts.session.discardCommittedMessageLocalIds({ localIds: [...localIds], reason: 'switch_to_local' }),
      sendStatusMessage: (message) => {
        opts.session.sendSessionEvent({ type: 'message', message });
      },
      formatError: opts.formatError,
      onCancelled: () => {
        opts.session.sendSessionEvent({
          type: 'message',
          message: 'Keeping queued messages; staying in remote mode.',
        });
      },
    });

    if (discardResult !== 'proceed') {
      return { type: 'remote', resumeId: opts.resumeId };
    }
  }

  const launchLocal = opts.launchLocal ?? codexLocalLauncher;
  const localResult = await launchLocal({
    path: opts.workspaceDir,
    api: opts.api,
    session: opts.session,
    messageQueue: opts.messageQueue,
    permissionMode: opts.permissionMode,
    resumeId: opts.resumeId,
    codexArgs: opts.codexArgs ?? [],
  });

  if (localResult.type === 'exit') {
    return { type: 'exit' };
  }

  return { type: 'remote', resumeId: localResult.resumeId };
}
