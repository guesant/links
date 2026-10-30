import { optionalProperty } from './object-fields.ts';
import type { EditorialEntry, FederationItem, SiteData } from './site-data.ts';
import {
  array,
  optionalBoolean,
  optionalString,
  record,
  requiredText,
  strings,
  validateTextMap,
  type UnknownRecord,
} from './validation-primitives.ts';

function validateEditorialLabels(
  value: unknown,
  label: string,
): EditorialEntry['labels'] {
  const source = record(value, label);

  const labels: EditorialEntry['labels'] = {};

  for (const [
    language,
    rawLabel,
  ] of Object.entries(source)) {
    const localized = record(rawLabel, `${label}.${language}`);

    const title = requiredText(localized.title, `${label}.${language}.title`);

    if (
      localized.description !== undefined &&
      typeof localized.description !== 'string'
    ) {
      throw new Error(`Invalid ${label}.${language}.description`);
    }

    labels[language] = {
      title,
      ...optionalProperty('description', localized.description),
    };
  }

  return labels;
}

function validateEditorialOptions(item: UnknownRecord, label: string): void {
  for (const flag of [
    'enabled',
    'public',
    'private',
    'draft',
  ]) {
    if (item[flag] !== undefined && typeof item[flag] !== 'boolean') {
      throw new Error(`Invalid ${label}.${flag}`);
    }
  }

  for (const key of [
    'url',
    'group',
    'status',
    'updated',
  ] as const) {
    if (item[key] !== undefined && typeof item[key] !== 'string') {
      throw new Error(`Invalid ${label}.${key}`);
    }
  }

  if (
    typeof item.url === 'string' &&
    /^\s*(javascript|data|vbscript):/i.test(item.url)
  ) {
    throw new Error(`Invalid ${label}.url`);
  }
}

function validateEditorialEntry(
  section: string,
  index: number,
  rawItem: unknown,
): EditorialEntry {
  const itemLabel = `editorial.entries.${section}[${index}]`;

  const item = record(rawItem, itemLabel);

  const id = requiredText(item.id, `${itemLabel}.id`);

  const labels = validateEditorialLabels(item.labels, `${itemLabel}.labels`);

  validateEditorialOptions(item, itemLabel);

  const url = optionalString(item.url, `${itemLabel}.url`);

  const group = optionalString(item.group, `${itemLabel}.group`);

  const status = optionalString(item.status, `${itemLabel}.status`);

  const updated = optionalString(item.updated, `${itemLabel}.updated`);

  const enabled = optionalBoolean(item.enabled, `${itemLabel}.enabled`);

  const isPublic = optionalBoolean(item.public, `${itemLabel}.public`);

  const isPrivate = optionalBoolean(item.private, `${itemLabel}.private`);

  const draft = optionalBoolean(item.draft, `${itemLabel}.draft`);

  const resolveTags = () => {
    if (item.tags === undefined) {
      return undefined;
    }

    return strings(item.tags, `${itemLabel}.tags`);
  };

  const tags = resolveTags();

  return {
    id,
    labels,
    ...optionalProperty('url', url),
    ...optionalProperty('tags', tags),
    ...optionalProperty('group', group),
    ...optionalProperty('status', status),
    ...optionalProperty('updated', updated),
    ...optionalProperty('enabled', enabled),
    ...optionalProperty('public', isPublic),
    ...optionalProperty('private', isPrivate),
    ...optionalProperty('draft', draft),
  };
}

export function validateEditorial(value: unknown): SiteData['editorial'] {
  const editorial = record(value, 'editorial data');

  const rawEntries = record(editorial.entries, 'editorial.entries');

  const rawUI = record(editorial.ui, 'editorial.ui');

  const rawNow = record(editorial.now, 'editorial.now');

  const entries: Record<string, EditorialEntry[]> = {};

  const ui: Record<string, Record<string, string>> = {};

  const now: Record<string, Record<string, string>> = {};

  for (const [
    locale,
    rawUIEntry,
  ] of Object.entries(rawUI)) {
    ui[locale] = validateTextMap(rawUIEntry, `editorial.ui.${locale}`);
  }

  for (const [
    locale,
    rawNowEntry,
  ] of Object.entries(rawNow)) {
    now[locale] = validateTextMap(rawNowEntry, `editorial.now.${locale}`);
  }

  for (const [
    section,
    rawItems,
  ] of Object.entries(rawEntries)) {
    entries[section] = array(rawItems, `editorial.entries.${section}`).map(
      (rawItem, index) => {
        return validateEditorialEntry(section, index, rawItem);
      },
    );
  }

  return {
    entries,
    ui,
    now,
  };
}

export function validateCredits(value: unknown): SiteData['credits'] {
  const credits = record(value, 'credits data');

  const licenses = record(credits.licenses, 'credits.licenses');

  const validatedLicenses: SiteData['credits']['licenses'] = {};

  for (const [
    id,
    rawLicense,
  ] of Object.entries(licenses)) {
    const license = record(rawLicense, `credits.licenses.${id}`);

    validatedLicenses[id] = {
      name: requiredText(license.name, `credits.licenses.${id}.name`),
      url: requiredText(license.url, `credits.licenses.${id}.url`),
      text: requiredText(license.text, `credits.licenses.${id}.text`),
    };
  }

  const entries = array(credits.entries, 'credits.entries').map(
    (rawEntry, index) => {
      const entry = record(rawEntry, `credits.entries[${index}]`);

      return {
        id: requiredText(entry.id, `credits.entries[${index}].id`),
        name: requiredText(entry.name, `credits.entries[${index}].name`),
        authors: requiredText(
          entry.authors,
          `credits.entries[${index}].authors`,
        ),
        license: requiredText(
          entry.license,
          `credits.entries[${index}].license`,
        ),
        official_url: requiredText(
          entry.official_url,
          `credits.entries[${index}].official_url`,
        ),
      };
    },
  );

  const licenseIDs = new Set(Object.keys(validatedLicenses));

  for (const entry of entries) {
    if (!licenseIDs.has(entry.license)) {
      throw new Error(`Unknown credit license: ${entry.license}`);
    }
  }

  return {
    licenses: validatedLicenses,
    entries,
  };
}

