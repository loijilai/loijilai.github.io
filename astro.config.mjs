// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkObsidian from './src/lib/remark-obsidian.mjs';

export default defineConfig({
  site: 'https://loijilai.github.io',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkObsidian],
    }),
  },
});
