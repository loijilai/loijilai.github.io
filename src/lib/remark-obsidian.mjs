// Turns Obsidian syntax into normal markdown nodes at build time:
//   [[note]] / [[note|alias]] / [[note#heading]]  → link to the post, or plain text if unpublished
//   ![[image.png]] / ![[image.png|300]]          → <img src="/attachments/image.png">
//   ![[note]] (note embed)                        → treated like [[note]]
//   %% comment %%                                 → removed
import { visit, SKIP } from 'unist-util-visit';
import GithubSlugger from 'github-slugger';
import { buildPostsIndex } from './posts-index.mjs';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const WIKI = /(!?)\[\[([^\[\]]+?)\]\]/g;

export const ATTACHMENTS_URL = '/attachments/';

export function attachmentUrl(name) {
  return ATTACHMENTS_URL + encodeURIComponent(name.normalize('NFC'));
}

function parseTarget(inner) {
  const [targetPart, ...aliasParts] = inner.split('|');
  const alias = aliasParts.join('|').trim();
  const [note, ...headingParts] = targetPart.split('#');
  return { note: note.trim(), heading: headingParts.join('#').trim(), alias };
}

function linkNodes(inner, index) {
  const { note, heading, alias } = parseTarget(inner);
  const text = alias || (note && heading ? `${note} > ${heading}` : note || heading);
  const slug = index.get(note.normalize('NFC'));
  if (!slug) return { type: 'text', value: text }; // unpublished → no broken link
  // Same slugger Astro uses for heading ids, so [[note#heading]] anchors match.
  const hash = heading ? '#' + new GithubSlugger().slug(heading) : '';
  return {
    type: 'link',
    url: `/posts/${encodeURIComponent(slug)}/${hash}`,
    children: [{ type: 'text', value: text }],
  };
}

function imageNode(inner) {
  const [name, size] = inner.split('|').map((s) => s.trim());
  const file = name.split('/').pop();
  const node = { type: 'image', url: attachmentUrl(file), alt: file.replace(IMAGE_EXT, ''), title: null };
  const width = size?.match(/^(\d+)(?:x(\d+))?$/);
  if (width) {
    node.data = { hProperties: { width: width[1], ...(width[2] && { height: width[2] }) } };
  }
  return node;
}

export default function remarkObsidian() {
  return (tree) => {
    // Rebuilt per file so `astro dev` picks up newly published posts.
    const index = buildPostsIndex();

    visit(tree, 'text', (node, i, parent) => {
      if (!parent || i === undefined) return;
      let value = node.value.replace(/%%[\s\S]*?%%/g, '');
      if (!value.includes('[[')) {
        node.value = value;
        return;
      }
      const out = [];
      let last = 0;
      for (const m of value.matchAll(WIKI)) {
        if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
        const [, bang, inner] = m;
        const name = inner.split('|')[0].trim();
        out.push(bang && IMAGE_EXT.test(name) ? imageNode(inner) : linkNodes(inner, index));
        last = m.index + m[0].length;
      }
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
      parent.children.splice(i, 1, ...out);
      return [SKIP, i + out.length];
    });
  };
}
