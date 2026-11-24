import type { APIRoute } from 'astro';
import { renderArticleImage } from '../../lib/social-card';
import { getPosts, type Post } from '../../utils/posts';

export async function getStaticPaths() {
  return (await getPosts()).map(post => ({ params: { id: post.id }, props: { post } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Post };
  const image = await renderArticleImage(post.data.title, post.data.tags);
  return new Response(Uint8Array.from(image), { headers: { 'Content-Type': 'image/png' } });
};
