import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Done, value } from './Done.js';
import { More } from './More.js';
import { step, stepThen } from './Path.js';
import { next } from './Pending.js';
import { Single } from './Single.js';

describe('Single', () => {
  const input = Symbol('input');

  describe('constructor', () => {
    it('must not call the function', () => {
      const fn = vi.fn();

      expect(new Single(fn)).toBeInstanceOf(Single);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('apply', () => {
    it('must call the function with the argument and return its result as is', () => {
      const output = Symbol('output');
      const fn = vi.fn(() => output);

      const result = new Single(fn).apply(input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(output);
    });

    it('must call the function again on every application', () => {
      const first = Symbol('first');
      const second = Symbol('second');
      const fn = vi.fn((arg: symbol) => arg);
      const single = new Single(fn);

      expect(single.apply(first)).toBe(first);
      expect(single.apply(second)).toBe(second);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, first);
      expect(fn).toHaveBeenNthCalledWith(2, second);
    });

    it('must return the result type of the function without an exit type', () => {
      const result = new Single((arg: symbol) => arg).apply(input);

      expectTypeOf(result).toEqualTypeOf<symbol>();
    });

    it('must propagate an error thrown by the function', () => {
      const error = new Error('Oops!');

      expect(() =>
        new Single(() => {
          throw error;
        }).apply(input)
      ).toThrow(error);
    });
  });

  describe('step', () => {
    it('must call the function with the argument and finish in a single step with its result', () => {
      const output = Symbol('output');
      const fn = vi.fn(() => output);

      const result = new Single(fn)[step](input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      assert(result instanceof Done);
      expect(result[value]()).toBe(output);
    });
  });

  describe('stepThen', () => {
    it('must call the function and continue with the rest of the path', () => {
      const intermediate = Symbol('intermediate');
      const fn = vi.fn(() => intermediate);
      const done = new Done(Symbol('output'));
      const rest = new Single(vi.fn());
      const restStep = vi.spyOn(rest, step).mockReturnValue(done);

      const result = new Single(fn)[stepThen](input, rest);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      expect(restStep).not.toHaveBeenCalled();
      assert(result instanceof More);
      expect(result[next]()).toBe(done);
      expect(restStep).toHaveBeenCalledExactlyOnceWith(intermediate);
    });

    it('must propagate an error thrown by the function', () => {
      const error = new Error('Oops!');

      expect(() =>
        new Single(() => {
          throw error;
        })[stepThen](input, new Single(vi.fn()))
      ).toThrow(error);
    });
  });
});
