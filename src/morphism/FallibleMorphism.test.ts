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

import { FallibleMorphism } from './FallibleMorphism.js';
import { Morphism } from './Morphism.js';

describe('FallibleMorphism', () => {
  const input = Symbol('input');
  const afterA = Symbol('after a');
  const afterB = Symbol('after b');
  const afterC = Symbol('after c');
  const fa = vi.fn(() => new Success(afterA));
  const fb = vi.fn(() => new Success(afterB));
  const fc = vi.fn(() => new Success(afterC));
  const a = FallibleMorphism.of(fa);
  const b = FallibleMorphism.of(fb);
  const c = FallibleMorphism.of(fc);

  const failure = new Failure(Symbol('error'));
  const ffail = vi.fn(() => failure);
  const fail = FallibleMorphism.of(ffail);

  const length = Morphism.of((value: string) => value.length);
  const double = Morphism.of((value: number) => value * 2);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('of', () => {
    it('must not call the function', () => {
      const fn = vi.fn();

      expect(FallibleMorphism.of(fn)).toBeInstanceOf(FallibleMorphism);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('apply', () => {
    it('must call the function with the argument and succeed with the value of its success', () => {
      const result = a.apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must call the function with the argument and return its failure as is', () => {
      const result = fail.apply(input);

      expect(ffail).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(failure);
    });

    it('must call the function again on every application', () => {
      const first = Symbol('first');
      const second = Symbol('second');
      const fn = vi.fn((value: symbol) => new Success(value));
      const morphism = FallibleMorphism.of(fn);

      morphism.apply(first);
      morphism.apply(second);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, first);
      expect(fn).toHaveBeenNthCalledWith(2, second);
    });

    it('must propagate an error thrown by the function instead of wrapping it in a failure', () => {
      const error = new Error('Oops!');
      const morphism = FallibleMorphism.of(() => {
        throw error;
      });

      expect(() => morphism.apply(input)).toThrow(error);
    });

    it('must be contravariant in its domain', () => {
      expectTypeOf<FallibleMorphism<unknown, string, string>>().toExtend<
        FallibleMorphism<string, string, string>
      >();
      expectTypeOf<FallibleMorphism<string, string, string>>().not.toExtend<
        FallibleMorphism<unknown, string, string>
      >();
    });

    it('must be covariant in its codomain', () => {
      expectTypeOf<FallibleMorphism<string, string, string>>().toExtend<
        FallibleMorphism<string, unknown, string>
      >();
      expectTypeOf<FallibleMorphism<string, unknown, string>>().not.toExtend<
        FallibleMorphism<string, string, string>
      >();
    });

    it('must be covariant in its error', () => {
      expectTypeOf<FallibleMorphism<string, string, never>>().toExtend<
        FallibleMorphism<string, string, string>
      >();
      expectTypeOf<FallibleMorphism<string, string, string>>().not.toExtend<
        FallibleMorphism<string, string, never>
      >();
    });
  });

  describe('andThen', () => {
    it('must apply this morphism first and pass its success value to the next', () => {
      const result = a.andThen(b).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).toHaveBeenCalledExactlyOnceWith(afterA);
      assert(result.ok());
      expect(result.value()).toBe(afterB);
    });

    it.each([
      ['left-nested', () => a.andThen(b).andThen(c)],
      ['right-nested', () => a.andThen(b.andThen(c))],
    ])('must apply a %s chain in order', (_, chain) => {
      const result = chain().apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fc).toHaveBeenCalledExactlyOnceWith(afterB);
      assert(result.ok());
      expect(result.value()).toBe(afterC);
    });

    it('must return the failure of this morphism as is without calling the next', () => {
      const result = fail.andThen(b).apply(input);

      expect(ffail).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).not.toHaveBeenCalled();
      expect(result).toBe(failure);
    });

    it('must return the failure of the next morphism as is when this one succeeds', () => {
      const result = a.andThen(fail).apply(input);

      expect(ffail).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(result).toBe(failure);
    });

    it.each([
      ['left-nested', () => a.andThen(fail).andThen(b)],
      ['right-nested', () => a.andThen(fail.andThen(b))],
    ])(
      'must return the first failure of a %s chain without applying the rest',
      (_, chain) => {
        const result = chain().apply(input);

        expect(ffail).toHaveBeenCalledExactlyOnceWith(afterA);
        expect(fb).not.toHaveBeenCalled();
        expect(result).toBe(failure);
      }
    );

    it('must not call either function before the composition is applied', () => {
      expect(a.andThen(b)).toBeInstanceOf(FallibleMorphism);
      expect(fa).not.toHaveBeenCalled();
      expect(fb).not.toHaveBeenCalled();
    });

    describe('when the chain is long', () => {
      const count = 100_000;
      const increment = FallibleMorphism.of<number, number, never>(
        value => new Success(value + 1)
      );
      const steps = Array.from({ length: count }, () => increment);

      it('must not overflow the stack when composed from the left', () => {
        const composed = steps.reduce<FallibleMorphism<number, number, never>>(
          (acc, step) => acc.andThen(step),
          FallibleMorphism.id()
        );

        const result = composed.apply(0);

        assert(result.ok());
        expect(result.value()).toBe(count);
      });

      it('must not overflow the stack when composed from the right', () => {
        const composed = steps.reduceRight<
          FallibleMorphism<number, number, never>
        >((acc, step) => step.andThen(acc), FallibleMorphism.id());

        const result = composed.apply(0);

        assert(result.ok());
        expect(result.value()).toBe(count);
      });

      it('must not overflow the stack when joining two long chains', () => {
        const chain = steps.reduce<FallibleMorphism<number, number, never>>(
          (acc, step) => acc.andThen(step),
          FallibleMorphism.id()
        );

        const result = chain.andThen(chain).apply(0);

        assert(result.ok());
        expect(result.value()).toBe(2 * count);
      });

      it('must not overflow the stack when failing early', () => {
        const composed = steps
          .reduce<FallibleMorphism<number, number, symbol>>(
            (acc, step) => acc.andThen(step),
            FallibleMorphism.of(() => failure)
          )
          .andThen(c);

        expect(composed.apply(0)).toBe(failure);
        expect(fc).not.toHaveBeenCalled();
      });
    });

    it('must widen the error type to the union of both error types', () => {
      const parse = FallibleMorphism.of(
        (value: string): Result<number, 'nan'> =>
          Number.isNaN(Number(value))
            ? new Failure('nan')
            : new Success(Number(value))
      );
      const positive = FallibleMorphism.of(
        (value: number): Result<number, 'negative'> =>
          value < 0 ? new Failure('negative') : new Success(value)
      );

      expectTypeOf(parse.andThen(positive)).toEqualTypeOf<
        FallibleMorphism<string, number, 'nan' | 'negative'>
      >();
    });

    it('must reject a next morphism whose domain does not match the codomain', () => {
      type Next = Parameters<
        FallibleMorphism<string, number, never>['andThen']
      >[0];

      expectTypeOf<Next>().toEqualTypeOf<
        FallibleMorphism<number, unknown, unknown>
      >();
      expectTypeOf<
        FallibleMorphism<string, string, never>
      >().not.toExtend<Next>();
    });
  });

  describe('from', () => {
    it('must call the morphism with the argument and succeed with its result as is', () => {
      const output = Symbol('output');
      const fn = vi.fn(() => output);

      const result = FallibleMorphism.from(Morphism.of(fn)).apply(input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(input);
      assert(result.ok());
      expect(result.value()).toBe(output);
    });

    it('must not call the morphism', () => {
      const fn = vi.fn();

      expect(FallibleMorphism.from(Morphism.of(fn))).toBeInstanceOf(
        FallibleMorphism
      );
      expect(fn).not.toHaveBeenCalled();
    });

    it('must propagate an error thrown by the morphism', () => {
      const error = new Error('Oops!');
      const morphism = FallibleMorphism.from(
        Morphism.of(() => {
          throw error;
        })
      );

      expect(() => morphism.apply(input)).toThrow(error);
    });

    it('must compose with fallible morphisms on either side', () => {
      const converted = Symbol('converted');
      const fn = vi.fn(() => converted);

      const result = a
        .andThen(FallibleMorphism.from(Morphism.of(fn)))
        .andThen(c)
        .apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fc).toHaveBeenCalledExactlyOnceWith(converted);
      assert(result.ok());
      expect(result.value()).toBe(afterC);
    });

    it('must not overflow the stack when composing many converted morphisms', () => {
      const count = 100_000;
      const increment = FallibleMorphism.from(
        Morphism.of((value: number) => value + 1)
      );

      const composed = Array.from({ length: count }, () => increment).reduce<
        FallibleMorphism<number, number, never>
      >((acc, step) => acc.andThen(step), FallibleMorphism.id());

      const result = composed.apply(0);

      assert(result.ok());
      expect(result.value()).toBe(count);
    });

    it('must never fail', () => {
      expectTypeOf(FallibleMorphism.from(length)).toEqualTypeOf<
        FallibleMorphism<string, number, never>
      >();
    });
  });

  describe('fromPredicate', () => {
    it('must succeed with the argument as is without building an error when the predicate holds', () => {
      const predicate = vi.fn(() => true);
      const toError = vi.fn();

      const result = FallibleMorphism.fromPredicate(predicate, toError).apply(
        input
      );

      expect(predicate).toHaveBeenCalledExactlyOnceWith(input);
      expect(toError).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(input);
    });

    it('must fail with the error built for the argument when the predicate does not hold', () => {
      const error = Symbol('error');
      const predicate = vi.fn(() => false);
      const toError = vi.fn(() => error);

      const result = FallibleMorphism.fromPredicate(predicate, toError).apply(
        input
      );

      expect(predicate).toHaveBeenCalledExactlyOnceWith(input);
      expect(toError).toHaveBeenCalledExactlyOnceWith(input);
      assert(!result.ok());
      expect(result.error()).toBe(error);
    });

    it('must not call the predicate or build an error', () => {
      const predicate = vi.fn();
      const toError = vi.fn();

      expect(FallibleMorphism.fromPredicate(predicate, toError)).toBeInstanceOf(
        FallibleMorphism
      );
      expect(predicate).not.toHaveBeenCalled();
      expect(toError).not.toHaveBeenCalled();
    });

    it('must keep the argument type for a plain predicate', () => {
      const nonEmpty = FallibleMorphism.fromPredicate(
        (value: string) => value.length > 0,
        () => 'empty'
      );

      expectTypeOf(nonEmpty).toEqualTypeOf<
        FallibleMorphism<string, string, string>
      >();
    });

    it('must narrow the argument type for a type guard', () => {
      const isString = FallibleMorphism.fromPredicate(
        (value: unknown): value is string => typeof value === 'string',
        () => 'not a string'
      );

      expectTypeOf(isString).toEqualTypeOf<
        FallibleMorphism<unknown, string, string>
      >();
    });
  });

  describe('map', () => {
    it('must apply the morphism to the value of a success and succeed with its result as is', () => {
      const output = Symbol('output');
      const fn = vi.fn(() => output);

      const result = a.map(Morphism.of(fn)).apply(input);

      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      assert(result.ok());
      expect(result.value()).toBe(output);
    });

    it('must return a failure as is without calling the morphism', () => {
      const fn = vi.fn();

      const result = fail.map(Morphism.of(fn)).apply(input);

      expect(fn).not.toHaveBeenCalled();
      expect(result).toBe(failure);
    });

    it('must not call any function before it is applied', () => {
      const fn = vi.fn(() => Symbol('output'));

      expect(a.map(Morphism.of(fn))).toBeInstanceOf(FallibleMorphism);
      expect(fa).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    it('must be an identity when mapped with the identity morphism', () => {
      const result = a.map(Morphism.id()).apply(input);

      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must compose when mapped twice', () => {
      const base = FallibleMorphism.id<string>();

      const twice = base.map(length).map(double).apply('abc');
      const once = base.map(length.andThen(double)).apply('abc');

      assert(twice.ok());
      assert(once.ok());
      expect(twice.value()).toBe(once.value());
    });

    it('must not overflow the stack when mapped many times', () => {
      const count = 100_000;
      const increment = Morphism.of((value: number) => value + 1);

      const mapped = Array.from({ length: count }).reduce<
        FallibleMorphism<number, number, never>
      >(acc => acc.map(increment), FallibleMorphism.id());

      const result = mapped.apply(0);

      assert(result.ok());
      expect(result.value()).toBe(count);
    });

    it('must change the codomain and keep the error type', () => {
      const validate = FallibleMorphism.of(
        (value: string): Result<string, 'invalid'> => new Success(value)
      );

      expectTypeOf(validate.map(length)).toEqualTypeOf<
        FallibleMorphism<string, number, 'invalid'>
      >();
    });
  });

  describe('mapError', () => {
    it('must map the error of a failure', () => {
      const mapped = Symbol('mapped');
      const fn = vi.fn(() => mapped);

      const result = fail.mapError(Morphism.of(fn)).apply(input);

      expect(ffail).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(failure.error());
      assert(!result.ok());
      expect(result.error()).toBe(mapped);
    });

    it('must return a success as is without mapping', () => {
      const fn = vi.fn();

      const result = a.mapError(Morphism.of(fn)).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must not call any function before it is applied', () => {
      const fn = vi.fn(() => Symbol('mapped'));

      expect(fail.mapError(Morphism.of(fn))).toBeInstanceOf(FallibleMorphism);
      expect(ffail).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    it('must compose with the rest of a chain', () => {
      const mapped = Symbol('mapped');

      const result = a
        .andThen(fail.mapError(Morphism.of(() => mapped)))
        .andThen(b)
        .apply(input);

      expect(ffail).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fb).not.toHaveBeenCalled();
      assert(!result.ok());
      expect(result.error()).toBe(mapped);
    });

    it('must change the error type and keep the domain and codomain', () => {
      const validate = FallibleMorphism.of(
        (value: string): Result<string, 'invalid'> => new Success(value)
      );

      expectTypeOf(
        validate.mapError(Morphism.of((error: 'invalid') => error.length))
      ).toEqualTypeOf<FallibleMorphism<string, string, number>>();
    });
  });

  describe('id', () => {
    it('must succeed with the argument as is', () => {
      const result = FallibleMorphism.id<symbol>().apply(input);

      assert(result.ok());
      expect(result.value()).toBe(input);
    });

    it('must be a left identity for andThen', () => {
      const result = FallibleMorphism.id<symbol>().andThen(a).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must be a right identity for andThen', () => {
      const result = a.andThen(FallibleMorphism.id()).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must be a left identity for a failing morphism', () => {
      const result = FallibleMorphism.id<symbol>().andThen(fail).apply(input);

      expect(ffail).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(failure);
    });

    it('must serve as the seed when folding a sequence of fallible morphisms', () => {
      const composed = [a, b, c].reduce<
        FallibleMorphism<symbol, unknown, unknown>
      >(
        (acc, step: FallibleMorphism<unknown, symbol, unknown>) =>
          acc.andThen(step),
        FallibleMorphism.id()
      );

      const result = composed.apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fc).toHaveBeenCalledExactlyOnceWith(afterB);
      assert(result.ok());
      expect(result.value()).toBe(afterC);
    });

    it('must never fail', () => {
      expectTypeOf(FallibleMorphism.id<string>()).toEqualTypeOf<
        FallibleMorphism<string, string, never>
      >();
    });
  });
});
