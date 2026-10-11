import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

describe('hsetup executable entrypoint', () => {
    it('runs the task protocol when launched directly from source', async () => {
        const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
        const result = spawnSync(process.execPath, [
            '--import', 'tsx', 'src/bin/hsetup.ts', 'system-tasks', 'run',
            '--spec-json', JSON.stringify({ protocolVersion: 1, kind: 'system.ping.v1', params: {} }),
        ], { cwd: packageRoot, encoding: 'utf8', timeout: 30_000 });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).not.toBe('');
        const output = createInterface({ input: Readable.from([result.stdout]) });
        const messages: unknown[] = [];
        for await (const line of output) messages.push(JSON.parse(line));
        expect(messages).toContainEqual(expect.objectContaining({ protocolVersion: 1, ok: true }));
    });
});
