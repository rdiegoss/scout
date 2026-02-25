import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('should run unit tests with vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support TypeScript types', () => {
    const value: string = 'hello';
    expect(typeof value).toBe('string');
  });
});
