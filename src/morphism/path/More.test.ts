import { describe, expect, it, vi } from 'vitest';

import { Done } from './Done.js';
import { More } from './More.js';
import { step } from './Path.js';
import { next } from './Pending.js';
import { unpack } from './Route.js';
import { Single } from './Single.js';

describe('More', () => {
  const input = Symbol('input');

  describe('constructor', () => {
    it('must not apply the path', () => {
      const fn = vi.fn();

      expect(new More(input, new Single(fn))).toBeInstanceOf(More);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('next', () => {
    it('must take the first step of the path with its value and return it as is', () => {
      const path = new Single(vi.fn());
      const done = new Done(Symbol('output'));
      const first = vi.spyOn(path, step).mockReturnValue(done);

      const result = new More(input, path)[next]();

      expect(first).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(done);
    });
  });

  describe('unpack', () => {
    it('must pass its value and path to the continuation and return its result as is', () => {
      const path = new Single(vi.fn());
      const output = Symbol('output');
      const continuation = vi.fn((_value: unknown, _path: unknown) => output);

      const result = new More(input, path)[unpack](continuation);

      expect(continuation).toHaveBeenCalledExactlyOnceWith(
        input,
        expect.any(Single)
      );
      expect(continuation.mock.lastCall?.[1]).toBe(path);
      expect(result).toBe(output);
    });

    it('must not apply the path', () => {
      const fn = vi.fn();

      new More(input, new Single(fn))[unpack](vi.fn());

      expect(fn).not.toHaveBeenCalled();
    });

    it('must propagate an error thrown by the continuation', () => {
      const error = new Error('Oops!');

      expect(() =>
        new More(input, new Single(vi.fn()))[unpack](() => {
          throw error;
        })
      ).toThrow(error);
    });
  });
});
