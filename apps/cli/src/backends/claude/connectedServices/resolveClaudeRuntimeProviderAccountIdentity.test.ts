import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveClaudeRuntimeProviderAccountIdentity } from './resolveClaudeRuntimeProviderAccountIdentity';

describe('Claude native account identity', () => {
    it('reads the default home root and the explicitly configured root separately', async () => {
        const home = await mkdtemp(resolve('../../.dev/local/s30-identity-'));
        const configured = join(home, 'configured');
        try {
            await mkdir(configured);
            await writeFile(join(home, '.claude.json'), JSON.stringify({ oauthAccount: { accountUuid: 'home-account' } }));
            await writeFile(join(configured, '.claude.json'), JSON.stringify({ oauthAccount: { accountUuid: 'configured-account' } }));
            const env = { HOME: home, USERPROFILE: home };
            expect((await resolveClaudeRuntimeProviderAccountIdentity({ env })).providerAccountId).toBe('home-account');
            expect((await resolveClaudeRuntimeProviderAccountIdentity({ env: { ...env, CLAUDE_CONFIG_DIR: configured } })).providerAccountId)
                .toBe('configured-account');
        } finally {
            await rm(home, { recursive: true });
        }
    });
});
