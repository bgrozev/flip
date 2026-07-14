import { CODEC_JSON } from './storage';

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
