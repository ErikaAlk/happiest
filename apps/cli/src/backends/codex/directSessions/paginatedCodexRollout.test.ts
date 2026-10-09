import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectCodexSessionRolloutFiles } from './collectCodexSessionRolloutFiles';
import { pageCodexTranscript } from './pageCodexTranscript';
import { readCodexSessionTitleFromRollout } from './readCodexSessionTitleFromRollout';
import { mapCodexRolloutEventToActions, readCodexRolloutHistoryMode } from '../localControl/rolloutMapper';

describe('paginated Codex rollout readers', () => {
    it.skipIf(!process.env.HAPPIER_TEST_CODEX_ROLLOUT_FIXTURE)('preserves observed native identities from an isolated real rollout', async () => {
        const records: unknown[] = (await readFile(process.env.HAPPIER_TEST_CODEX_ROLLOUT_FIXTURE!, 'utf8'))
            .split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
        const metadata = records.find(record => typeof record === 'object' && record !== null && 'type' in record && record.type === 'session_meta');
        const historyMode = readCodexRolloutHistoryMode(
            metadata && typeof metadata === 'object' && 'payload' in metadata && typeof metadata.payload === 'object' && metadata.payload !== null && 'history_mode' in metadata.payload
                ? metadata.payload.history_mode : undefined,
        );
        expect(historyMode).toBe('paginated');
        const identities = records.flatMap(record => mapCodexRolloutEventToActions(record, { historyMode, debug: false }))
            .filter(action => action.type === 'user-text' || action.type === 'assistant-text')
            .map(action => ({ type: action.type, providerItemId: action.providerItemId, threadId: action.threadId }));
        expect(identities.filter(identity => identity.type === 'user-text')).toHaveLength(7);
        expect(identities.filter(identity => identity.type === 'assistant-text')).toHaveLength(7);
        expect(identities.every(identity => Boolean(identity.providerItemId && identity.threadId))).toBe(true);
        expect(new Set(identities.map(identity => `${identity.threadId}:${identity.providerItemId}`)).size).toBe(14);
    });
    it('uses file metadata when paging from the middle and reads native-only titles', async () => {
        const outputDir = resolve(process.cwd(), '../../.dev/local/out');
        await mkdir(outputDir, { recursive: true });
        const root = await mkdtemp(join(outputDir, 's12-rollout-format-'));
        const codexHome = join(root, 'codex-home');
        const sessionsDir = join(codexHome, 'sessions');
        await mkdir(sessionsDir, { recursive: true });
        const remoteSessionId = '11111111-1111-4111-8111-111111111111';
        const filePath = join(sessionsDir, `rollout-2026-10-09T00-00-00-${remoteSessionId}.jsonl`);
        const records = [
            { type: 'session_meta', payload: { id: remoteSessionId, history_mode: 'paginated', cli_version: '0.162.0-alpha.2' } },
            { timestamp: '2026-10-09T00:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'user', id: 'response-user', content: [{ type: 'input_text', text: '用户输入' }] } },
            { timestamp: '2026-10-09T00:00:01.001Z', type: 'event_msg', payload: { type: 'item_completed', thread_id: remoteSessionId, item: { type: 'UserMessage', id: 'user-item', client_id: 'client-input', content: [{ type: 'Text', text: '用户输入' }] } } },
            { timestamp: '2026-10-09T00:00:02.000Z', type: 'event_msg', payload: { type: 'item_completed', thread_id: remoteSessionId, item: { type: 'AgentMessage', id: 'assistant-item', content: [{ type: 'Text', text: '助手回复' }] } } },
            { timestamp: '2026-10-09T00:00:02.001Z', type: 'response_item', payload: { type: 'message', role: 'assistant', id: 'assistant-item', content: [{ type: 'output_text', text: '助手回复' }] } },
        ];
        await writeFile(filePath, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
        const files = await collectCodexSessionRolloutFiles({ codexHome, remoteSessionId });
        expect(files).toHaveLength(1);

        const params = { source: { kind: 'codexHome' as const, home: 'user' as const }, env: { CODEX_HOME: codexHome }, activeServerDir: root, remoteSessionId, maxBytes: 16_384, maxItems: 1 };
        const newest = await pageCodexTranscript({ ...params, direction: 'older' });
        expect(newest.items.map(item => item.createdAtMs)).toEqual([Date.parse('2026-10-09T00:00:02.000Z')]);
        expect(newest.nextCursor).not.toBeNull();
        const older = await pageCodexTranscript({ ...params, direction: 'older', cursor: newest.nextCursor! });
        expect(older.items.map(item => item.createdAtMs)).toEqual([Date.parse('2026-10-09T00:00:01.001Z')]);

        const nativeOnlyPath = join(root, 'native-only.jsonl');
        await writeFile(nativeOnlyPath, `${[records[0], records[2]].map(record => JSON.stringify(record)).join('\n')}\n`);
        expect(await readCodexSessionTitleFromRollout(nativeOnlyPath)).toBe('用户输入');
    });
});
