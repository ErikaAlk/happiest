#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

import { listReleaseNoteSections, stripMarkdownLine } from '../../../../scripts/pipeline/release/release-notes/project-release-notes.mjs';
import type { ChangelogData } from '../changelog/types';

/**
 * The changelog screen's data, from the same `## Release <id> - <date>` sections a release
 * publishes, as the visible text the screen renders. Entries are numbered from the oldest
 * release, so a newer release reads as unread.
 */
export function parseChangelogMarkdown(markdown: string): ChangelogData {
    const sections = listReleaseNoteSections(markdown);
    const entries = sections.map((section, index) => {
        const summaryLines: string[] = [];
        const changes: string[] = [];
        for (const line of section.markdown.split('\n').map((value) => value.trim())) {
            if (line.startsWith('- ')) {
                changes.push(stripMarkdownLine(line));
            } else if (changes.length === 0 && line.length > 0 && !line.startsWith('#')) {
                summaryLines.push(stripMarkdownLine(line));
            }
        }
        return {
            version: sections.length - index,
            release: section.releaseId,
            date: section.date,
            summary: summaryLines.join(' '),
            changes,
        };
    });
    return { entries, latestVersion: entries[0]?.version ?? 0 };
}

function main() {
    const uiRoot = path.join(__dirname, '..', '..');
    const changelogData = parseChangelogMarkdown(fs.readFileSync(path.join(uiRoot, 'CHANGELOG.md'), 'utf8'));
    const outputPath = path.join(uiRoot, 'sources', 'changelog', 'changelog.json');
    fs.writeFileSync(outputPath, `${JSON.stringify(changelogData, null, 2)}\n`);
    console.log(`Wrote ${changelogData.entries.length} changelog entries to ${outputPath}`);
}

if (require.main === module) {
    main();
}
