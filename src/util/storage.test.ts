import { createVersionedCodec } from './storage';

describe('createVersionedCodec', () => {
  interface Doc {
    a: number;
    b: string;
  }
  const DEFAULTS: Doc = { a: 1, b: 'x' };
  const migrate = (doc: unknown): Doc => {
    const r = (typeof doc === 'object' && doc !== null ? doc : {}) as Record<string, unknown>;

    return {
      a: typeof r.a === 'number' ? r.a : DEFAULTS.a,
      b: typeof r.b === 'string' ? r.b : DEFAULTS.b
    };
  };
  const codec = createVersionedCodec(1, migrate);

  it('round-trips a document through the envelope', () => {
    const stored = codec.stringify({ a: 5, b: 'y' });

    expect(JSON.parse(stored)).toEqual({ schemaVersion: 1, doc: { a: 5, b: 'y' } });
    expect(codec.parse(stored)).toEqual({ a: 5, b: 'y' });
  });

  it('migrates legacy bare documents (no envelope)', () => {
    expect(codec.parse(JSON.stringify({ a: 7 }))).toEqual({ a: 7, b: 'x' });
  });

  it('returns defaults for unparseable data', () => {
    expect(codec.parse('{{{not json')).toEqual(DEFAULTS);
  });

  it('migrates garbage envelope contents', () => {
    expect(codec.parse(JSON.stringify({ schemaVersion: 1, doc: 'garbage' }))).toEqual(DEFAULTS);
    expect(codec.parse(JSON.stringify({ schemaVersion: 99, doc: { a: 2 } }))).toEqual({ a: 2, b: 'x' });
  });

  it('falls back to defaults if migrate throws', () => {
    const throwing = createVersionedCodec<Doc>(1, (doc: unknown) => {
      if (doc !== undefined) {
        throw new Error('boom');
      }

      return DEFAULTS;
    });

    expect(throwing.parse(JSON.stringify({ a: 1 }))).toEqual(DEFAULTS);
  });
});
