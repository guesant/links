export type LinkNavigation = {
  external: boolean;
  target: '_blank' | '_self';
  rel?: string;
};

function currentOrigin(): string {
  if (typeof window === 'undefined') {
    return 'https://guesant.net';
  }

  return window.location.origin;
}

export function linkNavigation(
  href: string,
  origin: string = currentOrigin(),
): LinkNavigation {
  const url: URL = new URL(href, origin);

  const external: boolean =
    ['http:', 'https:'].includes(url.protocol) &&
    url.origin !== new URL(origin).origin;

  if (external) {
    return { external, target: '_blank', rel: 'noopener noreferrer' };
  }

  return { external, target: '_self' };
}
