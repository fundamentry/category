import {
  assert,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

import { Failure, type Result, Success } from '@fundamentry/coproduct';

import { Iso } from '#project/iso';
import { type Lens } from '#project/lens';
import { FallibleMorphism, Morphism } from '#project/morphism';

import { Prism } from './Prism.js';

describe('Prism', () => {
  const input = Symbol('input');
  const afterA = Symbol('after a');
  const afterB = Symbol('after b');
  const afterC = Symbol('after c');
  const beforeA = Symbol('before a');
  const beforeB = Symbol('before b');
  const beforeC = Symbol('before c');
  const previewA = vi.fn(() => new Success(afterA));
  const previewB = vi.fn(() => new Success(afterB));
  const previewC = vi.fn(() => new Success(afterC));
  const reviewA = vi.fn(() => beforeA);
  const reviewB = vi.fn(() => beforeB);
  const reviewC = vi.fn(() => beforeC);
  const a = Prism.of<symbol, symbol, unknown>(
    FallibleMorphism.of(previewA),
    Morphism.of(reviewA)
  );
  const b = Prism.of<symbol, symbol, unknown>(
    FallibleMorphism.of(previewB),
    Morphism.of(reviewB)
  );
  const c = Prism.of<symbol, symbol, unknown>(
    FallibleMorphism.of(previewC),
    Morphism.of(reviewC)
  );

  const failure = new Failure(Symbol('error'));
  const previewMiss = vi.fn(() => failure);
  const reviewMiss = vi.fn(() => Symbol('before miss'));
  const miss = Prism.of<symbol, symbol, symbol>(
    FallibleMorphism.of(previewMiss),
    Morphism.of(reviewMiss)
  );

  const number = Prism.of(
    FallibleMorphism.of((value: string): Result<number, 'nan'> =>
      Number.isNaN(Number(value))
        ? new Failure('nan')
        : new Success(Number(value))
    ),
    Morphism.of((value: number) => String(value))
  );
  const positive = Prism.of(
    FallibleMorphism.of((value: number): Result<number, 'negative'> =>
      value < 0 ? new Failure('negative') : new Success(value)
    ),
    Morphism.id<number>()
  );
  const predecessor = Prism.of(
    FallibleMorphism.of((value: number): Result<number, 'zero'> =>
      value > 0 ? new Success(value - 1) : new Failure('zero')
    ),
    Morphism.of((value: number) => value + 1)
  );
  const double = Morphism.of((value: number) => value * 2);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('of', () => {
    it('must not call either function', () => {
      const preview = vi.fn();
      const review = vi.fn();

      expect(
        Prism.of(FallibleMorphism.of(preview), Morphism.of(review))
      ).toBeInstanceOf(Prism);
      expect(preview).not.toHaveBeenCalled();
      expect(review).not.toHaveBeenCalled();
    });
  });

  describe('of with functions', () => {
    it('must preview and review with the functions as is', () => {
      const prism = Prism.of<symbol, symbol, unknown>(previewA, reviewA);

      const result = prism.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      assert(result.ok());
      expect(result.value()).toBe(afterA);
      expect(prism.review(input)).toBe(beforeA);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must not call either function', () => {
      expect(
        Prism.of<symbol, symbol, unknown>(previewA, reviewA)
      ).toBeInstanceOf(Prism);
      expect(previewA).not.toHaveBeenCalled();
      expect(reviewA).not.toHaveBeenCalled();
    });

    it('must infer the source, focus and error types', () => {
      expectTypeOf(
        Prism.of(
          (value: string): Result<number, 'nan'> => new Success(Number(value)),
          (value: number) => String(value)
        )
      ).toEqualTypeOf<Prism<string, number, 'nan'>>();
    });
  });

  describe('fromPredicate', () => {
    it('must preview the argument as is without building an error when the predicate holds', () => {
      const predicate = vi.fn(() => true);
      const toError = vi.fn();

      const result = Prism.fromPredicate(predicate, toError).preview(input);

      expect(predicate).toHaveBeenCalledExactlyOnceWith(input);
      expect(toError).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(input);
    });

    it('must fail with the error built for the argument when the predicate does not hold', () => {
      const error = Symbol('error');
      const predicate = vi.fn(() => false);
      const toError = vi.fn(() => error);

      const result = Prism.fromPredicate(predicate, toError).preview(input);

      expect(predicate).toHaveBeenCalledExactlyOnceWith(input);
      expect(toError).toHaveBeenCalledExactlyOnceWith(input);
      assert(!result.ok());
      expect(result.error()).toBe(error);
    });

    it('must review the value as is', () => {
      expect(Prism.fromPredicate(() => true, vi.fn()).review(input)).toBe(
        input
      );
    });

    it('must not call the predicate or build an error', () => {
      const predicate = vi.fn();
      const toError = vi.fn();

      expect(Prism.fromPredicate(predicate, toError)).toBeInstanceOf(Prism);
      expect(predicate).not.toHaveBeenCalled();
      expect(toError).not.toHaveBeenCalled();
    });

    it('must narrow the value before an iso wraps it', () => {
      const digits = Prism.fromPredicate(
        (value: number) => Number.isInteger(value) && value >= 0,
        () => 'negative' as const
      ).andThen(Iso.of((value: number) => String(value), Number));

      const found = digits.preview(42);
      const missing = digits.preview(-1);

      assert(found.ok());
      expect(found.value()).toBe('42');
      assert(!missing.ok());
      expect(missing.error()).toBe('negative');
      expect(digits.review('42')).toBe(42);
    });

    it('must keep the source type for a plain predicate', () => {
      expectTypeOf(
        Prism.fromPredicate(
          (value: string) => value !== '',
          () => 'empty'
        )
      ).toEqualTypeOf<Prism<string, string, string>>();
    });

    it('must narrow the focus type for a type guard', () => {
      expectTypeOf(
        Prism.fromPredicate(
          (value: unknown): value is string => typeof value === 'string',
          () => 'not a string'
        )
      ).toEqualTypeOf<Prism<unknown, string, string>>();
    });
  });

  describe('preview', () => {
    it('must call the preview function with the argument and succeed with its value as is', () => {
      const result = a.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(reviewA).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must return the failure of the preview function as is', () => {
      const result = miss.preview(input);

      expect(previewMiss).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(failure);
    });

    it('must propagate an error thrown by the preview function', () => {
      const error = new Error('Oops!');
      const prism = Prism.of(
        FallibleMorphism.of(() => {
          throw error;
        }),
        Morphism.id()
      );

      expect(() => prism.preview(input)).toThrow(error);
    });

    it('must be invariant in its source', () => {
      expectTypeOf<Prism<unknown, string, never>>().not.toExtend<
        Prism<string, string, never>
      >();
      expectTypeOf<Prism<string, string, never>>().not.toExtend<
        Prism<unknown, string, never>
      >();
    });

    it('must be invariant in its focus', () => {
      expectTypeOf<Prism<string, unknown, never>>().not.toExtend<
        Prism<string, string, never>
      >();
      expectTypeOf<Prism<string, string, never>>().not.toExtend<
        Prism<string, unknown, never>
      >();
    });

    it('must be covariant in its error', () => {
      expectTypeOf<Prism<string, string, never>>().toExtend<
        Prism<string, string, string>
      >();
      expectTypeOf<Prism<string, string, string>>().not.toExtend<
        Prism<string, string, never>
      >();
    });
  });

  describe('review', () => {
    it('must call the review function with the argument and return its result as is', () => {
      const result = a.review(input);

      expect(reviewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(previewA).not.toHaveBeenCalled();
      expect(result).toBe(beforeA);
    });

    it('must propagate an error thrown by the review function', () => {
      const error = new Error('Oops!');
      const prism = Prism.of(
        FallibleMorphism.id(),
        Morphism.of(() => {
          throw error;
        })
      );

      expect(() => prism.review(input)).toThrow(error);
    });

    it('must be previewed back to its argument', () => {
      const result = number.preview(number.review(42));

      assert(result.ok());
      expect(result.value()).toBe(42);
    });

    it('must rebuild the source from a successful preview', () => {
      const result = number.preview('42');

      assert(result.ok());
      expect(number.review(result.value())).toBe('42');
    });
  });

  describe('modify', () => {
    it('must preview the source, apply the morphism and review its result', () => {
      const modified = Symbol('modified');
      const fn = vi.fn(() => modified);

      const result = a.modify(Morphism.of(fn)).apply(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(modified);
      expect(result).toBe(beforeA);
    });

    it('must return a non-matching source as is without calling the morphism or reviewing', () => {
      const fn = vi.fn(() => Symbol('modified'));

      const result = miss.modify(Morphism.of(fn)).apply(input);

      expect(fn).not.toHaveBeenCalled();
      expect(reviewMiss).not.toHaveBeenCalled();
      expect(result).toBe(input);
    });

    it('must not call any function before it is applied', () => {
      const fn = vi.fn(() => Symbol('modified'));

      expect(a.modify(Morphism.of(fn))).toBeInstanceOf(Morphism);
      expect(previewA).not.toHaveBeenCalled();
      expect(reviewA).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    it('must leave a matching source unchanged when modified with identity', () => {
      expect(number.modify(Morphism.id()).apply('42')).toBe('42');
    });

    it('must modify through a composed prism', () => {
      const modified = Symbol('modified');
      const fn = vi.fn(() => modified);

      const result = a.andThen(b).modify(Morphism.of(fn)).apply(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(previewB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterB);
      expect(reviewB).toHaveBeenCalledExactlyOnceWith(modified);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(beforeB);
      expect(result).toBe(beforeA);
    });

    it('must return a morphism from the source to itself', () => {
      expectTypeOf(number.modify(double)).toEqualTypeOf<
        Morphism<string, string>
      >();
    });
  });

  describe('mapError', () => {
    it('must map the error of a failed preview', () => {
      const mapped = Symbol('mapped');
      const fn = vi.fn(() => mapped);

      const result = miss.mapError(Morphism.of(fn)).preview(input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(failure.error());
      assert(!result.ok());
      expect(result.error()).toBe(mapped);
    });

    it('must return a successful preview as is without mapping', () => {
      const fn = vi.fn();

      const result = a.mapError(Morphism.of(fn)).preview(input);

      expect(fn).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must review with the review function', () => {
      const result = a.mapError(Morphism.of(vi.fn())).review(input);

      expect(reviewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(beforeA);
    });

    it('must not call any function before it is applied', () => {
      const fn = vi.fn();

      expect(a.mapError(Morphism.of(fn))).toBeInstanceOf(Prism);
      expect(previewA).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    it('must change the error type and keep the source and focus types', () => {
      expectTypeOf(
        number.mapError(Morphism.of((error: 'nan') => error.length))
      ).toEqualTypeOf<Prism<string, number, number>>();
    });
  });

  describe('andThen', () => {
    it('must preview this prism first and then the next', () => {
      const result = a.andThen(b).preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(previewB).toHaveBeenCalledExactlyOnceWith(afterA);
      assert(result.ok());
      expect(result.value()).toBe(afterB);
    });

    it('must review with the next prism first and then this', () => {
      const result = a.andThen(b).review(input);

      expect(reviewB).toHaveBeenCalledExactlyOnceWith(input);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(beforeB);
      expect(result).toBe(beforeA);
    });

    it('must return the failure of this prism as is without previewing the next', () => {
      const result = miss.andThen(b).preview(input);

      expect(previewB).not.toHaveBeenCalled();
      expect(result).toBe(failure);
    });

    it('must return the failure of the next prism as is when this one succeeds', () => {
      const result = a.andThen(miss).preview(input);

      expect(previewMiss).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(result).toBe(failure);
    });

    it.each([
      ['left-nested', () => a.andThen(b).andThen(c)],
      ['right-nested', () => a.andThen(b.andThen(c))],
    ])('must apply a %s chain in order in both directions', (_, chain) => {
      const prism = chain();

      const result = prism.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(previewB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(previewC).toHaveBeenCalledExactlyOnceWith(afterB);
      assert(result.ok());
      expect(result.value()).toBe(afterC);

      expect(prism.review(input)).toBe(beforeA);
      expect(reviewC).toHaveBeenCalledExactlyOnceWith(input);
      expect(reviewB).toHaveBeenCalledExactlyOnceWith(beforeC);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(beforeB);
    });

    it('must not call any function before the composition is applied', () => {
      expect(a.andThen(b)).toBeInstanceOf(Prism);
      expect(previewA).not.toHaveBeenCalled();
      expect(reviewA).not.toHaveBeenCalled();
      expect(previewB).not.toHaveBeenCalled();
      expect(reviewB).not.toHaveBeenCalled();
    });

    it('must remain lawful when composing lawful prisms', () => {
      const composed = number.andThen(positive);

      const previewed = composed.preview(composed.review(42));
      const rebuilt = composed.preview('42');

      assert(previewed.ok());
      expect(previewed.value()).toBe(42);
      assert(rebuilt.ok());
      expect(composed.review(rebuilt.value())).toBe('42');
    });

    it('must widen the error type to the union of both error types', () => {
      expectTypeOf(number.andThen(positive)).toEqualTypeOf<
        Prism<string, number, 'nan' | 'negative'>
      >();
    });

    it('must reject a next optic whose source does not match the focus', () => {
      type AndThen = Prism<string, number, never>['andThen'];

      expectTypeOf<AndThen>().toExtend<
        (next: Prism<number, boolean, 'odd'>) => Prism<string, boolean, 'odd'>
      >();
      expectTypeOf<AndThen>().not.toExtend<
        (next: Prism<string, boolean, never>) => unknown
      >();
      expectTypeOf<AndThen>().not.toExtend<
        (next: Lens<string, boolean>) => unknown
      >();
    });

    describe('when the chain is long', () => {
      const count = 100_000;

      it('must not overflow the stack in either direction', () => {
        const composed = Array.from(
          { length: count },
          () => predecessor
        ).reduce<Prism<number, number, 'zero'>>(
          (acc, next) => acc.andThen(next),
          Prism.id()
        );

        const source = composed.review(0);
        const result = composed.preview(source);

        expect(source).toBe(count);
        assert(result.ok());
        expect(result.value()).toBe(0);
      });
    });
  });

  describe('id', () => {
    it('must return the argument as is in both directions', () => {
      const result = Prism.id<symbol>().preview(input);

      assert(result.ok());
      expect(result.value()).toBe(input);
      expect(Prism.id<symbol>().review(input)).toBe(input);
    });

    it('must be a left identity for andThen', () => {
      const composed = Prism.id<symbol>().andThen(a);

      const result = composed.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      assert(result.ok());
      expect(result.value()).toBe(afterA);
      expect(composed.review(input)).toBe(beforeA);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must be a right identity for andThen', () => {
      const composed = a.andThen(Prism.id());

      const result = composed.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      assert(result.ok());
      expect(result.value()).toBe(afterA);
      expect(composed.review(input)).toBe(beforeA);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must serve as the seed when folding a sequence of prisms', () => {
      const composed = [a, b, c].reduce(
        (acc, step) => acc.andThen(step),
        Prism.id<symbol>()
      );

      const result = composed.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(previewB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(previewC).toHaveBeenCalledExactlyOnceWith(afterB);
      assert(result.ok());
      expect(result.value()).toBe(afterC);

      expect(composed.review(input)).toBe(beforeA);
      expect(reviewC).toHaveBeenCalledExactlyOnceWith(input);
      expect(reviewB).toHaveBeenCalledExactlyOnceWith(beforeC);
      expect(reviewA).toHaveBeenCalledExactlyOnceWith(beforeB);
    });

    it('must never fail', () => {
      expectTypeOf(Prism.id<string>()).toEqualTypeOf<
        Prism<string, string, never>
      >();
    });
  });
});
