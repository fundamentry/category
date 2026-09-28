import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Failure, type Result, Success } from '@fundamentry/coproduct';

import { Bind } from './Bind.js';
import { Concat } from './Concat.js';
import { FallibleSingle } from './FallibleSingle.js';
import { More } from './More.js';
import { type Path } from './Path.js';
import { Single } from './Single.js';

describe('Path', () => {
  describe('apply', () => {
    describe('when paths are composed', () => {
      const input = Symbol('input');
      const afterA = Symbol('after a');
      const afterB = Symbol('after b');
      const afterC = Symbol('after c');
      const afterD = Symbol('after d');
      const fa = vi.fn(() => afterA);
      const fb = vi.fn(() => afterB);
      const fc = vi.fn(() => afterC);
      const fd = vi.fn(() => afterD);
      const a = new Single(fa);
      const b = new Single(fb);
      const c = new Single(fc);
      const d = new Single(fd);

      beforeEach(() => {
        vi.clearAllMocks();
      });

      it.each([
        ['left-nested', () => new Concat(new Concat(new Concat(a, b), c), d)],
        ['right-nested', () => new Concat(a, new Concat(b, new Concat(c, d)))],
        ['balanced', () => new Concat(new Concat(a, b), new Concat(c, d))],
      ])('must apply each function of a %s path in order', (_, path) => {
        const result = path().apply(input);

        expect(fa).toHaveBeenCalledExactlyOnceWith(input);
        expect(fb).toHaveBeenCalledExactlyOnceWith(afterA);
        expect(fc).toHaveBeenCalledExactlyOnceWith(afterB);
        expect(fd).toHaveBeenCalledExactlyOnceWith(afterC);
        expect(result).toBe(afterD);
      });

      it('must apply a shared path once for each occurrence', () => {
        const shared = new Concat(a, b);

        const result = new Concat(shared, shared).apply(input);

        expect(fa).toHaveBeenCalledTimes(2);
        expect(fa).toHaveBeenNthCalledWith(1, input);
        expect(fa).toHaveBeenNthCalledWith(2, afterB);
        expect(fb).toHaveBeenCalledTimes(2);
        expect(fb).toHaveBeenNthCalledWith(1, afterA);
        expect(fb).toHaveBeenNthCalledWith(2, afterA);
        expect(result).toBe(afterB);
      });

      describe('when a function in the path fails', () => {
        const failure = new Failure(Symbol('error'));
        const ffail = vi.fn(() => failure);
        const fail = new FallibleSingle(ffail);

        it.each([
          [
            'left-nested',
            () => new Concat(new Concat(new Concat(a, fail), b), c),
          ],
          [
            'right-nested',
            () => new Concat(a, new Concat(fail, new Concat(b, c))),
          ],
          ['balanced', () => new Concat(new Concat(a, fail), new Concat(b, c))],
        ])(
          'must return the failure of a %s path without applying the rest',
          (_, path) => {
            const result = path().apply(input);

            expect(fa).toHaveBeenCalledExactlyOnceWith(input);
            expect(ffail).toHaveBeenCalledExactlyOnceWith(afterA);
            expect(fb).not.toHaveBeenCalled();
            expect(fc).not.toHaveBeenCalled();
            expect(result).toBe(failure);
          }
        );
      });
    });

    describe('when the path is deep', () => {
      const depth = 100_000;
      const increment = new Single((value: number) => value + 1);
      const steps = Array.from({ length: depth - 1 }, () => increment);

      it('must not overflow the stack when nested to the left', () => {
        const path = steps.reduce<Path<number, number, never>>(
          (acc, step) => new Concat(acc, step),
          increment
        );

        expect(path.apply(0)).toBe(depth);
      });

      it('must not overflow the stack when nested to the right', () => {
        const path = steps.reduceRight<Path<number, number, never>>(
          (acc, step) => new Concat(step, acc),
          increment
        );

        expect(path.apply(0)).toBe(depth);
      });

      it('must not overflow the stack when joining two deep paths', () => {
        const left = steps.reduce<Path<number, number, never>>(
          (acc, step) => new Concat(acc, step),
          increment
        );
        const right = steps.reduceRight<Path<number, number, never>>(
          (acc, step) => new Concat(step, acc),
          increment
        );

        expect(new Concat(left, right).apply(0)).toBe(2 * depth);
      });

      it('must not overflow the stack when binding deeply', () => {
        const path = steps.reduce<Path<number, number, never>>(
          inner => new Bind(value => new More(value, inner)),
          increment
        );

        expect(path.apply(0)).toBe(1);
      });

      it('must finish right away when failing at the start of a deep path', () => {
        const failure = new Failure(Symbol('error'));
        const rest = vi.fn((value: number) => value + 1);
        const path = steps.reduce<Path<number, number, Failure<symbol>>>(
          (acc, step) => new Concat(acc, step),
          new Concat<number, number, number, Failure<symbol>>(
            new FallibleSingle(() => failure),
            new Single(rest)
          )
        );

        expect(path.apply(0)).toBe(failure);
        expect(rest).not.toHaveBeenCalled();
      });
    });

    it('must thread each intermediate type through to the next function', () => {
      const length: Path<string, number, never> = new Single(
        value => value.length
      );
      const even: Path<number, boolean, never> = new Single(
        value => value % 2 === 0
      );

      const path = new Concat(length, even);

      expectTypeOf(path).toExtend<Path<string, boolean, never>>();
      expectTypeOf(path.apply('abcd')).toEqualTypeOf<boolean>();
      expect(path.apply('abcd')).toBe(true);
    });

    it('must widen the exit type to the union of the exit types in the path', () => {
      const parse = new FallibleSingle(
        (value: string): Result<number, 'nan'> =>
          Number.isNaN(Number(value))
            ? new Failure('nan')
            : new Success(Number(value))
      );
      const even = new FallibleSingle(
        (value: number): Result<boolean, 'odd'> =>
          value % 2 === 0 ? new Success(true) : new Failure('odd')
      );

      const path = new Concat<string, number, boolean, Failure<'nan' | 'odd'>>(
        parse,
        even
      );

      expectTypeOf(path).toExtend<
        Path<string, boolean, Failure<'nan' | 'odd'>>
      >();
      expectTypeOf(path).not.toExtend<Path<string, boolean, Failure<'nan'>>>();
      expectTypeOf(path).not.toExtend<Path<string, boolean, Failure<'odd'>>>();
    });

    it('must be contravariant in its domain', () => {
      expectTypeOf<Path<unknown, string, never>>().toExtend<
        Path<string, string, never>
      >();
      expectTypeOf<Path<string, string, never>>().not.toExtend<
        Path<unknown, string, never>
      >();
    });

    it('must be covariant in its codomain', () => {
      expectTypeOf<Path<string, string, never>>().toExtend<
        Path<string, unknown, never>
      >();
      expectTypeOf<Path<string, unknown, never>>().not.toExtend<
        Path<string, string, never>
      >();
    });

    it('must be covariant in its exit', () => {
      expectTypeOf<Path<string, string, never>>().toExtend<
        Path<string, string, string>
      >();
      expectTypeOf<Path<string, string, string>>().not.toExtend<
        Path<string, string, never>
      >();
    });
  });
});
