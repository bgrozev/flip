import { getRangeErrorText, isNumberInRange } from './validation.js';

describe('isNumberInRange', () => {
    describe('with both min and max', () => {
        it('returns true when number is within range', () => {
            expect(isNumberInRange(5, 0, 10)).toBe(true);
            expect(isNumberInRange(0, 0, 10)).toBe(true);
            expect(isNumberInRange(10, 0, 10)).toBe(true);
        });

        it('returns false when number is below min', () => {
            expect(isNumberInRange(-1, 0, 10)).toBe(false);
        });

        it('returns false when number is above max', () => {
            expect(isNumberInRange(11, 0, 10)).toBe(false);
        });
    });

    describe('with only min', () => {
        it('returns true when number is at or above min', () => {
            expect(isNumberInRange(5, 0, undefined)).toBe(true);
            expect(isNumberInRange(0, 0, undefined)).toBe(true);
            expect(isNumberInRange(1000, 0, undefined)).toBe(true);
        });

        it('returns false when number is below min', () => {
            expect(isNumberInRange(-1, 0, undefined)).toBe(false);
        });
    });

    describe('with only max', () => {
        it('returns true when number is at or below max', () => {
            expect(isNumberInRange(5, undefined, 10)).toBe(true);
            expect(isNumberInRange(10, undefined, 10)).toBe(true);
            expect(isNumberInRange(-100, undefined, 10)).toBe(true);
        });

        it('returns false when number is above max', () => {
            expect(isNumberInRange(11, undefined, 10)).toBe(false);
        });
    });

    describe('with no constraints', () => {
        it('returns true for any number', () => {
            expect(isNumberInRange(0, undefined, undefined)).toBe(true);
            expect(isNumberInRange(-1000, undefined, undefined)).toBe(true);
            expect(isNumberInRange(1000, undefined, undefined)).toBe(true);
        });
    });
});

describe('getRangeErrorText', () => {
    it('returns between message when both min and max are defined', () => {
        expect(getRangeErrorText(0, 10)).toBe('It must be between 0 and 10.');
        expect(getRangeErrorText(1, 100)).toBe('It must be between 1 and 100.');
    });

    it('returns at least message when only min is defined', () => {
        expect(getRangeErrorText(0, undefined)).toBe('It must be at least 0.');
        expect(getRangeErrorText(5, undefined)).toBe('It must be at least 5.');
    });

    it('returns at most message when only max is defined', () => {
        expect(getRangeErrorText(undefined, 10)).toBe('It must be at most 10.');
        expect(getRangeErrorText(undefined, 100)).toBe('It must be at most 100.');
    });

    it('returns invalid message when neither is defined', () => {
        expect(getRangeErrorText(undefined, undefined)).toBe('Invalid value.');
    });

    it('handles non-number values as undefined', () => {
        expect(getRangeErrorText(null, 10)).toBe('It must be at most 10.');
        expect(getRangeErrorText(5, null)).toBe('It must be at least 5.');
        expect(getRangeErrorText('foo', 10)).toBe('It must be at most 10.');
    });
});
