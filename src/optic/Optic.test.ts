import { assert, describe, expect, expectTypeOf, it } from 'vitest';

import { Failure, type Result, Success } from '@fundamentry/coproduct';

import { Iso } from '#project/iso';
import { Lens } from '#project/lens';
import { FallibleMorphism, Morphism } from '#project/morphism';
import { Optional } from '#project/optional';
import { Prism } from '#project/prism';

function success<A>(result: Result<A, unknown>): A {
  assert(result.ok());

  return result.value();
}

function failure<E>(result: Result<unknown, E>): E {
  assert(!result.ok());

  return result.error();
}

describe('Optic', () => {
  const increment = Iso.of(
    (value: number) => value + 1,
    (value: number) => value - 1
  );
  const tens = Lens.of(
    Morphism.of((value: number) => Math.floor(value / 10)),
    Morphism.of(
      ([value, digit]: readonly [number, number]) => digit * 10 + (value % 10)
    )
  );
  const positive = Prism.of(
    (value: number): Result<number, 'negative'> =>
      value > 0 ? new Success(value) : new Failure('negative'),
    (value: number) => value
  );
  const even = Optional.of(
    FallibleMorphism.of((value: number): Result<number, 'odd'> =>
      value % 2 === 0 ? new Success(value) : new Failure('odd')
    ),
    Morphism.of((morphism: Morphism<number, number>) =>
      Morphism.of((value: number) =>
        value % 2 === 0 ? morphism.apply(value) : value
      )
    )
  );

  describe('andThen', () => {
    describe('from an iso', () => {
      it('must compose with an iso into an iso', () => {
        const composed = increment.andThen(increment);

        expectTypeOf(composed).toEqualTypeOf<Iso<number, number>>();
        expect(composed).toBeInstanceOf(Iso);
        expect(composed.to(1)).toBe(3);
        expect(composed.from(3)).toBe(1);
      });

      it('must compose with a lens into a lens', () => {
        const composed = increment.andThen(tens);

        expectTypeOf(composed).toEqualTypeOf<Lens<number, number>>();
        expect(composed).toBeInstanceOf(Lens);
        expect(composed.get(24)).toBe(2);
        expect(composed.set(24, 7)).toBe(74);
      });

      it('must compose with a prism into a prism', () => {
        const composed = increment.andThen(positive);

        expectTypeOf(composed).toEqualTypeOf<
          Prism<number, number, 'negative'>
        >();
        expect(composed).toBeInstanceOf(Prism);
        expect(success(composed.preview(0))).toBe(1);
        expect(failure(composed.preview(-5))).toBe('negative');
        expect(composed.review(5)).toBe(4);
      });

      it('must compose with an optional into an optional', () => {
        const composed = increment.andThen(even);

        expectTypeOf(composed).toEqualTypeOf<Optional<number, number, 'odd'>>();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(1))).toBe(2);
        expect(failure(composed.preview(2))).toBe('odd');
        expect(composed.set(1, 10)).toBe(9);
        expect(composed.set(2, 10)).toBe(2);
      });
    });

    describe('from a lens', () => {
      it('must compose with an iso into a lens', () => {
        const composed = tens.andThen(increment);

        expectTypeOf(composed).toEqualTypeOf<Lens<number, number>>();
        expect(composed).toBeInstanceOf(Lens);
        expect(composed.get(24)).toBe(3);
        expect(composed.set(24, 7)).toBe(64);
      });

      it('must compose with a lens into a lens', () => {
        const composed = tens.andThen(tens);

        expectTypeOf(composed).toEqualTypeOf<Lens<number, number>>();
        expect(composed).toBeInstanceOf(Lens);
        expect(composed.get(345)).toBe(3);
        expect(composed.set(345, 7)).toBe(745);
      });

      it('must compose with a prism into an optional', () => {
        const composed = tens.andThen(positive);

        expectTypeOf(composed).toEqualTypeOf<
          Optional<number, number, 'negative'>
        >();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(24))).toBe(2);
        expect(failure(composed.preview(5))).toBe('negative');
        expect(composed.set(24, 7)).toBe(74);
        expect(composed.set(5, 7)).toBe(5);
      });

      it('must compose with an optional into an optional', () => {
        const composed = tens.andThen(even);

        expectTypeOf(composed).toEqualTypeOf<Optional<number, number, 'odd'>>();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(24))).toBe(2);
        expect(failure(composed.preview(34))).toBe('odd');
        expect(composed.set(24, 8)).toBe(84);
        expect(composed.set(34, 8)).toBe(34);
      });
    });

    describe('from a prism', () => {
      it('must compose with an iso into a prism', () => {
        const composed = positive.andThen(increment);

        expectTypeOf(composed).toEqualTypeOf<
          Prism<number, number, 'negative'>
        >();
        expect(composed).toBeInstanceOf(Prism);
        expect(success(composed.preview(1))).toBe(2);
        expect(failure(composed.preview(0))).toBe('negative');
        expect(composed.review(5)).toBe(4);
      });

      it('must compose with a lens into an optional', () => {
        const composed = positive.andThen(tens);

        expectTypeOf(composed).toEqualTypeOf<
          Optional<number, number, 'negative'>
        >();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(24))).toBe(2);
        expect(failure(composed.preview(-5))).toBe('negative');
        expect(composed.set(24, 7)).toBe(74);
        expect(composed.set(-5, 7)).toBe(-5);
      });

      it('must compose with a prism into a prism', () => {
        const composed = positive.andThen(positive);

        expectTypeOf(composed).toEqualTypeOf<
          Prism<number, number, 'negative'>
        >();
        expect(composed).toBeInstanceOf(Prism);
        expect(success(composed.preview(3))).toBe(3);
        expect(failure(composed.preview(-1))).toBe('negative');
        expect(composed.review(5)).toBe(5);
      });

      it('must compose with an optional into an optional', () => {
        const composed = positive.andThen(even);

        expectTypeOf(composed).toEqualTypeOf<
          Optional<number, number, 'negative' | 'odd'>
        >();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(2))).toBe(2);
        expect(failure(composed.preview(3))).toBe('odd');
        expect(failure(composed.preview(-2))).toBe('negative');
        expect(composed.set(2, 10)).toBe(10);
        expect(composed.set(3, 10)).toBe(3);
      });
    });

    describe('from an optional', () => {
      it('must compose with an iso into an optional', () => {
        const composed = even.andThen(increment);

        expectTypeOf(composed).toEqualTypeOf<Optional<number, number, 'odd'>>();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(2))).toBe(3);
        expect(failure(composed.preview(1))).toBe('odd');
        expect(composed.set(2, 7)).toBe(6);
        expect(composed.set(1, 7)).toBe(1);
      });

      it('must compose with a lens into an optional', () => {
        const composed = even.andThen(tens);

        expectTypeOf(composed).toEqualTypeOf<Optional<number, number, 'odd'>>();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(24))).toBe(2);
        expect(failure(composed.preview(25))).toBe('odd');
        expect(composed.set(24, 7)).toBe(74);
        expect(composed.set(25, 7)).toBe(25);
      });

      it('must compose with a prism into an optional', () => {
        const composed = even.andThen(positive);

        expectTypeOf(composed).toEqualTypeOf<
          Optional<number, number, 'odd' | 'negative'>
        >();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(2))).toBe(2);
        expect(failure(composed.preview(1))).toBe('odd');
        expect(failure(composed.preview(-2))).toBe('negative');
        expect(composed.set(2, 8)).toBe(8);
        expect(composed.set(-2, 8)).toBe(-2);
      });

      it('must compose with an optional into an optional', () => {
        const composed = even.andThen(even);

        expectTypeOf(composed).toEqualTypeOf<Optional<number, number, 'odd'>>();
        expect(composed).toBeInstanceOf(Optional);
        expect(success(composed.preview(4))).toBe(4);
        expect(failure(composed.preview(3))).toBe('odd');
        expect(composed.set(4, 8)).toBe(8);
        expect(composed.set(3, 8)).toBe(3);
      });
    });
  });
});
