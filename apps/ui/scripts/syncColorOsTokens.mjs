// 把设计库 coloros-ui-kit 生成的 TypeScript 参数同步进 Happiest。
// 设计库按 Gradle 引入它的同一种方式定位：从本目录逐级向上找 coloros-ui-kit/web。
// 用法：node scripts/syncColorOsTokens.mjs          同步
//       node scripts/syncColorOsTokens.mjs --check  只校验已同步的文件与设计库一致（不一致退出码 1）
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SYNCED_FILES = ['tokens.g.ts', 'runtime.ts'];
const HEADER_PREFIX = '// 从 coloros-ui-kit ';

export function findKitWebDir(startDir, pathExists = existsSync) {
    let current = resolve(startDir);
    for (;;) {
        const candidate = join(current, 'coloros-ui-kit', 'web');
        if (pathExists(join(candidate, 'tokens.g.ts'))) return candidate;
        const parent = dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

export function renderSyncedFile(fileName, sourceText, kitCommit) {
    return `${HEADER_PREFIX}${kitCommit} 的 web/${fileName} 同步，不要手改；运行 yarn sync:coloros-tokens 更新。\n${sourceText}`;
}

/** 已同步文件去掉同步头后的正文，用于与设计库当前内容比较。 */
export function readSyncedBody(syncedText) {
    if (!syncedText.startsWith(HEADER_PREFIX)) return null;
    const newline = syncedText.indexOf('\n');
    return newline < 0 ? null : syncedText.slice(newline + 1);
}

function readKitCommit(kitWebDir) {
    return execFileSync('git', ['-C', kitWebDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
}

function main(argv) {
    const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const targetDir = join(uiRoot, 'sources', 'theme', 'coloros');
    const kitWebDir = findKitWebDir(uiRoot);
    if (!kitWebDir) {
        throw new Error(`coloros-ui-kit/web not found in any parent directory of ${uiRoot}`);
    }
    const check = argv.includes('--check');
    const stale = [];
    const kitCommit = check ? null : readKitCommit(kitWebDir);
    for (const fileName of SYNCED_FILES) {
        const sourceText = readFileSync(join(kitWebDir, fileName), 'utf8');
        const targetPath = join(targetDir, fileName);
        if (check) {
            const body = existsSync(targetPath) ? readSyncedBody(readFileSync(targetPath, 'utf8')) : null;
            if (body !== sourceText) stale.push(targetPath);
            continue;
        }
        mkdirSync(targetDir, { recursive: true });
        writeFileSync(targetPath, renderSyncedFile(fileName, sourceText, kitCommit), 'utf8');
        console.log(`synced ${targetPath}`);
    }
    if (stale.length > 0) {
        console.error(`ColorOS tokens differ from ${kitWebDir}; run yarn sync:coloros-tokens:\n  ${stale.join('\n  ')}`);
        process.exit(1);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv.slice(2));
}
