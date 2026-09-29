import { describe, expect, it } from 'vitest';

import { resolveSessionComputerContinuation } from './sessionComputerContinuation';

const hiddenWindowsDaemonSession = {
    os: 'win32',
    startedBy: 'daemon' as const,
    terminal: { mode: 'plain' as const, requested: 'hidden' as const },
};

describe('resolveSessionComputerContinuation', () => {
    it('offers the attach command for a session hosted in an attachable terminal', () => {
        expect(resolveSessionComputerContinuation({
            sessionId: 's1',
            metadata: {
                os: 'win32',
                startedBy: 'daemon',
                terminal: { mode: 'windows_terminal', windows: { host: 'windows_terminal', windowId: 'happier' } },
            },
            canReopen: true,
        })).toEqual({ kind: 'attach', command: 'happier attach s1' });
    });

    it('offers reopening in Windows Terminal for a hidden Windows session the daemon started', () => {
        expect(resolveSessionComputerContinuation({
            sessionId: 's1',
            metadata: hiddenWindowsDaemonSession,
            canReopen: true,
        })).toEqual({ kind: 'reopen_in_windows_terminal' });
    });

    it('offers reopening when the daemon recorded no terminal host at all', () => {
        expect(resolveSessionComputerContinuation({
            sessionId: 's1',
            metadata: { os: 'win32', startedBy: 'daemon' },
            canReopen: true,
        })).toEqual({ kind: 'reopen_in_windows_terminal' });
    });

    it('does not reopen a session the user started in their own terminal', () => {
        expect(resolveSessionComputerContinuation({
            sessionId: 's1',
            metadata: { ...hiddenWindowsDaemonSession, startedBy: 'terminal' },
            canReopen: true,
        })).toEqual({ kind: 'none' });
    });

    it('does not reopen hidden sessions on other platforms or without resume support', () => {
        expect(resolveSessionComputerContinuation({
            sessionId: 's1',
            metadata: { ...hiddenWindowsDaemonSession, os: 'linux' },
            canReopen: true,
        })).toEqual({ kind: 'none' });
        expect(resolveSessionComputerContinuation({
            sessionId: 's1',
            metadata: hiddenWindowsDaemonSession,
            canReopen: false,
        })).toEqual({ kind: 'none' });
    });
});
