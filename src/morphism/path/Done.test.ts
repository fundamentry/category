import { describe, expect, it } from 'vitest';

import { Done, value } from './Done.js';

describe('Done', () => {
  describe('value', () => {
    it('must return its value as is', () => {
      const result = Symbol('value');

      expect(new Done(result)[value]()).toBe(result);
    });
  });
});
