import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { type Failure, type Result, Success } from '@fundamentry/coproduct';

import { Bind } from './Bind.js';
import { Concat } from './Concat.js';
import { Done } from './Done.js';
import { FallibleSingle } from './FallibleSingle.js';
import { More } from './More.js';
import { type Path, step, stepThen } from './Path.js';
import { next, Pending } from './Pending.js';
import { Single } from './Single.js';

describe('Bind', () => {
  const input = Symbol('input');

  describe('constructor', () => {
    it('must not choose a path', () => {
      const route = vi.fn();

      expect(new Bind(route)).toBeInstanceOf(Bind);
      expect(route).not.toHaveBeenCalled();
    });

    it('must infer the exit type of the chosen path', () => {
      const chosen: Path<symbol, symbol, never> = new Single(vi.fn());

      const path = new Bind((arg: symbol) => new More(arg, chosen));

      expectTypeOf(path).toEqualTypeOf<Bind<symbol, symbol, never>>();
    });
  });

  describe('apply', () => {
    it('must apply the path chosen by the route to the value it chose', () => {
      const chosen = Symbol('chosen');
      const output = Symbol('output');
      const fn = vi.fn(() => output);
      const route = vi.fn(() => new More(chosen, new Single(fn)));

      const result = new Bind(route).apply(input);

      expect(route).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(chosen);
      expect(result).toBe(output);
    });

    it.each([
      ['on its own', (path: Path<symbol, symbol, never>) => path],
      [
        'as a prefix',
        (path: Path<symbol, symbol, never>) =>
          new Concat(path, new Single((arg: symbol) => arg)),
      ],
    ])('must choose a path again on every application %s', (_, wrap) => {
      const first = Symbol('first');
      const second = Symbol('second');
      const route = vi.fn(
        (arg: symbol) => new More(arg, new Single((chosen: symbol) => chosen))
      );
      const path = wrap(new Bind(route));

      expect(path.apply(first)).toBe(first);
      expect(path.apply(second)).toBe(second);
      expect(route).toHaveBeenCalledTimes(2);
      expect(route).toHaveBeenNthCalledWith(1, first);
      expect(route).toHaveBeenNthCalledWith(2, second);
    });

    it('must return the value type or exit type of the chosen path', () => {
      const result = new Bind(
        (arg: symbol) =>
          new More(
            arg,
            new FallibleSingle(
              (chosen): Result<symbol, symbol> => new Success(chosen)
            )
          )
      ).apply(input);

      expectTypeOf(result).toEqualTypeOf<symbol | Failure<symbol>>();
    });

    it('must propagate an error thrown by the route', () => {
      const error = new Error('Oops!');

      expect(() =>
        new Bind(() => {
          throw error;
        }).apply(input)
      ).toThrow(error);
    });
  });

  describe('step', () => {
    it('must call the route with the argument and return its step as is', () => {
      const more = new More(Symbol('value'), new Single(vi.fn()));
      const route = vi.fn(() => more);

      const result = new Bind(route)[step](input);

      expect(route).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(more);
    });
  });

  describe('stepThen', () => {
    it('must call the route and continue on the chosen path and then the rest', () => {
      const chosen = Symbol('chosen');
      const path = new Single(vi.fn());
      const rest = new Single(vi.fn());
      const done = new Done(Symbol('output'));
      const pathStepThen = vi.spyOn(path, stepThen).mockReturnValue(done);
      const route = vi.fn(() => new More(chosen, path));

      const result = new Bind(route)[stepThen](input, rest);

      expect(route).toHaveBeenCalledExactlyOnceWith(input);
      expect(pathStepThen).not.toHaveBeenCalled();
      assert(result instanceof Pending);
      expect(result[next]()).toBe(done);
      expect(pathStepThen).toHaveBeenCalledExactlyOnceWith(
        chosen,
        expect.any(Single)
      );
      expect(pathStepThen.mock.lastCall?.[1]).toBe(rest);
    });

    it('must propagate an error thrown by the route', () => {
      const error = new Error('Oops!');

      expect(() =>
        new Bind(() => {
          throw error;
        })[stepThen](input, new Single(vi.fn()))
      ).toThrow(error);
    });
  });
});
