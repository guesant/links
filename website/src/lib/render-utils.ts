import {
  resolveDestination,
  type LinkDocument,
  type LinkRecord,
} from './site-data.ts';

export function currentPage(active: boolean): 'page' | undefined {
  if (active) {
    return 'page';
  }

  return undefined;
}

export function enabledAttribute(enabled: boolean): true | undefined {
  if (enabled) {
    return true;
  }

  return undefined;
}

export function emptyAttribute(enabled: boolean): '' | undefined {
  if (enabled) {
    return '';
  }

  return undefined;
}

export function profileInitials(name: string): string {
  const parts: string[] = name.trim().split(/\s+/);

  const first: string = parts[0]?.[0] || '';

  if (parts.length < 2) {
    return first;
  }

  return `${first}${parts.at(-1)?.[0] || ''}`;
}

export function destinationFor(
  config: Pick<LinkDocument, 'site'>,
  item: Pick<LinkRecord, 'url' | 'target'>,
  locale: string,
  interfaceName: 'minecraft' | 'terminal',
) {
  const destination = resolveDestination(config.site, item);

  let href = destination.href;

  if (!destination.external && interfaceName === 'terminal') {
    const prefix = `/${locale}/`;

    if (href.startsWith(prefix) && !href.startsWith(`${prefix}terminal/`)) {
      const suffix = href.slice(prefix.length);

      const resolveTerminalSuffix = (): string => {
        if (suffix === 'agora/') {
          return 'now/';
        }

        return suffix;
      };

      href = `${prefix}terminal/${resolveTerminalSuffix()}`;
    }
  }

  return {
    ...destination,
    href,
  };
}
