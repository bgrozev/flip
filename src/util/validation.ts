/**
 * Check if a number is within optional min/max bounds.
 */
export function isNumberInRange(num: number, min?: number, max?: number): boolean {
  const aboveMin = typeof min === 'undefined' || num >= min;
  const belowMax = typeof max === 'undefined' || num <= max;

  return aboveMin && belowMax;
}

/**
 * Generate a validation error message based on min/max constraints.
 */
export function getRangeErrorText(min?: number, max?: number): string {
  if (typeof min === 'number' && typeof max === 'number') {
    return `It must be between ${min} and ${max}.`;
  } else if (typeof min === 'number') {
    return `It must be at least ${min}.`;
  } else if (typeof max === 'number') {
    return `It must be at most ${max}.`;
  }

  return 'Invalid value.';
}
