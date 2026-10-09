import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const UserText = z.object({ type: z.literal('text'), text: z.string() });
const AgentText = z.object({ type: z.literal('acp'), data: z.object({ type: z.literal('message'), message: z.string() }) });
const identity = (role: string, text: string) => createHash('sha256').update(`${role}:${text}`).digest('hex');

describe.skipIf(process.env.HAPPIER_TEST_LIVE_SESSION_SERVER !== '1')('Codex history identity on the real server', () => {
  it.each(['original', 'native-only'])('preserves %s history after reconstructing the session client', async format => {
    const home = process.env.HAPPIER_TEST_LIVE_SESSION_HOME;
    const serverUrl = process.env.HAPPIER_TEST_LIVE_SESSION_URL;
    let filePath = process.env.HAPPIER_TEST_CODEX_ROLLOUT_FIXTURE;
    if (!home) throw new Error('缺少隔离测试服务器目录');
    if (!serverUrl) throw new Error('缺少隔离测试服务器地址');
    if (!filePath) throw new Error('缺少真实 Codex 验收会话记录');
    process.env.HAPPIEST_HOME_DIR = home;
    process.env.HAPPIEST_SERVER_URL = serverUrl;
    process.env.HAPPIEST_WEBAPP_URL = serverUrl;
    const config = await import('@/configuration');
    config.reloadConfiguration();
    expect(config.configuration.serverUrl).toBe(serverUrl);
    const { resolveServerHttpBaseUrl } = await import('@/api/client/serverHttpBaseUrl');
    expect(resolveServerHttpBaseUrl()).toBe(serverUrl);
    const [{ ApiClient }, { readCredentials }, { fetchEncryptedTranscriptMessagesPage }, { CodexRolloutMirror }, { decryptTranscriptRows }, { resolveSessionEncryptionContextFromCredentials }] = await Promise.all([
      import('@/api/api'), import('@/persistence'), import('@/session/replay/fetchEncryptedTranscriptMessages'), import('@/backends/codex/localControl/codexRolloutMirror'),
      import('@/session/replay/decryptTranscriptRows'), import('@/session/transport/encryption/sessionEncryptionContext'),
    ]);
    const credentials = await readCredentials();
    if (!credentials) throw new Error('缺少隔离测试服务器凭据');
    const api = await ApiClient.create(credentials);
    const { mapCodexRolloutEventToActions } = await import('@/backends/codex/localControl/rolloutMapper');
    const records: unknown[] = (await readFile(filePath, 'utf8')).split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    const expected = records.flatMap(record => mapCodexRolloutEventToActions(record, { debug: false, historyMode: 'paginated' }))
      .flatMap(action => action.type === 'user-text' || action.type === 'assistant-text'
        ? [identity(action.type === 'user-text' ? 'user' : 'agent', action.text)] : []);
    expect(expected.length).toBeGreaterThan(0);
    if (format === 'native-only') {
      const directory = resolve('.dev/local');
      await mkdir(directory, { recursive: true });
      filePath = join(await mkdtemp(join(directory, 's12-native-history-')), 'rollout.jsonl');
      const native = records.filter(record => z.object({ type: z.string() }).parse(record).type !== 'response_item');
      await writeFile(filePath, `${native.map(record => JSON.stringify(record)).join('\n')}\n`);
    }
    const tag = `s12-history-identity-${randomUUID()}`;
    let sessionId = '';
    let originalIds: string[] = [];
    for (let replay = 0; replay < 2; replay++) {
      const session = await api.getOrCreateSession({ tag, metadata: {
        path: process.cwd(), host: os.hostname(), homeDir: os.homedir(), happyHomeDir: home,
        happyLibDir: resolve('.'), happyToolsDir: resolve('tools'),
      }, state: null });
      if (!session) throw new Error('隔离测试服务器无法创建会话');
      if (replay > 0) expect(session.id).toBe(sessionId);
      sessionId = session.id;
      const client = api.sessionSyncClient(session);
      try {
        await client.updateMetadata(metadata => metadata);
        const mirror = new CodexRolloutMirror({
          filePath, session: client, debug: false, onCodexSessionId: () => undefined,
        });
        await mirror.start();
        await mirror.stop();
        await client.flush();
        const page = await fetchEncryptedTranscriptMessagesPage({ token: credentials.token, sessionId, limit: 100 });
        expect(page.hasMore).toBe(false);
        const decoded = decryptTranscriptRows({
          ctx: session.encryptionMode === 'e2ee' ? session : resolveSessionEncryptionContextFromCredentials(credentials),
          rows: page.messages,
        });
        expect(decoded.map(message => message.role)).toContain('user');
        expect(decoded.map(message => message.role)).toContain('agent');
        expect(decoded).toHaveLength(page.messages.length);
        const observed = [...decoded].sort((left, right) => left.seq - right.seq).flatMap(message => {
          const user = UserText.safeParse(message.content);
          if (message.role === 'user' && user.success) return [identity('user', user.data.text)];
          const agent = AgentText.safeParse(message.content);
          return message.role === 'agent' && agent.success ? [identity('agent', agent.data.data.message)] : [];
        });
        expect(observed).toEqual(expected);
        const ids = page.messages.map(message => z.string().min(1).parse(message.id)).sort();
        expect(ids.length).toBeGreaterThan(0);
        if (replay === 0) originalIds = ids;
        else expect(ids).toEqual(originalIds);
      } finally {
        await client.close();
      }
    }
  }, 60_000);
});
