import { CODEC_JSON, createVersionedCodec } from './storage';

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

describe('CODEC_JSON', () => {
  describe('parse', () => {
    it('parses valid JSON', () => {
      const result = CODEC_JSON.parse('{"foo": "bar"}');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns error object for invalid JSON', () => {
      const result = CODEC_JSON.parse('not json');
      expect(result).toEqual({ _error: 'parse failed' });
    });

    it('parses arrays', () => {
      const result = CODEC_JSON.parse('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('stringify', () => {
    it('stringifies objects', () => {
      const result = CODEC_JSON.stringify({ foo: 'bar' });
      expect(result).toBe('{"foo":"bar"}');
    });

    it('stringifies arrays', () => {
      const result = CODEC_JSON.stringify([1, 2, 3]);
      expect(result).toBe('[1,2,3]');
    });
  });
});
