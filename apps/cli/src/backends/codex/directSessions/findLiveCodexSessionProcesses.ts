import { execFile } from 'node:child_process';
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { parse } from 'lossless-json';
import { readProcessInstanceFingerprint } from '@happier-dev/cli-common/processInstance';

import { DirectSessionsProviderUnavailableError, type DirectSessionRunningProcess } from '@/backends/directSessions/providerOps';
import { readProcessInfosByPid, classifyHappyProcess, type ProcessInfoByPid } from '@/daemon/doctor';
import { isPidAliveBySignal } from '@/daemon/processRunState';
import { readDaemonHeartbeatIntervalMs } from '@/daemon/lifecycle/heartbeatInterval';
import { resolveCliRuntimeAssetPath } from '@/runtime/assets/resolveCliRuntimeAssetPath';

const execute = promisify(execFile);
const WindowsFileUsersSchema = z.array(z.object({
    pid: z.number().int().positive(), startedAt: z.string(), paths: z.array(z.string()),
}));
const LinuxLocksSchema = z.object({ locks: z.array(z.object({
    pid: z.number().int(), path: z.string().nullable(), type: z.string(), mode: z.string(),
    inode: z.union([z.string().regex(/^\d+$/), z.number().int().safe()]).transform(String).optional(),
    'maj:min': z.string().optional(),
})).optional() });

export function parseLinuxLocks(text: string): unknown {
    return parse(text, null, value => Number.isSafeInteger(Number(value)) ? Number(value) : value);
}

export function readLinuxFileLockIdentity(path: string) {
    const { ino, dev } = statSync(path, { bigint: true });
    const major = ((dev >> 8n) & 0xfffn) | ((dev >> 32n) & ~0xfffn);
    const minor = (dev & 0xffn) | ((dev >> 12n) & ~0xffn);
    return { inode: ino.toString(), 'maj:min': `${major}:${minor}` };
}

export function selectLinuxCodexSessionLockOwners(value: unknown, codexHome: string, lockPath: string) {
    const locks = (LinuxLocksSchema.parse(value).locks ?? []).filter(lock =>
        (lock.type === 'FLOCK' || lock.type === 'POSIX') && lock.mode === 'WRITE');
    if (locks.length === 0) return [];
    const canonicalLockPath = realpathSync(lockPath);
    const lockDirectory = join(realpathSync(codexHome), 'thread-writer-locks');
    const files = readdirSync(lockDirectory).filter(name => name.endsWith('.lock') && name !== '.coordination.lock')
        .map(name => {
            const path = realpathSync(join(lockDirectory, name));
            return { path, ...readLinuxFileLockIdentity(path) };
        });
    const pathsByPid = new Map<number, Set<string>>();
    for (const lock of locks) {
        const file = files.find(file => file.inode === lock.inode && file['maj:min'] === lock['maj:min']);
        if (!file) continue;
        const pid = z.number().int().positive().parse(lock.pid);
        const paths = pathsByPid.get(pid) ?? new Set<string>();
        paths.add(file.path);
        pathsByPid.set(pid, paths);
    }
    return [...pathsByPid].filter(([, paths]) => paths.has(canonicalLockPath))
        .map(([pid, paths]) => ({ pid, paths: [...paths] }));
}

