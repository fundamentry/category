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
import { FallibleMorphism } from '#project/morphism';
import { Prism } from '#project/prism';

import { PartialIso } from './PartialIso.js';

describe('PartialIso', () => {
  const input = Symbol('input');
  const afterA = Symbol('after a');
  const afterB = Symbol('after b');
  const afterC = Symbol('after c');
  const beforeA = Symbol('before a');
  const beforeB = Symbol('before b');
  const beforeC = Symbol('before c');
  const toA = vi.fn(() => new Success(afterA));
  const toB = vi.fn(() => new Success(afterB));
  const toC = vi.fn(() => new Success(afterC));
  const fromA = vi.fn(() => new Success(beforeA));
  const fromB = vi.fn(() => new Success(beforeB));
  const fromC = vi.fn(() => new Success(beforeC));
  const a = PartialIso.of<symbol, symbol, unknown, unknown>(toA, fromA);
  const b = PartialIso.of<symbol, symbol, unknown, unknown>(toB, fromB);
  const c = PartialIso.of<symbol, symbol, unknown, unknown>(toC, fromC);

  const failure = new Failure(Symbol('error'));
  const toMiss = vi.fn(() => failure);
  const fromMiss = vi.fn(() => failure);
  const miss = PartialIso.of<symbol, symbol, symbol, symbol>(toMiss, fromMiss);

  const digits = PartialIso.of(
    (value: string): Result<number, 'not digits'> =>
      /^(0|[1-9]\d*)$/.test(value)
        ? new Success(Number(value))
        : new Failure('not digits'),
    (value: number): Result<string, 'not a natural number'> =>
      Number.isInteger(value) && value >= 0
        ? new Success(String(value))
        : new Failure('not a natural number')
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('of', () => {
    it('must not call either function', () => {
      expect(PartialIso.of(toA, fromA)).toBeInstanceOf(PartialIso);
      expect(toA).not.toHaveBeenCalled();
      expect(fromA).not.toHaveBeenCalled();
    });

    it('must accept fallible morphisms', () => {
      const iso = PartialIso.of<symbol, symbol, unknown, unknown>(
        FallibleMorphism.of(toA),
        FallibleMorphism.of(fromA)
      );

      const forward = iso.to(input);
      const backward = iso.from(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      assert(forward.ok());
      expect(forward.value()).toBe(afterA);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
      assert(backward.ok());
      expect(backward.value()).toBe(beforeA);
    });

    it('must infer the types of both sides and both errors', () => {
      expectTypeOf(digits).toEqualTypeOf<
        PartialIso<string, number, 'not digits', 'not a natural number'>
      >();
    });
  });

  describe('to', () => {
    it('must call the forward function with the argument and succeed with its value as is', () => {
      const result = a.to(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fromA).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(afterA);
    });

    it('must return the failure of the forward function as is', () => {
      const result = miss.to(input);

      expect(toMiss).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(failure);
    });

    it('must propagate an error thrown by the forward function', () => {
      const error = new Error('Oops!');
      const iso = PartialIso.of<symbol, symbol, unknown, unknown>(() => {
        throw error;
      }, fromA);

      expect(() => iso.to(input)).toThrow(error);
    });

    it('must be invariant in both sides', () => {
      expectTypeOf<PartialIso<unknown, string, never, never>>().not.toExtend<
        PartialIso<string, string, never, never>
      >();
      expectTypeOf<PartialIso<string, unknown, never, never>>().not.toExtend<
        PartialIso<string, string, never, never>
      >();
    });

    it('must be covariant in both errors', () => {
      expectTypeOf<PartialIso<string, string, never, never>>().toExtend<
        PartialIso<string, string, string, string>
      >();
      expectTypeOf<PartialIso<string, string, string, string>>().not.toExtend<
        PartialIso<string, string, never, never>
      >();
    });
  });

  describe('from', () => {
    it('must call the backward function with the argument and succeed with its value as is', () => {
      const result = a.from(input);

      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
      expect(toA).not.toHaveBeenCalled();
      assert(result.ok());
      expect(result.value()).toBe(beforeA);
    });

    it('must return the failure of the backward function as is', () => {
      const result = miss.from(input);

      expect(fromMiss).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(failure);
    });

    it('must propagate an error thrown by the backward function', () => {
      const error = new Error('Oops!');
      const iso = PartialIso.of<symbol, symbol, unknown, unknown>(toA, () => {
        throw error;
      });

      expect(() => iso.from(input)).toThrow(error);
    });

    it('must go back to the value that went forward', () => {
      const forward = digits.to('42');

      assert(forward.ok());

      const backward = digits.from(forward.value());

      assert(backward.ok());
      expect(backward.value()).toBe('42');
    });

    it('must go forward to the value that went back', () => {
      const backward = digits.from(42);

      assert(backward.ok());

      const forward = digits.to(backward.value());

      assert(forward.ok());
      expect(forward.value()).toBe(42);
    });

    it('must fail in either direction for a value outside its domain', () => {
      const forward = digits.to('x');
      const backward = digits.from(-1);

      assert(!forward.ok());
      expect(forward.error()).toBe('not digits');
      assert(!backward.ok());
      expect(backward.error()).toBe('not a natural number');
    });
  });

  describe('inverse', () => {
    it('must swap the forward and backward functions', () => {
      const inverse = a.inverse();

      const forward = inverse.to(input);
      const backward = inverse.from(input);

      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
      assert(forward.ok());
      expect(forward.value()).toBe(beforeA);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      assert(backward.ok());
      expect(backward.value()).toBe(afterA);
    });

    it('must not call either function', () => {
      expect(a.inverse()).toBeInstanceOf(PartialIso);
      expect(toA).not.toHaveBeenCalled();
      expect(fromA).not.toHaveBeenCalled();
    });

    it('must be an involution', () => {
      const iso = a.inverse().inverse();

      const forward = iso.to(input);
      const backward = iso.from(input);

      assert(forward.ok());
      expect(forward.value()).toBe(afterA);
      assert(backward.ok());
      expect(backward.value()).toBe(beforeA);
    });

    it('must swap the sides and the errors', () => {
      expectTypeOf(digits.inverse()).toEqualTypeOf<
        PartialIso<number, string, 'not a natural number', 'not digits'>
      >();
    });
  });

  describe('andThen', () => {
    it('must go forward through this first and then the next', () => {
      const result = a.andThen(b).to(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(toB).toHaveBeenCalledExactlyOnceWith(afterA);
      assert(result.ok());
      expect(result.value()).toBe(afterB);
    });

    it('must go backward through the next first and then this', () => {
      const result = a.andThen(b).from(input);

      expect(fromB).toHaveBeenCalledExactlyOnceWith(input);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(beforeB);
      assert(result.ok());
      expect(result.value()).toBe(beforeA);
    });

    it('must return the failure of this forward as is without calling the next', () => {
      const result = miss.andThen(b).to(input);

      expect(toB).not.toHaveBeenCalled();
      expect(result).toBe(failure);
    });

    it('must return the failure of the next backward as is without calling this', () => {
      const result = a.andThen(miss).from(input);

      expect(fromA).not.toHaveBeenCalled();
      expect(result).toBe(failure);
    });

    it.each([
      ['left-nested', () => a.andThen(b).andThen(c)],
      ['right-nested', () => a.andThen(b.andThen(c))],
    ])('must apply a %s chain in order in both directions', (_, chain) => {
      const iso = chain();

      const forward = iso.to(input);
      const backward = iso.from(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(toB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(toC).toHaveBeenCalledExactlyOnceWith(afterB);
      assert(forward.ok());
      expect(forward.value()).toBe(afterC);
      expect(fromC).toHaveBeenCalledExactlyOnceWith(input);
      expect(fromB).toHaveBeenCalledExactlyOnceWith(beforeC);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(beforeB);
      assert(backward.ok());
      expect(backward.value()).toBe(beforeA);
    });

    it('must not call any function before the composition is applied', () => {
      expect(a.andThen(b)).toBeInstanceOf(PartialIso);
      expect(toA).not.toHaveBeenCalled();
      expect(fromA).not.toHaveBeenCalled();
      expect(toB).not.toHaveBeenCalled();
      expect(fromB).not.toHaveBeenCalled();
    });

    it('must widen both errors to the unions of the errors in each direction', () => {
      const even = PartialIso.of(
        (value: number): Result<number, 'odd'> =>
          value % 2 === 0 ? new Success(value) : new Failure('odd'),
        (value: number): Result<number, 'odd'> =>
          value % 2 === 0 ? new Success(value) : new Failure('odd')
      );

      expectTypeOf(digits.andThen(even)).toEqualTypeOf<
        PartialIso<
          string,
          number,
          'not digits' | 'odd',
          'odd' | 'not a natural number'
        >
      >();
    });

    it('must reject a next partial iso whose source does not match the target', () => {
      type AndThen = PartialIso<string, number, never, never>['andThen'];

      expectTypeOf<AndThen>().not.toExtend<
        (next: PartialIso<string, boolean, never, never>) => unknown
      >();
    });

    describe('when the chain is long', () => {
      const depth = 100_000;

      it.each([
        [
          'nested to the left',
          () =>
            Array.from({ length: depth }).reduce<
              PartialIso<number, number, never, never>
            >(acc => acc.andThen(PartialIso.id()), PartialIso.id()),
        ],
        [
          'nested to the right',
          () =>
            Array.from({ length: depth }).reduceRight<
              PartialIso<number, number, never, never>
            >(acc => PartialIso.id<number>().andThen(acc), PartialIso.id()),
        ],
      ])('must not overflow the stack when %s', (_, chain) => {
        const iso = chain();

        const forward = iso.to(1);
        const backward = iso.from(1);

        assert(forward.ok());
        expect(forward.value()).toBe(1);
        assert(backward.ok());
        expect(backward.value()).toBe(1);
      });
    });
  });

  describe('fromIso', () => {
    it('must go forward and backward with the iso and never fail', () => {
      const to = vi.fn(() => afterA);
      const from = vi.fn(() => beforeA);
      const iso = PartialIso.fromIso(Iso.of<symbol, symbol>(to, from));

      const forward = iso.to(input);
      const backward = iso.from(input);

      expect(to).toHaveBeenCalledExactlyOnceWith(input);
      assert(forward.ok());
      expect(forward.value()).toBe(afterA);
      expect(from).toHaveBeenCalledExactlyOnceWith(input);
      assert(backward.ok());
      expect(backward.value()).toBe(beforeA);
    });

    it('must not call either function', () => {
      const to = vi.fn(() => afterA);
      const from = vi.fn(() => beforeA);

      expect(
        PartialIso.fromIso(Iso.of<symbol, symbol>(to, from))
      ).toBeInstanceOf(PartialIso);
      expect(to).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    });

    it('must never fail in either direction', () => {
      expectTypeOf(
        PartialIso.fromIso(
          Iso.of(
            (value: string) => value.length,
            (value: number) => 'x'.repeat(value)
          )
        )
      ).toEqualTypeOf<PartialIso<string, number, never, never>>();
    });
  });

  describe('fromPrism', () => {
    it('must go forward with the preview and backward with the review', () => {
      const review = vi.fn(() => beforeA);
      const iso = PartialIso.fromPrism(
        Prism.of<symbol, symbol, unknown>(toA, review)
      );

      const forward = iso.to(input);
      const backward = iso.from(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      assert(forward.ok());
      expect(forward.value()).toBe(afterA);
      expect(review).toHaveBeenCalledExactlyOnceWith(input);
      assert(backward.ok());
      expect(backward.value()).toBe(beforeA);
    });

    it('must return the failure of the preview as is', () => {
      const iso = PartialIso.fromPrism(
        Prism.of<symbol, symbol, symbol>(
          toMiss,
          vi.fn(() => beforeA)
        )
      );

      expect(iso.to(input)).toBe(failure);
    });

    it('must not call either function', () => {
      const review = vi.fn(() => beforeA);

      expect(
        PartialIso.fromPrism(Prism.of<symbol, symbol, unknown>(toA, review))
      ).toBeInstanceOf(PartialIso);
      expect(toA).not.toHaveBeenCalled();
      expect(review).not.toHaveBeenCalled();
    });

    it('must keep the error of the preview and never fail backward', () => {
      expectTypeOf(
        PartialIso.fromPrism(
          Prism.fromPredicate(
            (value: string) => value !== '',
            () => 'empty'
          )
        )
      ).toEqualTypeOf<PartialIso<string, string, string, never>>();
    });
  });

  describe('id', () => {
    it('must return the argument as is in both directions', () => {
      const forward = PartialIso.id<symbol>().to(input);
      const backward = PartialIso.id<symbol>().from(input);

      assert(forward.ok());
      expect(forward.value()).toBe(input);
      assert(backward.ok());
      expect(backward.value()).toBe(input);
    });

    it.each([
      ['left', () => PartialIso.id<symbol>().andThen(a)],
      ['right', () => a.andThen(PartialIso.id())],
    ])('must be a %s identity for andThen', (_, composed) => {
      const iso = composed();

      const forward = iso.to(input);
      const backward = iso.from(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      assert(forward.ok());
      expect(forward.value()).toBe(afterA);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
      assert(backward.ok());
      expect(backward.value()).toBe(beforeA);
    });

    it('must never fail in either direction', () => {
      expectTypeOf(PartialIso.id<string>()).toEqualTypeOf<
        PartialIso<string, string, never, never>
      >();
    });
  });
});
