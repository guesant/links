export function destinationFor(config, item, locale, interfaceName) {
  const url = item.url?.trim() || '#';

  const external = /^(https?:|mailto:|tel:)/i.test(url);

  let thirdParty = false;

  if (/^https?:/i.test(url)) {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');

    thirdParty = !config.site.first_party_domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  }

  let href = url;

  if (!external && interfaceName === 'terminal') {
    const prefix = `/${locale}/`;

    if (href.startsWith(prefix)) {
      const suffix = href.slice(prefix.length);

      href = `${prefix}terminal/${suffix === 'agora/' ? 'now/' : suffix}`;
    }
  }

  const target = item.target || (external ? '_blank' : '_self');

  return {
    href,
    external,
    thirdParty,
    target,
    rel: target === '_blank' ? 'noopener noreferrer' : undefined,
    display: url.replace(/^mailto:/i, ''),
  };
}
