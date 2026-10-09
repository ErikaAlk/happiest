import { resolve } from 'node:path';
import { spawn } from 'node-pty';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';

describe('RemoteControlDisplay real terminal', () => {
    it('identifies both speakers in restored history and live messages', async () => {
        const terminal = spawn(process.execPath, ['--import', 'tsx', resolve('src/ui/ink/RemoteControlDisplay.terminalFixture.tsx')], {
            name: 'xterm-256color', cols: 100, rows: 32, cwd: process.cwd(),
            env: { ...process.env, FORCE_COLOR: '1' },
        });
        let output = '';
        terminal.onData(data => { output += data; });
        const code = await new Promise<number>(resolve => terminal.onExit(event => resolve(event.exitCode)));
        expect(code, output).toBe(0);
        const text = stripAnsi(output);
        expect(text).toMatch(/你：\s+S12_HISTORY_USER/);
        expect(text).toMatch(/Codex：\s+S12_HISTORY_ASSISTANT/);
        expect(text).toMatch(/你：\s+S12_LIVE_USER/);
        expect(text).toMatch(/Codex：\s+S12_LIVE_ASSISTANT/);
    });
});
