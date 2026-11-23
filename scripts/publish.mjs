#!/usr/bin/env node
// npm run publish            → sync posts + images from the vault, then git commit + push
// npm run publish -- --no-push  → sync only (for previewing locally)
//
// Everything in <vault>/blog is published. Images referenced with ![[...]] are found
// anywhere in the vault by filename and copied (never moved) to public/attachments.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const VAULT =
  process.env.BLOG_VAULT ??
  path.join(process.env.HOME, 'Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault/rwx');
const SOURCE = path.join(VAULT, 'blog');
const PREFERRED_ATTACHMENTS = path.join(VAULT, 'b - Attachments');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const POSTS_OUT = path.join(ROOT, 'src/content/posts');
const ATTACH_OUT = path.join(ROOT, 'public/attachments');
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const push = !process.argv.includes('--no-push');

const nfc = (s) => s.normalize('NFC');
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

// iCloud keeps evicted files as ".<name>.icloud" placeholders. Map them back to real names.
const realName = (entry) =>
  entry.startsWith('.') && entry.endsWith('.icloud') ? entry.slice(1, -'.icloud'.length) : null;

/** Make sure an iCloud file is actually on disk before reading it. */
async function ensureDownloaded(file) {
  if (fs.existsSync(file)) return;
  const placeholder = path.join(path.dirname(file), `.${path.basename(file)}.icloud`);
  if (!fs.existsSync(placeholder)) fail(`找不到檔案：${file}`);
  console.log(`  ↓ 從 iCloud 下載：${path.basename(file)}`);
  try {
    execFileSync('brctl', ['download', file], { stdio: 'ignore' });
  } catch {
    /* brctl may return non-zero while still starting the download; we poll below */
  }
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  while (!fs.existsSync(file)) {
    if (Date.now() > deadline) fail(`iCloud 下載逾時（${DOWNLOAD_TIMEOUT_MS / 1000}s）：${file}`);
    await sleep(500);
  }
}

/** List a folder, including files that only exist as iCloud placeholders. */
function listWithPlaceholders(dir) {
  return fs.readdirSync(dir).map((e) => realName(e) ?? e);
}

/** Index every image in the vault by filename. `b - Attachments` wins on name clashes. */
function indexVaultImages() {
  const index = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.obsidian' || entry.name === '.trash' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) walk(full);
        continue;
      }
      const name = realName(entry.name) ?? entry.name;
      if (!IMAGE_EXT.test(name)) continue;
      const key = nfc(name);
      const filePath = path.join(dir, name);
      if (!index.has(key) || dir === PREFERRED_ATTACHMENTS) index.set(key, filePath);
    }
  };
  walk(VAULT);
  return index;
}

function emptyDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const e of fs.readdirSync(dir)) if (e !== '.gitkeep') fs.rmSync(path.join(dir, e), { recursive: true });
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

async function main() {
  if (!fs.existsSync(SOURCE)) fail(`找不到文章資料夾：${SOURCE}`);
  console.log(`來源：${SOURCE}`);

  const postFiles = listWithPlaceholders(SOURCE).filter((f) => f.endsWith('.md'));
  const posts = [];
  for (const file of postFiles) {
    const full = path.join(SOURCE, file);
    await ensureDownloaded(full);
    posts.push({ file, content: fs.readFileSync(full, 'utf8') });
  }

  // Collect images used by ![[...]] embeds.
  const used = new Set();
  for (const { content } of posts) {
    for (const m of content.matchAll(/!\[\[([^\[\]|#]+)(?:[|#][^\[\]]*)?\]\]/g)) {
      const name = m[1].trim().split('/').pop();
      if (IMAGE_EXT.test(name)) used.add(nfc(name));
    }
  }
  const images = used.size ? indexVaultImages() : new Map();
  const missing = [...used].filter((n) => !images.has(n));
  if (missing.length) fail(`vault 裡找不到這些圖片：\n  ${missing.join('\n  ')}`);

  // Mirror: anything removed from the vault's blog/ is removed from the site too.
  emptyDir(POSTS_OUT);
  emptyDir(ATTACH_OUT);
  for (const { file, content } of posts) fs.writeFileSync(path.join(POSTS_OUT, nfc(file)), content);
  for (const name of used) {
    const src = images.get(name);
    await ensureDownloaded(src);
    fs.copyFileSync(src, path.join(ATTACH_OUT, name));
  }
  console.log(`✓ ${posts.length} 篇文章、${used.size} 張圖片`);

  if (!push) return console.log('（--no-push：只同步，不 commit）');
  if (!fs.existsSync(path.join(ROOT, '.git'))) fail('這個專案還不是 git repo，先 git init 並設定 remote。');

  git('add', '-A', 'src/content/posts', 'public/attachments');
  if (!git('diff', '--cached', '--name-only')) return console.log('沒有變更，不需要發布。');
  git('commit', '-m', `publish: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  console.log(git('push'));
  console.log('✓ 已推上 GitHub，Actions 會自動 build 並部署。');
}

main();
