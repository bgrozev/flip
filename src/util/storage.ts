/**
 * Centralized localStorage state management with migration support.
 * Handles partial state, old versions, and parse errors gracefully.
 */

type Codec<T> = {
  parse: (value: string) => T;
  stringify: (value: T) => string;
};

/**
 * Deep merge two objects. Source values override target values.
 * Arrays are replaced, not merged.
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  if (source === null || source === undefined) {
    return target;
  }

  if (typeof target !== 'object' || target === null) {
    return source as T;
  }

  if (Array.isArray(target)) {
    return source as T;
  }

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = (target as Record<string, unknown>)[key];

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * Creates a codec that safely parses JSON, merges with defaults, and handles errors.
 *
 * @param defaults - Default values to use when stored state is missing properties
 * @param validate - Optional validation function. Return false to reset to defaults.
 *
 * @example
 * const [state, setState] = useLocalStorageState<Settings>(
 *   'flip.settings',
 *   DEFAULT_SETTINGS,
 *   { codec: createSafeCodec(DEFAULT_SETTINGS) }
 * );
 */
export function createSafeCodec<T>(
  defaults: T,
  validate?: (value: unknown) => boolean
): Codec<T> {
  return {
    parse: (value: string): T => {
      try {
        const parsed = JSON.parse(value);

        // If validation function provided and fails, return defaults
        if (validate && !validate(parsed)) {
          console.warn('State validation failed, resetting to defaults');
          return defaults;
        }

        // If defaults is an object, deep merge to fill in missing properties
        if (typeof defaults === 'object' && defaults !== null && !Array.isArray(defaults)) {
          return deepMerge(defaults, parsed);
        }

        return parsed;
      } catch (error) {
        console.warn('Failed to parse stored state, resetting to defaults:', error);
        return defaults;
      }
    },
    stringify: (value: T): string => JSON.stringify(value)
  };
}

/**
 * Simple codec that just catches parse errors and returns defaults.
 * Use for arrays or simple values that don't need deep merging.
 */
export function createSimpleCodec<T>(defaults: T): Codec<T> {
  return {
    parse: (value: string): T => {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn('Failed to parse stored state, resetting to defaults:', error);
        return defaults;
      }
    },
    stringify: (value: T): string => JSON.stringify(value)
  };
}

// Re-export for backwards compatibility during migration
export const CODEC_JSON = {
  parse: (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return { _error: 'parse failed' };
    }
  },
  stringify: (value: unknown) => JSON.stringify(value)
};
