import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { slugFor } from './lib/posts-index.mjs';

const posts = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './src/content/posts',
    generateId: ({ entry, data }) => slugFor(entry.replace(/\.md$/, '').normalize('NFC'), data),
  }),
  schema: z.object({
    title: z.string().optional(), // falls back to the filename, see src/lib/posts.ts
    date: z.coerce.date(),
    slug: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = { posts };
