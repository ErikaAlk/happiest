#!/usr/bin/env node
// @ts-check
/**
 * Bump the product version or the website version.
 *
 * CI-oriented behavior:
 * - Updates versions on the currently checked-out branch (typically main),
 * - so workflows can then promote that commit to deploy branches.
 *
 * Supported:
 * - --component product|website (required)
 * - --bump none|patch|minor|major (required)
 *
 * "product" moves every product component to one new version (see lib/product-version.mjs) and
 * also rewrites apps/ui/app.config.js expo.version when the config still uses a string literal.
 */
import fs from 'node:fs';
import path from 'node:path';

import { readProductVersion, writeProductVersion } from './lib/product-version.mjs';

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const v = argv[i + 1];
    if (v && !v.startsWith('--')) {
      out.set(a, v);
      i++;
    } else {
      out.set(a, 'true');
    }
  }
  return out;
}

function fail(msg) {
  process.stderr.write(`[bump-version] ${msg}\n`);
  process.exit(1);
}

function normalizeSemverBase(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(s);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function bumpSemver(raw, bump) {
  const base = normalizeSemverBase(raw);
  if (!base) fail(`Invalid semver "${raw}"`);
  const next = { ...base };
  if (bump === 'major') {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
  } else if (bump === 'minor') {
    next.minor += 1;
    next.patch = 0;
  } else if (bump === 'patch') {
    next.patch += 1;
  } else {
    fail(`Unknown bump "${bump}"`);
  }
  return `${next.major}.${next.minor}.${next.patch}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

function updateExpoAppConfigVersion(appDir, nextVersion) {
  const filePath = path.join(appDir, 'app.config.js');
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');

  const re = /(\bversion\s*:\s*["'])([^"']+)(["'])/;
  if (!re.test(raw)) return;

  fs.writeFileSync(filePath, raw.replace(re, `$1${nextVersion}$3`));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const component = String(args.get('--component') ?? '').trim();
  const bump = String(args.get('--bump') ?? '').trim();
  const repoRoot = process.cwd();

  if (component !== 'product' && component !== 'website') {
    fail('--component must be one of: product, website');
  }
  if (!bump || !['none', 'patch', 'minor', 'major'].includes(bump)) {
    fail(`--bump must be one of: none, patch, minor, major`);
  }

  if (bump === 'none') {
    process.stdout.write(`SKIP\n`);
    return;
  }

  if (component === 'website') {
    const pkgPath = path.join(repoRoot, 'apps', 'website', 'package.json');
    const pkg = readJson(pkgPath);
    const nextVersion = bumpSemver(String(pkg.version ?? '').trim(), bump);
    pkg.version = nextVersion;
    writeJson(pkgPath, pkg);
    process.stdout.write(`${nextVersion}\n`);
    return;
  }

  const nextVersion = bumpSemver(readProductVersion(repoRoot), bump);
  writeProductVersion(repoRoot, nextVersion);
  updateExpoAppConfigVersion(path.join(repoRoot, 'apps', 'ui'), nextVersion);
  process.stdout.write(`${nextVersion}\n`);
}

main();
