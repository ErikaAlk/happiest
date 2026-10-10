import { z } from 'zod';
import { createCodexAppServerClient } from '../appServer/client/createCodexAppServerClient';
import { readCodexRateLimitsSnapshot } from '../appServer/readCodexRateLimitsSnapshot';
import { readCodexLiveAccountIdentity } from './codexLiveAccountIdentity';
import { mapCodexRateLimitSnapshotToQuotaSnapshot } from './mapCodexRateLimitSnapshot';
import type { NativeProviderQuotaSource } from '@/daemon/connectedServices/quotas/types';
import { resolveProviderCliCommand } from '@/runtime/managedTools/providerCliResolution';
import { resolveCodexNativeQuotaIdentity } from './reportCodexRateLimitSnapshotToDaemon';

export function createCodexNativeQuotaSource(env: NodeJS.ProcessEnv, pollIntervalMs: number): NativeProviderQuotaSource {
    return {
        pollIntervalMs,
        async fetch(signal) {
            const invocation = resolveProviderCliCommand('codex', { processEnv: env });
            if (!invocation) return null;
            signal.throwIfAborted();
            const client = await createCodexAppServerClient({
                processEnv: env, disableUserMcpServers: true, initializeRequestOptions: { signal },
            });
            const disposeOnAbort = () => { void client.dispose(); };
            signal.addEventListener('abort', disposeOnAbort, { once: true });
            try {
                signal.throwIfAborted();
                const accountResponse = await client.request('account/read', { refreshToken: false }, { signal });
                const account = z.object({ account: z.object({ type: z.string() }).nullable() }).parse(accountResponse).account;
                if (!account || account.type === 'apiKey') return null;
                const nativeIdentity = await resolveCodexNativeQuotaIdentity(env);
                const liveIdentity = readCodexLiveAccountIdentity(accountResponse);
                const identity = {
                    activeAccountId: liveIdentity.activeAccountId ?? nativeIdentity.activeAccountId,
                    accountLabel: liveIdentity.accountLabel ?? nativeIdentity.accountLabel,
                };
                const rawSnapshot = await readCodexRateLimitsSnapshot({
                    request: (method, params) => client.request(method, params, { signal }),
                });
                return mapCodexRateLimitSnapshotToQuotaSnapshot({
                    serviceId: 'openai-codex', profileId: nativeIdentity.profileId, ...identity,
                    fetchedAt: Date.now(), staleAfterMs: pollIntervalMs, rawSnapshot,
                });
            } finally {
                signal.removeEventListener('abort', disposeOnAbort);
                await client.dispose();
            }
        },
    };
}
