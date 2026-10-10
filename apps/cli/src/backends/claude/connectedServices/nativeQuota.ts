import type { ConnectedServiceCredentialRecordV1 } from '@happier-dev/protocol';
import { readClaudeCodeNativeCredential } from './nativeAuth/claudeCodeCredentialFile';
import { resolveConfiguredClaudeConfigDir } from '../utils/resolveConfiguredClaudeConfigDir';
import { resolveClaudeRuntimeProviderAccountIdentity } from './resolveClaudeRuntimeProviderAccountIdentity';
import { buildNativeProviderAccountUsageSourceProfileId } from '@/daemon/connectedServices/accountUsage/nativeSourceIdentity';
import type { ConnectedServiceQuotaFetcher, NativeProviderQuotaSource } from '@/daemon/connectedServices/quotas/types';

export function createClaudeNativeQuotaSource(env: NodeJS.ProcessEnv, fetcher: ConnectedServiceQuotaFetcher): NativeProviderQuotaSource {
    const pollIntervalMs = fetcher.pollPolicy!.minPollIntervalMs!;
    return {
        pollIntervalMs,
        async fetch(signal) {
            const configDir = resolveConfiguredClaudeConfigDir({ env });
            const credential = await readClaudeCodeNativeCredential({ claudeConfigDir: configDir });
            if (!credential) return null;
            const oauth = credential.payload.claudeAiOauth;
            if (!oauth.refreshToken) throw new Error('Claude 本机登录缺少 refreshToken');
            const identity = await resolveClaudeRuntimeProviderAccountIdentity({ env });
            const now = Date.now();
            const record: ConnectedServiceCredentialRecordV1 = {
                v: 1, serviceId: 'claude-subscription', kind: 'oauth', token: null,
                profileId: buildNativeProviderAccountUsageSourceProfileId({
                    kind: 'localCredential', providerId: 'claude', material: configDir,
                }),
                createdAt: credential.updatedAtMs, updatedAt: credential.updatedAtMs, expiresAt: oauth.expiresAt ?? null,
                oauth: {
                    accessToken: oauth.accessToken, refreshToken: oauth.refreshToken, idToken: null,
                    scope: oauth.scopes.join(' ') || null, tokenType: 'Bearer',
                    providerAccountId: identity.providerAccountId, providerEmail: identity.providerEmail,
                    raw: credential.payload,
                },
            };
            const snapshot = await fetcher.fetch({ record, now, signal });
            return snapshot ? {
                ...snapshot, providerId: 'claude', staleAfterMs: pollIntervalMs,
                ...(identity.providerAccountId ? { activeAccountId: identity.providerAccountId } : {}),
                source: 'provider_api', confidence: 'exact',
                meters: snapshot.meters.filter((meter) => meter.status === 'ok'),
            } : null;
        },
    };
}
