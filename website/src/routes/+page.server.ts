import { loadPageData } from '$lib/page-data.server.ts';
import { getSiteData } from '$lib/site-data.server.ts';
import type { PageLoadData } from '$lib/site-data.ts';

export async function load(): Promise<PageLoadData> {
  const data = await getSiteData();

  return loadPageData(data.links.language_preference.default, true);
}
