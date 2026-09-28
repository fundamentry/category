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

import { FallibleMorphism, Morphism } from '#project/morphism';

import { Optional } from './Optional.js';

describe('Optional', () => {
  const input = Symbol('input');
  const afterA = Symbol('after a');
  const afterB = Symbol('after b');
  const afterC = Symbol('after c');
  const beforeA = Symbol('before a');
  const beforeB = Symbol('before b');
  const beforeC = Symbol('before c');
  const modified = Symbol('modified');
  const previewA = vi.fn(() => new Success(afterA));
  const previewB = vi.fn(() => new Success(afterB));
  const previewC = vi.fn(() => new Success(afterC));
  const getA = vi.fn(() => afterA);
  const getB = vi.fn(() => afterB);
  const getC = vi.fn(() => afterC);
  const setA = vi.fn(() => beforeA);
  const setB = vi.fn(() => beforeB);
  const setC = vi.fn(() => beforeC);
  const fn = vi.fn(() => modified);
  const a = Optional.of<symbol, symbol, unknown>(
    FallibleMorphism.of(previewA),
    Morphism.of((morphism: Morphism<symbol, symbol>) =>
      Morphism.of(getA).andThen(morphism).andThen(Morphism.of(setA))
    )
  );
  const b = Optional.of<symbol, symbol, unknown>(
    FallibleMorphism.of(previewB),
    Morphism.of((morphism: Morphism<symbol, symbol>) =>
      Morphism.of(getB).andThen(morphism).andThen(Morphism.of(setB))
    )
  );
  const c = Optional.of<symbol, symbol, unknown>(
    FallibleMorphism.of(previewC),
    Morphism.of((morphism: Morphism<symbol, symbol>) =>
      Morphism.of(getC).andThen(morphism).andThen(Morphism.of(setC))
    )
  );

  const failure = new Failure(Symbol('error'));
  const previewMiss = vi.fn(() => failure);
  const miss = Optional.of<symbol, symbol, symbol>(
    FallibleMorphism.of(previewMiss),
    Morphism.of(() => Morphism.id<symbol>())
  );

  const head = Optional.of(
    FallibleMorphism.of((values: readonly number[]): Result<number, 'empty'> =>
      values[0] === undefined ? new Failure('empty') : new Success(values[0])
    ),
    Morphism.of((morphism: Morphism<number, number>) =>
      Morphism.of((values: readonly number[]): readonly number[] =>
        values[0] === undefined
          ? values
          : [morphism.apply(values[0]), ...values.slice(1)]
      )
    )
  );
  const increment = Morphism.of((value: number) => value + 1);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('of', () => {
    it('must not call either function', () => {
      const preview = vi.fn(() => new Success(input));
      const modify = vi.fn(() => Morphism.id<symbol>());

      expect(
        Optional.of(FallibleMorphism.of(preview), Morphism.of(modify))
      ).toBeInstanceOf(Optional);
      expect(preview).not.toHaveBeenCalled();
      expect(modify).not.toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    it('must call the preview function with the argument and succeed with its value as is', () => {
      const result = a.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(getA).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must return the failure of the preview function as is', () => {
      const result = miss.preview(input);

      expect(previewMiss).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(failure);
    });

    it('must be invariant in its source and focus, and covariant in its error', () => {
      expectTypeOf<Optional<unknown, string, never>>().not.toExtend<
        Optional<string, string, never>
      >();
      expectTypeOf<Optional<string, unknown, never>>().not.toExtend<
        Optional<string, string, never>
      >();
      expectTypeOf<Optional<string, string, never>>().toExtend<
        Optional<string, string, string>
      >();
    });
  });

  describe('set', () => {
    it('must modify the source with a morphism that always returns the value', () => {
      const value = Symbol('value');

      const result = a.set(input, value);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(setA).toHaveBeenCalledExactlyOnceWith(value);
      expect(previewA).not.toHaveBeenCalled();
      expect(result).toBe(beforeA);
    });

    it('must return a source that does not match as is', () => {
      const empty: readonly number[] = [];

      expect(head.set(empty, 9)).toBe(empty);
    });

    it('must preview the value it set on a matching source', () => {
      const result = head.preview(head.set([1, 2], 9));

      assert(result.ok());
      expect(result.value()).toBe(9);
    });

    it('must leave a matching source unchanged when setting its focus', () => {
      expect(head.set([1, 2], 1)).toEqual([1, 2]);
    });

    it('must keep only the last of two sets', () => {
      expect(head.set(head.set([1, 2], 8), 9)).toEqual([9, 2]);
    });
  });

  describe('modify', () => {
    it('must pass the morphism to the modifier and return its result as is', () => {
      const modifiedSource = Morphism.id<symbol>();
      const modify = vi.fn((_: Morphism<symbol, symbol>) => modifiedSource);
      const morphism = Morphism.of(fn);

      const result = Optional.of(
        FallibleMorphism.of(previewA),
        Morphism.of(modify)
      ).modify(morphism);

      expect(modify).toHaveBeenCalledOnce();
      expect(modify.mock.lastCall?.[0]).toBe(morphism);
      expect(result).toBe(modifiedSource);
    });

    it('must not preview or call the morphism before its result is applied', () => {
      expect(a.modify(Morphism.of(fn))).toBeInstanceOf(Morphism);
      expect(previewA).not.toHaveBeenCalled();
      expect(getA).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    it('must update the focus of a matching source', () => {
      expect(head.modify(increment).apply([1, 2])).toEqual([2, 2]);
    });

    it('must return a source that does not match as is without calling the morphism', () => {
      const empty: readonly number[] = [];
      const spy = vi.fn((value: number) => value);

      expect(head.modify(Morphism.of(spy)).apply(empty)).toBe(empty);
      expect(spy).not.toHaveBeenCalled();
    });

    it('must return a morphism from the source to itself', () => {
      expectTypeOf(head.modify(increment)).toEqualTypeOf<
        Morphism<readonly number[], readonly number[]>
      >();
    });
  });

  describe('mapError', () => {
    it('must map the error of a failed preview', () => {
      const mapped = Symbol('mapped');
      const spy = vi.fn(() => mapped);

      const result = miss.mapError(Morphism.of(spy)).preview(input);

      expect(spy).toHaveBeenCalledExactlyOnceWith(failure.error());
      assert(!result.ok());
      expect(result.error()).toBe(mapped);
    });

    it('must return a successful preview as is without mapping', () => {
      const spy = vi.fn();

      const result = a.mapError(Morphism.of(spy)).preview(input);

      expect(spy).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must modify with the modifier', () => {
      const result = a
        .mapError(Morphism.of(vi.fn()))
        .modify(Morphism.of(fn))
        .apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(setA).toHaveBeenCalledExactlyOnceWith(modified);
      expect(result).toBe(beforeA);
    });

    it('must change the error type and keep the source and focus types', () => {
      expectTypeOf(
        head.mapError(Morphism.of((error: 'empty') => error.length))
      ).toEqualTypeOf<Optional<readonly number[], number, number>>();
    });
  });

  describe('andThen', () => {
    it('must preview this optional first and then the next', () => {
      const result = a.andThen(b).preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(previewB).toHaveBeenCalledExactlyOnceWith(afterA);
      assert(result.ok());
      expect(result.value()).toBe(afterB);
    });

    it('must return the failure of this optional as is without previewing the next', () => {
      const result = miss.andThen(b).preview(input);

      expect(previewB).not.toHaveBeenCalled();
      expect(result).toBe(failure);
    });

    it('must return the failure of the next optional as is when this one matches', () => {
      const result = a.andThen(miss).preview(input);

      expect(previewMiss).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(result).toBe(failure);
    });

    it('must modify the focus of the next optional within the focus of this one', () => {
      const result = a.andThen(b).modify(Morphism.of(fn)).apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(getB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterB);
      expect(setB).toHaveBeenCalledExactlyOnceWith(modified);
      expect(setA).toHaveBeenCalledExactlyOnceWith(beforeB);
      expect(result).toBe(beforeA);
    });

    it('must set through the next optional and then this', () => {
      const value = Symbol('value');

      const result = a.andThen(b).set(input, value);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(setB).toHaveBeenCalledExactlyOnceWith(value);
      expect(setA).toHaveBeenCalledExactlyOnceWith(beforeB);
      expect(result).toBe(beforeA);
    });

    it.each([
      ['left-nested', () => a.andThen(b).andThen(c)],
      ['right-nested', () => a.andThen(b.andThen(c))],
    ])('must preview and modify a %s chain in order', (_, chain) => {
      const optional = chain();

      const result = optional.preview(input);

      expect(previewA).toHaveBeenCalledExactlyOnceWith(input);
      expect(previewB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(previewC).toHaveBeenCalledExactlyOnceWith(afterB);
      assert(result.ok());
      expect(result.value()).toBe(afterC);

      expect(optional.modify(Morphism.of(fn)).apply(input)).toBe(beforeA);
      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(getB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(getC).toHaveBeenCalledExactlyOnceWith(afterB);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterC);
      expect(setC).toHaveBeenCalledExactlyOnceWith(modified);
      expect(setB).toHaveBeenCalledExactlyOnceWith(beforeC);
      expect(setA).toHaveBeenCalledExactlyOnceWith(beforeB);
    });

    it('must not call any function before the composition is applied', () => {
      expect(a.andThen(b)).toBeInstanceOf(Optional);
      expect(previewA).not.toHaveBeenCalled();
      expect(getA).not.toHaveBeenCalled();
      expect(previewB).not.toHaveBeenCalled();
      expect(getB).not.toHaveBeenCalled();
    });

    it('must widen the error type to the union of both error types', () => {
      const positive = Optional.of(
        FallibleMorphism.fromPredicate(
          (value: number) => value > 0,
          () => 'negative' as const
        ),
        Morphism.id<Morphism<number, number>>()
      );

      expectTypeOf(head.andThen(positive)).toEqualTypeOf<
        Optional<readonly number[], number, 'empty' | 'negative'>
      >();
    });

    describe('when the chain is long', () => {
      const depth = 100_000;

      it('must not overflow the stack when nested to the right', () => {
        const composed = Array.from({ length: depth }).reduceRight<
          Optional<number, number, never>
        >(acc => Optional.id<number>().andThen(acc), Optional.id());

        const result = composed.preview(1);

        assert(result.ok());
        expect(result.value()).toBe(1);
        expect(composed.set(1, 2)).toBe(2);
        expect(composed.modify(increment).apply(1)).toBe(2);
      });

      it('must not overflow the stack when nested to the left', () => {
        const composed = Array.from({ length: depth }).reduce<
          Optional<number, number, never>
        >(acc => acc.andThen(Optional.id()), Optional.id());

        const result = composed.preview(1);

        assert(result.ok());
        expect(result.value()).toBe(1);
        expect(composed.set(1, 2)).toBe(2);
        expect(composed.modify(increment).apply(1)).toBe(2);
      });
    });
  });

  describe('id', () => {
    it('must preview the source as is and set by replacing it', () => {
      const value = Symbol('value');

      const result = Optional.id<symbol>().preview(input);

      assert(result.ok());
      expect(result.value()).toBe(input);
      expect(Optional.id<symbol>().set(input, value)).toBe(value);
    });

    it('must be a left identity for andThen', () => {
      const result = Optional.id<symbol>()
        .andThen(a)
        .modify(Morphism.of(fn))
        .apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(setA).toHaveBeenCalledExactlyOnceWith(modified);
      expect(result).toBe(beforeA);
    });

    it('must be a right identity for andThen', () => {
      const result = a
        .andThen(Optional.id())
        .modify(Morphism.of(fn))
        .apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(setA).toHaveBeenCalledExactlyOnceWith(modified);
      expect(result).toBe(beforeA);
    });

    it('must never fail', () => {
      expectTypeOf(Optional.id<string>()).toEqualTypeOf<
        Optional<string, string, never>
      >();
    });
  });
});
