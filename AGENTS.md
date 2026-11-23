## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Project caveats (things that differ from a stock Astro site)

- **Markdown processor**: Astro 7's default processor (Sätteri) does not run remark plugins, and `markdown.remarkPlugins` is deprecated. We use `unified()` from `@astrojs/markdown-remark` in `astro.config.mjs`; add remark/rehype plugins there.
- **Content is generated, not authored here**: the source of truth is the Obsidian vault folder `rwx/blog/` (iCloud). `scripts/publish.mjs` mirrors it into `src/content/posts/` and copies embedded images into `public/attachments/`. Both folders are wiped on every sync, so never hand-edit them. `npm run sync` = mirror only; `npm run publish` = mirror + commit those two folders + push.
- **Publishing switch is the folder**: there is no `draft` field. Anything in `rwx/blog/` is published; the raw markdown (including Obsidian `%% comments %%`) is public in this repo.
- **Frontmatter**: only `date` is required. `title` falls back to the filename (`src/lib/posts.ts`); `slug` falls back to the filename with spaces → `-`.
- **Slug logic is shared**: `src/lib/posts-index.mjs` (`slugFor`) is used by both `content.config.ts` (`generateId`) and the remark plugin. Change it in one place only, or wikilinks and page URLs will disagree.
- **Obsidian syntax** is handled by `src/lib/remark-obsidian.mjs`: `[[note]]`, `[[note|alias]]`, `[[note#heading]]` link to posts; links to unpublished notes render as plain text (no broken links); `![[img.png|300]]` becomes `<img src="/attachments/img.png" width="300">`.
- **Filenames**: macOS may give NFD-normalized Chinese filenames; everything is normalized to NFC before comparing.
- **Images**: looked up by filename anywhere in the vault (the vault's attachment folder `b - Attachments` wins on duplicates) and stored flat in `public/attachments/`, so two images with the same name collide.
- **iCloud**: evicted files exist only as `.<name>.icloud` placeholders. The publish script triggers `brctl download` and waits (fails after 60s) before copying.
