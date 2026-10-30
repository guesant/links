import { loadPageData } from '$lib/page-data.server.ts';
import { getSiteData, routeEntries } from '$lib/site-data.server.ts';
import type { PageLoadData } from '$lib/site-data.ts';

export const prerender = true;

export const trailingSlash = 'always';

export async function entries(): Promise<Array<{ path: string }>> {
  const data = await getSiteData();

  return routeEntries(data).map((path) => {
    return {
      path,
    };
  });
}

export async function load({
  params,
}: {
  params: { path?: string };
}): Promise<PageLoadData> {
  return loadPageData(params.path || '');
}
