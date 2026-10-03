export interface ChangelogEntry {
    /** Position from the oldest release; the unread marker compares it. */
    version: number;
    /** Release id from the changelog heading, shown as the entry's title. */
    release: string;
    date: string;
    summary: string;
    changes: string[];
}

export interface ChangelogData {
    entries: ChangelogEntry[];
    latestVersion: number;
}
