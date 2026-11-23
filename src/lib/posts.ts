import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'> & { title: string };

/** All posts, newest first, with `title` defaulting to the filename. */
export async function getPosts(): Promise<Post[]> {
  const entries = await getCollection('posts');
  return entries
    .map((entry) => {
      const filename = (entry.filePath ?? entry.id).split('/').pop()!.replace(/\.md$/, '');
      return { ...entry, title: entry.data.title ?? filename.normalize('NFC') };
    })
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const postUrl = (post: Post) => `/posts/${post.id}/`;

export const formatMonth = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
