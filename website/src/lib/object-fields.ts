export function optionalProperty<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value,
  } as Record<Key, Value>;
}
