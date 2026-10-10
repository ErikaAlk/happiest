import { join } from 'node:path';

import { resolveHomeDirFromEnvironment } from '@happier-dev/cli-common/providers';
import { resolveClaudeConfigDirOverride } from '../utils/resolveClaudeConfigDirOverride';

import { readClaudeOauthAccountIdentity, readClaudeRootConfigFile } from './claudeRootConfig';

export type ClaudeRuntimeProviderAccountIdentity = Readonly<{
  providerAccountId: string | null;
  providerEmail: string | null;
}>;

// 从 Claude 根配置读取账号身份，原生和托管配置共用此处。
export async function readClaudeMaterializedOAuthAccountIdentity(
  claudeConfigDir: string,
): Promise<ClaudeRuntimeProviderAccountIdentity> {
  const rootConfig = await readClaudeRootConfigFile(join(claudeConfigDir, '.claude.json'));
  const identity = readClaudeOauthAccountIdentity(rootConfig?.oauthAccount);
  return {
    providerAccountId: identity.accountId,
    providerEmail: identity.email,
  };
}

// 原生默认配置位于用户目录，指定配置目录时读取该目录内的根配置。
export async function resolveClaudeRuntimeProviderAccountIdentity(
  params: Readonly<{ env: NodeJS.ProcessEnv }>,
): Promise<ClaudeRuntimeProviderAccountIdentity> {
  return readClaudeMaterializedOAuthAccountIdentity(
    resolveClaudeConfigDirOverride(params.env) ?? resolveHomeDirFromEnvironment(params.env),
  );
}
