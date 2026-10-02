import type { ConnectedServiceId } from '@happier-dev/protocol';

import { formatCliCommand } from '@/utils/system/cliCommand';

import { buildGithubPersonalAccessTokenUrl } from './github/buildGithubPersonalAccessTokenUrl';

export type ConnectedServiceRegistryEntry = Readonly<{
  serviceId: ConnectedServiceId;
  connectCommand: string;
  supportsOauth: boolean;
  /**
   * Optional list of OAuth "add profile" surface modes this service wants to expose
   * explicitly in the service detail Actions group.
   *
   * When omitted or length <= 1, the UI uses the generic "Add OAuth profile" action.
   */
  oauthAddActionModes?: ReadonlyArray<'device' | 'paste' | 'browser'>;
  supportsToken?: boolean;
  tokenKind?: 'access-token' | 'api-key' | 'setup-token';
  tokenSetupUrl?: string;
}>;

export const CONNECTED_SERVICES_REGISTRY: readonly ConnectedServiceRegistryEntry[] = Object.freeze([
  {
    serviceId: 'claude-subscription',
    connectCommand: formatCliCommand('connect claude'),
    supportsOauth: true,
    oauthAddActionModes: ['paste', 'browser'],
    supportsToken: true,
    tokenKind: 'setup-token',
  },
  {
    serviceId: 'openai-codex',
    connectCommand: formatCliCommand('connect codex'),
    supportsOauth: true,
    oauthAddActionModes: ['device', 'paste', 'browser'],
  },
  {
    serviceId: 'openai',
    connectCommand: formatCliCommand('connect codex --api-key'),
    supportsOauth: false,
    supportsToken: true,
    tokenKind: 'api-key',
  },
  {
    serviceId: 'anthropic',
    connectCommand: formatCliCommand('connect claude --api-key'),
    supportsOauth: false,
    supportsToken: true,
    tokenKind: 'api-key',
  },
  {
    serviceId: 'gemini',
    connectCommand: formatCliCommand('connect gemini'),
    supportsOauth: true,
    oauthAddActionModes: ['paste', 'browser'],
  },
  {
    serviceId: 'github',
    connectCommand: formatCliCommand('connect github --token'),
    supportsOauth: false,
    supportsToken: true,
    tokenKind: 'access-token',
    tokenSetupUrl: buildGithubPersonalAccessTokenUrl(),
  },
]);

export function getConnectedServiceRegistryEntry(serviceId: ConnectedServiceId): ConnectedServiceRegistryEntry {
  const entry = CONNECTED_SERVICES_REGISTRY.find((s) => s.serviceId === serviceId);
  if (entry) return entry;
  return {
    serviceId,
    connectCommand: formatCliCommand(`connect ${serviceId}`),
    supportsOauth: false,
    oauthAddActionModes: [],
    supportsToken: false,
  };
}
