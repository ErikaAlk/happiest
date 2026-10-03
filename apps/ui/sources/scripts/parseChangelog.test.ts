import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

import { parseChangelogMarkdown } from './parseChangelog';

const CHANGELOG = [
    '# Changelog',
    '',
    '## Release 0.2.0 - 2026-11-02',
    '',
    '<!-- happier-release-note-projections:v1',
    '{"expo":{"message":"Second release."}}',
    '-->',
    '',
    'Second release summary.',
    '',
    '### Sessions',
    '',
    '- Sessions resume faster.',
    '',
    '## Release 0.1.0 - 2026-10-03',
    '',
    '<!-- happier-release-note-projections:v1',
    '{"expo":{"message":"First release."}}',
    '-->',
    '',
    'First release summary',
    'continues here.',
    '',
    '- Runs beside `happier`.',
    '- Installs from [its own releases](https://example.invalid/releases).',
    '',
].join('\n');

const EXPECTED = {
    latestVersion: 2,
    entries: [
        { version: 2, release: '0.2.0', date: '2026-11-02', summary: 'Second release summary.', changes: ['Sessions resume faster.'] },
        { version: 1, release: '0.1.0', date: '2026-10-03', summary: 'First release summary continues here.', changes: ['Runs beside happier.', 'Installs from its own releases.'] },
    ],
};

describe('parseChangelogMarkdown', () => {
    it('reads every release section newest first as visible text, numbered so a newer release is unread', () => {
        expect(parseChangelogMarkdown(CHANGELOG)).toEqual(EXPECTED);
        expect(parseChangelogMarkdown(CHANGELOG.replace(/\n/g, '\r\n'))).toEqual(EXPECTED);
    });

    it('matches the committed changelog data the app bundles', () => {
        const uiRoot = join(__dirname, '..', '..');
        const committed = JSON.parse(readFileSync(join(uiRoot, 'sources', 'changelog', 'changelog.json'), 'utf8'));
        expect(committed).toEqual(parseChangelogMarkdown(readFileSync(join(uiRoot, 'CHANGELOG.md'), 'utf8')));
    });
});
