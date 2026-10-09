import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { ProcessInfoByPid } from '@/daemon/doctor';
import { selectCodexSessionWriterProcesses, selectLinuxCodexSessionLockOwners, readLinuxFileLockIdentity, parseLinuxLocks } from './findLiveCodexSessionProcesses';

// Windows 原生终端与 Restart Manager 的实际观测形状。
const owner = { pid: 56428, startedAt: '2026-10-09T10:27:27.9612772Z', paths: ['session.lock'] };
const terminal: ProcessInfoByPid = {
    pid: 56428, parentPid: 101, name: 'codex.exe', cmd: 'codex.exe --no-daemon resume session',
    processInstanceFingerprint: 'win32-cim:2026-10-09T10:27:27.9612770Z',
};

describe('Codex session writer identity', () => {
    it('preserves large inode identities without rounding process IDs', () => {
        expect(parseLinuxLocks('{"locks":[{"pid":22980,"path":null,"type":"POSIX","mode":"WRITE","inode":18446744073709551615,"maj:min":"0:69"}]}')).toEqual({
            locks: [{ pid: 22980, path: null, type: 'POSIX', mode: 'WRITE', inode: '18446744073709551615', 'maj:min': '0:69' }],
        });
    });
    it('recognizes the observed lock through a symbolic Codex home', () => {
        const testRoot = resolve('.dev/local');
        mkdirSync(testRoot, { recursive: true });
        const directory = mkdtempSync(join(testRoot, 'codex-lock-'));
        const home = join(directory, 'real');
        const alias = join(directory, 'alias');
        mkdirSync(join(home, 'thread-writer-locks'), { recursive: true });
        const lockPath = join(home, 'thread-writer-locks', 'session.lock');
        writeFileSync(lockPath, '');
        symlinkSync(home, alias, process.platform === 'win32' ? 'junction' : 'dir');
        try {
            const observedPath = realpathSync(lockPath);
            for (const type of ['FLOCK', 'POSIX']) {
                expect(selectLinuxCodexSessionLockOwners({ locks: [
                    { pid: 13562, path: '/incorrect-lslocks-path', type, mode: 'WRITE', ...readLinuxFileLockIdentity(lockPath) },
                ] }, alias, join(alias, 'thread-writer-locks', 'session.lock'))).toEqual([
                    { pid: 13562, paths: [observedPath] },
                ]);
            }
        } finally {
            if (!directory.startsWith(`${testRoot}${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error('测试目录超出允许范围');
            rmSync(directory, { recursive: true });
        }
    });
    it('ignores an unrelated OFD lock with no process PID', () => {
        expect(selectLinuxCodexSessionLockOwners({ locks: [
            { pid: -1, path: '/other.lock', type: 'OFDLCK', mode: 'WRITE' },
        ] }, '/codex', '/codex/thread-writer-locks/session.lock')).toEqual([]);
    });
    it('refuses a process that switched to another session during lock discovery', () => {
        expect(() => selectCodexSessionWriterProcesses(
            [{ ...owner, paths: ['other.lock'] }], new Map([[terminal.pid, terminal]]), new Map(), 'session.lock',
        )).toThrow();
    });
    it('keeps the observed terminal identity across FILETIME and CIM precision', () => {
        expect(selectCodexSessionWriterProcesses([owner], new Map([[terminal.pid, terminal]]), new Map(), 'session.lock')).toEqual([
            { pid: terminal.pid, parentPid: terminal.parentPid },
        ]);
    });

    it('refuses a reused PID, another executable, a shared app-server, and a terminal owning multiple sessions', () => {
        for (const observed of [
            { ...terminal, processInstanceFingerprint: 'win32-cim:2026-10-09T10:27:28.9612770Z' },
            { ...terminal, name: 'powershell.exe' },
            { ...terminal, cmd: 'codex.exe app-server' },
        ]) {
            expect(() => selectCodexSessionWriterProcesses([owner], new Map([[observed.pid, observed]]), new Map(), 'session.lock')).toThrow();
        }
        expect(() => selectCodexSessionWriterProcesses([{ ...owner, paths: ['session.lock', 'other.lock'] }], new Map([[terminal.pid, terminal]]), new Map(), 'session.lock')).toThrow();
    });

    it('reports no writer after the observed process has exited', () => {
        expect(selectCodexSessionWriterProcesses([owner], new Map(), new Map(), 'session.lock')).toEqual([]);
    });
});
