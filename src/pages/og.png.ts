import type { APIRoute } from 'astro';
import { renderHomeImage } from '../lib/social-card';

export const GET: APIRoute = async () => {
  const image = await renderHomeImage();
  return new Response(Uint8Array.from(image), { headers: { 'Content-Type': 'image/png' } });
};
