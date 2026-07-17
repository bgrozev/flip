/**
 * Centralized localStorage state management with migration support.
 * Handles partial state, old versions, and parse errors gracefully.
 */

type Codec<T> = {
  parse: (value: string) => T;
  stringify: (value: T) => string;
};

/**
 * Envelope written to localStorage by versioned codecs:
 * `{ schemaVersion, doc }`. Legacy data is the bare document.
 */
interface VersionedEnvelope {
  schemaVersion: number;
  doc: unknown;
}

function isVersionedEnvelope(value: unknown): value is VersionedEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).schemaVersion === 'number' &&
    'doc' in value
  );
}

/**
 * Codec that wraps every persisted document in a schemaVersion envelope and
 * runs a validating migrate function on load. `migrate` must accept unknown
 * JSON (including undefined) and return a valid document without throwing;
 * as a last resort the codec falls back to `migrate(undefined)`.
 *
 * Legacy (pre-envelope) data is passed to `migrate` as version 0.
 */
export function createVersionedCodec<T>(
  schemaVersion: number,
  migrate: (doc: unknown, version: number) => T
): Codec<T> {
  const safeMigrate = (doc: unknown, version: number): T => {
    try {
      return migrate(doc, version);
    } catch (error) {
      console.warn('Failed to migrate stored state, resetting to defaults:', error);
      return migrate(undefined, 0);
    }
  };

  return {
    parse: (value: string): T => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(value);
      } catch (error) {
        console.warn('Failed to parse stored state, resetting to defaults:', error);
        return safeMigrate(undefined, 0);
      }

      if (isVersionedEnvelope(parsed)) {
        return safeMigrate(parsed.doc, parsed.schemaVersion);
      }

      // Legacy data: the bare document without an envelope
      return safeMigrate(parsed, 0);
    },
    stringify: (value: T): string => JSON.stringify({ schemaVersion, doc: value })
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