/** Codex 0.162.0-alpha.2 的会话写入进程持有 `<home>/thread-writer-locks/<id>.lock`。 */
export async function findLiveCodexSessionProcesses(params: Readonly<{
    codexHome: string; remoteSessionId: string;
}>): Promise<DirectSessionRunningProcess[]> {
    const sessionId = z.uuid().parse(params.remoteSessionId);
    const requestedLockPath = resolve(params.codexHome, 'thread-writer-locks', `${sessionId}.lock`);
    if (!existsSync(requestedLockPath)) return [];
    const lockPath = realpathSync(requestedLockPath);

    let owners: Array<{ pid: number; paths: string[]; startedAt?: string }>;
    if (process.platform === 'win32') {
        const script = resolveCliRuntimeAssetPath('scripts', 'runtime', 'readWindowsFileUsers.ps1');
        const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-LockPath', lockPath], {
            windowsHide: true, timeout: readDaemonHeartbeatIntervalMs(),
        });
        owners = WindowsFileUsersSchema.parse(JSON.parse(stdout));
    } else if (process.platform === 'linux') {
        const { stdout } = await execute('lslocks', ['--json', '--notruncate', '--output', 'PID,PATH,TYPE,MODE,INODE,MAJ:MIN'], { timeout: readDaemonHeartbeatIntervalMs() });
        // util-linux 在没有文件锁时输出空白并成功退出。
        if (stdout.trim() === '') return [];
        owners = selectLinuxCodexSessionLockOwners(parseLinuxLocks(stdout), params.codexHome, lockPath);
    } else {
        throw new DirectSessionsProviderUnavailableError('当前系统无法可靠识别 Codex 会话的运行进程，请先在电脑退出该会话。');
    }

    const infos = await readProcessInfosByPid(owners.map(owner => owner.pid));
    const parents = await readProcessInfosByPid([...infos.values()].flatMap(info => info.parentPid ? [info.parentPid] : []));
    for (const owner of owners) {
        if (!infos.has(owner.pid) && isPidAliveBySignal(owner.pid)) {
            throw new DirectSessionsProviderUnavailableError('无法读取 Codex 会话进程身份，请重新尝试。');
        }
    }
    return await Promise.all(selectCodexSessionWriterProcesses(owners, infos, parents, lockPath).map(async running => {
        const initial = process.platform === 'win32'
            ? infos.get(running.pid)?.processInstanceFingerprint
            : await readProcessInstanceFingerprint(running.pid);
        return {
            ...running,
            verifyBeforeStop: async () => {
                if (!initial) {
                    throw new DirectSessionsProviderUnavailableError('无法确认 Codex 会话进程的启动身份，请先在电脑退出该会话。');
                }
                const current = await findLiveCodexSessionProcesses(params);
                const currentFingerprint = await readProcessInstanceFingerprint(running.pid);
                if (!current.some(candidate => candidate.pid === running.pid) || currentFingerprint !== initial) {
                    throw new DirectSessionsProviderUnavailableError('Codex 会话进程归属发生变化，请重新尝试。');
                }
            },
        };
    }));
}

export function selectCodexSessionWriterProcesses(
    owners: readonly Readonly<{ pid: number; paths: readonly string[]; startedAt?: string }>[],
    infos: ReadonlyMap<number, ProcessInfoByPid>,
    parents: ReadonlyMap<number, ProcessInfoByPid>,
    lockPath: string,
): DirectSessionRunningProcess[] {
    if (owners.length > 1) {
        throw new DirectSessionsProviderUnavailableError('多个进程正在访问 Codex 会话，无法确认可以结束的进程，请重新尝试。');
    }
    const running: DirectSessionRunningProcess[] = [];
    for (const owner of owners) {
        const info = infos.get(owner.pid);
        if (!info) continue;
        const name = info.name?.toLowerCase();
        if (name !== 'codex' && name !== 'codex.exe') {
            throw new DirectSessionsProviderUnavailableError('无法确认占用会话的进程属于 Codex，请先在电脑退出该会话。');
        }
        // CIM 保留微秒，Restart Manager 提供 FILETIME 的百纳秒精度。
        if (owner.startedAt && info.processInstanceFingerprint?.slice(0, -2) !== `win32-cim:${owner.startedAt}`.slice(0, -2)) {
            throw new DirectSessionsProviderUnavailableError('Codex 会话进程身份发生变化，请重新尝试。');
        }
        const parent = info.parentPid ? parents.get(info.parentPid) : undefined;
        const ownedRunner = parent !== undefined && classifyHappyProcess(parent) !== null;
        if (owner.paths.length !== 1 || owner.paths[0] !== lockPath || (/\bapp-server\b/.test(info.cmd ?? '') && !ownedRunner)) {
            throw new DirectSessionsProviderUnavailableError('该 Codex 进程承载共享会话，请先在电脑关闭目标会话。');
        }
        running.push({ pid: owner.pid, parentPid: info.parentPid ?? null });
    }
    return running;
}
