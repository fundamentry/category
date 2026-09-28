import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Failure, type Result, Success } from '@fundamentry/coproduct';

import { Done, value } from './Done.js';
import { FallibleSingle } from './FallibleSingle.js';
import { More } from './More.js';
import { step, stepThen } from './Path.js';
import { next } from './Pending.js';
import { Single } from './Single.js';

describe('FallibleSingle', () => {
  const input = Symbol('input');

  describe('constructor', () => {
    it('must not call the function', () => {
      const fn = vi.fn();

      expect(new FallibleSingle(fn)).toBeInstanceOf(FallibleSingle);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('apply', () => {
    it('must call the function with the argument and return the value of its success', () => {
      const output = Symbol('output');
      const fn = vi.fn(() => new Success(output));

      const result = new FallibleSingle(fn).apply(input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(output);
    });

    it('must call the function with the argument and return its failure as is', () => {
      const failure = new Failure(Symbol('error'));
      const fn = vi.fn(() => failure);

      const result = new FallibleSingle(fn).apply(input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(failure);
    });

    it('must call the function again on every application', () => {
      const first = Symbol('first');
      const second = Symbol('second');
      const fn = vi.fn((arg: symbol) => new Success(arg));
      const fallible = new FallibleSingle(fn);

      expect(fallible.apply(first)).toBe(first);
      expect(fallible.apply(second)).toBe(second);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, first);
      expect(fn).toHaveBeenNthCalledWith(2, second);
    });

    it('must return the value type of the function or its failure', () => {
      const result = new FallibleSingle(
        (arg: symbol): Result<symbol, symbol> => new Success(arg)
      ).apply(input);

      expectTypeOf(result).toEqualTypeOf<symbol | Failure<symbol>>();
    });

    it('must propagate an error thrown by the function', () => {
      const error = new Error('Oops!');

      expect(() =>
        new FallibleSingle(() => {
          throw error;
        }).apply(input)
      ).toThrow(error);
    });
  });

  describe('step', () => {
    it('must call the function with the argument and finish in a single step with the value of a success', () => {
      const output = Symbol('output');
      const fn = vi.fn(() => new Success(output));

      const result = new FallibleSingle(fn)[step](input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      assert(result instanceof Done);
      expect(result[value]()).toBe(output);
    });

    it('must call the function with the argument and finish in a single step with its failure', () => {
      const failure = new Failure(Symbol('error'));
      const fn = vi.fn(() => failure);

      const result = new FallibleSingle(fn)[step](input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      assert(result instanceof Done);
      expect(result[value]()).toBe(failure);
    });
  });

  describe('stepThen', () => {
    it('must call the function and continue with the rest of the path on a success', () => {
      const intermediate = Symbol('intermediate');
      const fn = vi.fn(() => new Success(intermediate));
      const done = new Done(Symbol('output'));
      const rest = new Single(vi.fn());
      const restStep = vi.spyOn(rest, step).mockReturnValue(done);

      const result = new FallibleSingle(fn)[stepThen](input, rest);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      expect(restStep).not.toHaveBeenCalled();
      assert(result instanceof More);
      expect(result[next]()).toBe(done);
      expect(restStep).toHaveBeenCalledExactlyOnceWith(intermediate);
    });

    it('must call the function and exit the whole path with its failure', () => {
      const failure = new Failure(Symbol('error'));
      const fn = vi.fn(() => failure);

      const result = new FallibleSingle(fn)[stepThen](
        input,
        new Single(vi.fn())
      );

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      assert(result instanceof Done);
      expect(result[value]()).toBe(failure);
    });

    it('must propagate an error thrown by the function', () => {
      const error = new Error('Oops!');

      expect(() =>
        new FallibleSingle(() => {
          throw error;
        })[stepThen](input, new Single(vi.fn()))
      ).toThrow(error);
    });
  });
});
