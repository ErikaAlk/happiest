import type { Metadata } from '@/sync/domains/state/storageTypes';
import { getAttachCommandForSession } from '@/utils/sessions/terminalSessionDetails';

/**
 * How the user continues a session in a terminal on the computer that runs it.
 * - `attach`: the runner is hosted in an attachable terminal; `happier attach` opens it.
 * - `reopen_in_windows_terminal`: the daemon started the runner without a window on Windows
 *   (the `hidden` launch mode). Restarting it in Windows Terminal resumes the same session.
 * - `none`: no terminal continuation applies (another platform, a runner the user started in their
 *   own terminal, or an agent that cannot resume).
 */
export type SessionComputerContinuation =
    | Readonly<{ kind: 'attach'; command: string }>
    | Readonly<{ kind: 'reopen_in_windows_terminal' }>
    | Readonly<{ kind: 'none' }>;

function isWindowlessTerminalHost(terminal: Metadata['terminal'] | null | undefined): boolean {
    return !terminal || terminal.mode === 'plain';
}

export function resolveSessionComputerContinuation(params: Readonly<{
    sessionId: string;
    metadata: Pick<Metadata, 'os' | 'terminal' | 'startedBy'> | null | undefined;
    /** The current user may stop and resume this session and its agent supports resume. */
    canReopen: boolean;
}>): SessionComputerContinuation {
    const metadata = params.metadata;
    const command = getAttachCommandForSession({ sessionId: params.sessionId, terminal: metadata?.terminal });
    if (command) return { kind: 'attach', command };
    if (
        params.canReopen
        && metadata?.os === 'win32'
        && metadata.startedBy === 'daemon'
        && isWindowlessTerminalHost(metadata.terminal)
    ) {
        return { kind: 'reopen_in_windows_terminal' };
    }
    return { kind: 'none' };
}