function validateNumericMap(
  value: unknown,
  label: string,
): Record<string, number> {
  const source = record(value, label);

  const output: Record<string, number> = {};

  for (const [
    key,
    entry,
  ] of Object.entries(source)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) {
      throw new Error(
        `Invalid ${label}.${key}: expected a non-negative number`,
      );
    }

    output[key] = entry;
  }

  return output;
}

export function validateStatistics(value: unknown): SiteData['statistics'] {
  const statistics = record(value, 'statistics data');

  const output: SiteData['statistics'] = {};

  for (const [
    id,
    rawEntry,
  ] of Object.entries(statistics)) {
    const entry = record(rawEntry, `statistics.${id}`);

    const metrics = validateNumericMap(
      entry.metrics,
      `statistics.${id}.metrics`,
    );

    const resolveAvailable = () => {
      if (entry.available === undefined) {
        return undefined;
      }

      return validateNumericMap(entry.available, `statistics.${id}.available`);
    };

    const available = resolveAvailable();

    output[id] = {
      username: requiredText(entry.username, `statistics.${id}.username`),
      profile_url: requiredText(
        entry.profile_url,
        `statistics.${id}.profile_url`,
      ),
      provider: requiredText(entry.provider, `statistics.${id}.provider`),
      updated_at: requiredText(entry.updated_at, `statistics.${id}.updated_at`),
      metrics,
      ...optionalProperty('available', available),
    };
  }

  return output;
}

function federationType(value: unknown, label: string): FederationItem['type'] {
  switch (requiredText(value, label)) {
    case 'post':
      return 'post';

    case 'case':
      return 'case';

    case 'project':
      return 'project';

    case 'skill':
      return 'skill';

    case 'experience':
      return 'experience';

    case 'education':
      return 'education';

    default:
      throw new Error(`Invalid ${label}`);
  }
}

function validateFederationItem(
  rawItem: unknown,
  index: number,
  identities: Set<string>,
): FederationItem {
  const label = `federation.items[${index}]`;

  const item = record(rawItem, label);

  const id = requiredText(item.id, `${label}.id`);

  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(id)) {
    throw new Error(`Invalid ${label}.id`);
  }

  const source = requiredText(item.source, `${label}.source`);

  if (source !== 'blog' && source !== 'resume') {
    throw new Error(`Invalid ${label}.source`);
  }

  const language = requiredText(item.language, `${label}.language`);

  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(language)) {
    throw new Error(`Invalid ${label}.language`);
  }

  const type = federationType(item.type, `${label}.type`);

  const identity = `${source}:${id}:${language}`;

  if (identities.has(identity)) {
    throw new Error(`Duplicate federation item: ${identity}`);
  }

  identities.add(identity);

  const title = requiredText(item.title, `${label}.title`);

  if (typeof item.summary !== 'string' || item.summary.length > 12000) {
    throw new Error(`Invalid ${label}.summary`);
  }

  const summary = item.summary;

  const rawURL = requiredText(item.url, `${label}.url`);

  const url = new URL(rawURL);

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`Invalid ${label}.url`);
  }

  const tags = strings(item.tags, `${label}.tags`);

  const metadata = validateFederationMetadata(
    item.metadata,
    label,
    source,
    type,
  );

  return {
    id,
    source,
    language,
    type,
    title,
    summary,
    url: url.href,
    tags,
    metadata,
  };
}

function validateFederationMetadata(
  value: unknown,
  label: string,
  source: FederationItem['source'],
  type: FederationItem['type'],
): FederationItem['metadata'] {
  const raw = record(value, `${label}.metadata`);

  const allowed = new Set([
    'date',
    'updated',
    'categories',
    'position',
    'degree',
    'area',
    'start_date',
    'end_date',
    'content_url',
  ]);

  const metadata: FederationItem['metadata'] = {};

  for (const [
    key,
    entry,
  ] of Object.entries(raw)) {
    if (!allowed.has(key)) {
      continue;
    }

    if (key === 'categories') {
      metadata[key] = strings(entry, `${label}.metadata.categories`);
      continue;
    }

    const field = requiredText(entry, `${label}.metadata.${key}`);

    if (key === 'content_url') {
      metadata[key] = validateContentURL(field, label, source, type);
      continue;
    }

    metadata[key] = field;
  }

  return metadata;
}

function validateContentURL(
  value: string,
  label: string,
  source: FederationItem['source'],
  type: FederationItem['type'],
): string {
  const url = new URL(value);

  const allowedHosts = [
    'github.com',
    'gitlab.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
  ];

  if (
    source !== 'resume' ||
    type !== 'project' ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !allowedHosts.includes(url.hostname)
  ) {
    throw new Error(`Invalid ${label}.metadata.content_url`);
  }

  return url.href;
}

export function validateFederation(value: unknown): SiteData['federation'] {
  const feed = record(value, 'federation data');

  if (feed.version !== 1) {
    throw new Error('Invalid federation.version');
  }

  const identities = new Set<string>();

  const items = array(feed.items, 'federation.items').map((item, index) => {
    return validateFederationItem(item, index, identities);
  });

  return {
    version: 1,
    items,
  };
}
