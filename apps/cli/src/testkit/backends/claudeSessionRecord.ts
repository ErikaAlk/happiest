import type { ChildProcess } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { join } from 'node:path'

import { readProcessInstanceFingerprint } from '@happier-dev/cli-common/processInstance'

import { spawnTestProcess } from '@/testkit/process/spawn'

// Claude Code records each running session in `<config dir>/sessions/<pid>.json`. On Windows,
// `procStart` is the process creation time as a FILETIME (100 ns ticks since 1601-01-01); real
// records carry a sub-microsecond digit that CIM creation times do not.
const FILETIME_UNIX_EPOCH_TICKS = 116444736000000000n

export function filetimeFromCimFingerprint(fingerprint: string, subMicrosecondTicks = 3n): string {
  const match = /^win32-cim:(.+)\.(\d{7})Z$/.exec(fingerprint)
  if (!match) throw new Error(`unexpected fingerprint ${fingerprint}`)
  const seconds = BigInt(Date.parse(`${match[1]}Z`) / 1000)
  const microseconds = BigInt(match[2]!.slice(0, 6))
  return (FILETIME_UNIX_EPOCH_TICKS + seconds * 10_000_000n + microseconds * 10n + subMicrosecondTicks).toString()
}

/**
 * A live stand-in for a Claude Code process. Its command line names Claude so platforms that
 * identify the recorded process by command line recognise it; Windows ties it by creation time.
 */
export function spawnClaudeStandInProcess(): ChildProcess {
  return spawnTestProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'claude'], { windowsHide: true })
}

export async function writeClaudeSessionRecord(params: Readonly<{
  configDir: string
  pid: number
  sessionId: string
  procStart?: string
  entrypoint?: string
}>): Promise<void> {
  await mkdir(join(params.configDir, 'sessions'), { recursive: true })
  await writeFile(join(params.configDir, 'sessions', `${params.pid}.json`), JSON.stringify({
    pid: params.pid,
    sessionId: params.sessionId,
    ...(params.procStart ? { procStart: params.procStart } : {}),
    pidDomain: `${process.platform}:${hostname().toLowerCase()}`,
    entrypoint: params.entrypoint ?? 'claude-desktop',
    kind: 'interactive',
  }), 'utf8')
}

/** Source for {@link spawnInlineNodeParentWithChild} whose grandchild command line names Claude. */
export const CLAUDE_STAND_IN_CHILD_SOURCE = 'setInterval(() => {}, 1000) // claude'

/** Records `pid` as the live Claude Code process of `sessionId`, as Claude Code itself would. */
export async function recordLiveClaudeSession(params: Readonly<{
  configDir: string
  pid: number
  sessionId: string
}>): Promise<void> {
  const pid = params.pid
  const fingerprint = process.platform === 'win32' ? await readProcessInstanceFingerprint(pid) : null
  if (process.platform === 'win32' && !fingerprint) throw new Error(`no process fingerprint for ${pid}`)
  await writeClaudeSessionRecord({
    configDir: params.configDir,
    pid,
    sessionId: params.sessionId,
    procStart: fingerprint ? filetimeFromCimFingerprint(fingerprint) : undefined,
  })
}
