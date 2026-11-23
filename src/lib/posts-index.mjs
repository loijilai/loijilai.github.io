// Shared between astro.config (remark plugin) and content.config (collection ids),
// so a post's URL is computed the same way everywhere.
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export const POSTS_DIR = path.resolve('src/content/posts');

/** Filename (without .md) → URL slug. Frontmatter `slug` wins; otherwise the filename. */
export function slugFor(basename, data = {}) {
  const raw = typeof data.slug === 'string' && data.slug.trim() ? data.slug : basename;
  return raw.trim().replace(/\s+/g, '-');
}

export function readFrontmatter(source) {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  try {
    return parseYaml(m[1]) ?? {};
  } catch {
    return {};
  }
}

/** Map of note name (as written in [[wikilinks]]) → slug, for every published post. */
export function buildPostsIndex(dir = POSTS_DIR) {
  const index = new Map();
  if (!fs.existsSync(dir)) return index;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const basename = file.slice(0, -3);
    const data = readFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    index.set(basename.normalize('NFC'), slugFor(basename, data));
  }
  return index;
}
