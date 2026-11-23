import rss from '@astrojs/rss';
import { getPosts, postUrl } from '../lib/posts';
import { SITE } from '../site.config';

export async function GET(context) {
  const posts = await getPosts();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: postUrl(post),
    })),
  });
}
