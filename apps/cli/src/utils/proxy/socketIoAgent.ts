import { globalAgent as httpGlobalAgent } from 'node:http';
import { globalAgent as httpsGlobalAgent } from 'node:https';

import { getHttpsProxyAgent } from './agents';
import { resolveProxyForUrl } from './resolveProxyForUrl';

/**
 * Connection agent for every Socket.IO client the CLI creates.
 *
 * Without an agent, engine.io's Node polling transport opens a new TCP (and TLS) connection for
 * every long-poll and send request. Behind a proxy or on a high-latency link each of those pays a
 * full handshake, which made every exchange before the websocket upgrade cost about a second.
 * Direct connections therefore use Node's keep-alive global agent, which also lets the socket
 * reuse connections the same process already opened for HTTP API requests.
 */
export function getSocketIoAgentOptions(params: Readonly<{
  targetUrl: string;
  env: NodeJS.ProcessEnv;
}>): { agent: string | boolean } {
  const resolved = resolveProxyForUrl({ targetUrl: params.targetUrl, env: params.env });
  // engine.io-client types use `string | boolean` here for browser compatibility, but Node allows an Agent.
  // We provide an Agent object at runtime and cast only to satisfy the TS surface.
  if (resolved.mode === 'proxy') {
    return { agent: getHttpsProxyAgent(resolved.proxyUrl) as unknown as boolean };
  }
  const agent = new URL(params.targetUrl).protocol === 'https:' ? httpsGlobalAgent : httpGlobalAgent;
  return { agent: agent as unknown as boolean };
}
