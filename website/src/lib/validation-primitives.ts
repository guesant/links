export type UnknownRecord = Record<string, unknown>;

export function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object`);
  }

  return value as UnknownRecord;
}

export function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string`);
  }
}

export function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an array`);
  }

  return value;
}

export function strings(value: unknown, label: string): string[] {
  return array(value, label).map((entry, index) => {
    text(entry, `${label}[${index}]`);

    return entry;
  });
}

export function optionalBoolean(
  value: unknown,
  label: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${label}`);
  }

  return value;
}

export function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${label}`);
  }

  return value;
}

export function optionalString(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Invalid ${label}`);
  }

  return value;
}

export function requiredText(value: unknown, label: string): string {
  text(value, label);

  return value;
}

export function validateTextMap(
  value: unknown,
  label: string,
): Record<string, string> {
  const source = record(value, label);

  const output: Record<string, string> = {};

  for (const [
    key,
    entry,
  ] of Object.entries(source)) {
    if (typeof entry !== 'string') {
      throw new Error(`Invalid ${label}.${key}: expected a string`);
    }

    output[key] = entry;
  }

  return output;
}
