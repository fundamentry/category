import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { type Lens } from '#project/lens';
import { Morphism } from '#project/morphism';

import { Iso } from './Iso.js';

describe('Iso', () => {
  const input = Symbol('input');
  const afterA = Symbol('after a');
  const afterB = Symbol('after b');
  const afterC = Symbol('after c');
  const beforeA = Symbol('before a');
  const beforeB = Symbol('before b');
  const beforeC = Symbol('before c');
  const toA = vi.fn(() => afterA);
  const toB = vi.fn(() => afterB);
  const toC = vi.fn(() => afterC);
  const fromA = vi.fn(() => beforeA);
  const fromB = vi.fn(() => beforeB);
  const fromC = vi.fn(() => beforeC);
  const a = Iso.of(Morphism.of(toA), Morphism.of(fromA));
  const b = Iso.of(Morphism.of(toB), Morphism.of(fromB));
  const c = Iso.of(Morphism.of(toC), Morphism.of(fromC));

  const double = Iso.of(
    Morphism.of((value: number) => value * 2),
    Morphism.of((value: number) => value / 2)
  );
  const increment = Iso.of(
    Morphism.of((value: number) => value + 1),
    Morphism.of((value: number) => value - 1)
  );
  const length = Iso.of(
    Morphism.of((value: string) => value.length),
    Morphism.of((value: number) => 'x'.repeat(value))
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('of', () => {
    it('must not call either function', () => {
      const to = vi.fn();
      const from = vi.fn();

      expect(Iso.of(Morphism.of(to), Morphism.of(from))).toBeInstanceOf(Iso);
      expect(to).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe('of with functions', () => {
    it('must go forward and backward with the functions as is', () => {
      const iso = Iso.of(toA, fromA);

      expect(iso.to(input)).toBe(afterA);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(iso.from(input)).toBe(beforeA);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must not call either function', () => {
      expect(Iso.of(toA, fromA)).toBeInstanceOf(Iso);
      expect(toA).not.toHaveBeenCalled();
      expect(fromA).not.toHaveBeenCalled();
    });

    it('must infer the source and target types', () => {
      expectTypeOf(
        Iso.of(
          (value: string) => value.length,
          (value: number) => 'x'.repeat(value)
        )
      ).toEqualTypeOf<Iso<string, number>>();
    });
  });

  describe('to', () => {
    it('must call the forward function with the argument and return its result as is', () => {
      const result = a.to(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fromA).not.toHaveBeenCalled();
      expect(result).toBe(afterA);
    });

    it('must propagate an error thrown by the forward function', () => {
      const error = new Error('Oops!');
      const iso = Iso.of(
        Morphism.of(() => {
          throw error;
        }),
        Morphism.id()
      );

      expect(() => iso.to(input)).toThrow(error);
    });

    it('must be invariant in its source', () => {
      expectTypeOf<Iso<unknown, string>>().not.toExtend<Iso<string, string>>();
      expectTypeOf<Iso<string, string>>().not.toExtend<Iso<unknown, string>>();
    });

    it('must be invariant in its target', () => {
      expectTypeOf<Iso<string, unknown>>().not.toExtend<Iso<string, string>>();
      expectTypeOf<Iso<string, string>>().not.toExtend<Iso<string, unknown>>();
    });
  });

  describe('from', () => {
    it('must call the backward function with the argument and return its result as is', () => {
      const result = a.from(input);

      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
      expect(toA).not.toHaveBeenCalled();
      expect(result).toBe(beforeA);
    });

    it('must propagate an error thrown by the backward function', () => {
      const error = new Error('Oops!');
      const iso = Iso.of(
        Morphism.id(),
        Morphism.of(() => {
          throw error;
        })
      );

      expect(() => iso.from(input)).toThrow(error);
    });
  });

  describe('inverse', () => {
    it('must swap the forward and backward functions', () => {
      const inverse = a.inverse();

      expect(inverse.to(input)).toBe(beforeA);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
      expect(inverse.from(input)).toBe(afterA);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must not call either function', () => {
      expect(a.inverse()).toBeInstanceOf(Iso);
      expect(toA).not.toHaveBeenCalled();
      expect(fromA).not.toHaveBeenCalled();
    });

    it('must be an involution', () => {
      const iso = a.inverse().inverse();

      expect(iso.to(input)).toBe(afterA);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(iso.from(input)).toBe(beforeA);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must swap the source and target types', () => {
      expectTypeOf(length.inverse()).toEqualTypeOf<Iso<number, string>>();
    });
  });

  describe('andThen', () => {
    it('must apply this iso first and then the next when going forward', () => {
      const result = a.andThen(b).to(input);

      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(toB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(result).toBe(afterB);
    });

    it('must apply the next iso first and then this when going backward', () => {
      const result = a.andThen(b).from(input);

      expect(fromB).toHaveBeenCalledExactlyOnceWith(input);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(beforeB);
      expect(result).toBe(beforeA);
    });

    it.each([
      ['left-nested', () => a.andThen(b).andThen(c)],
      ['right-nested', () => a.andThen(b.andThen(c))],
    ])('must apply a %s chain in order in both directions', (_, chain) => {
      const iso = chain();

      expect(iso.to(input)).toBe(afterC);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(toB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(toC).toHaveBeenCalledExactlyOnceWith(afterB);

      expect(iso.from(input)).toBe(beforeA);
      expect(fromC).toHaveBeenCalledExactlyOnceWith(input);
      expect(fromB).toHaveBeenCalledExactlyOnceWith(beforeC);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(beforeB);
    });

    it('must not call any function before the composition is applied', () => {
      expect(a.andThen(b)).toBeInstanceOf(Iso);
      expect(toA).not.toHaveBeenCalled();
      expect(fromA).not.toHaveBeenCalled();
      expect(toB).not.toHaveBeenCalled();
      expect(fromB).not.toHaveBeenCalled();
    });

    it('must remain lawful when composing lawful isos', () => {
      const composed = double.andThen(increment);

      expect(composed.from(composed.to(3))).toBe(3);
      expect(composed.to(composed.from(7))).toBe(7);
    });

    it('must have the reversed composition of inverses as its inverse', () => {
      const inverse = double.andThen(increment).inverse();
      const reversed = increment.inverse().andThen(double.inverse());

      expect(inverse.to(7)).toBe(reversed.to(7));
      expect(inverse.from(3)).toBe(reversed.from(3));
    });

    it('must infer the source of this iso and the target of the next', () => {
      expectTypeOf(length.andThen(double)).toEqualTypeOf<Iso<string, number>>();
    });

    it('must reject a next optic whose source does not match the target', () => {
      type AndThen = Iso<string, number>['andThen'];

      expectTypeOf<AndThen>().toExtend<
        (next: Iso<number, boolean>) => Iso<string, boolean>
      >();
      expectTypeOf<AndThen>().not.toExtend<
        (next: Iso<string, boolean>) => unknown
      >();
      expectTypeOf<AndThen>().not.toExtend<
        (next: Lens<string, boolean>) => unknown
      >();
    });
  });

  describe('id', () => {
    it('must return the argument as is in both directions', () => {
      expect(Iso.id<symbol>().to(input)).toBe(input);
      expect(Iso.id<symbol>().from(input)).toBe(input);
    });

    it('must be a left identity for andThen', () => {
      const composed = Iso.id<symbol>().andThen(a);

      expect(composed.to(input)).toBe(afterA);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(composed.from(input)).toBe(beforeA);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must be a right identity for andThen', () => {
      const composed = a.andThen(Iso.id());

      expect(composed.to(input)).toBe(afterA);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(composed.from(input)).toBe(beforeA);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(input);
    });

    it('must be its own inverse', () => {
      const inverse = Iso.id<symbol>().inverse();

      expect(inverse.to(input)).toBe(input);
      expect(inverse.from(input)).toBe(input);
    });

    it('must serve as the seed when folding a sequence of isos', () => {
      const composed = [a, b, c].reduce(
        (acc, step) => acc.andThen(step),
        Iso.id<symbol>()
      );

      expect(composed.to(input)).toBe(afterC);
      expect(toA).toHaveBeenCalledExactlyOnceWith(input);
      expect(toB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(toC).toHaveBeenCalledExactlyOnceWith(afterB);

      expect(composed.from(input)).toBe(beforeA);
      expect(fromC).toHaveBeenCalledExactlyOnceWith(input);
      expect(fromB).toHaveBeenCalledExactlyOnceWith(beforeC);
      expect(fromA).toHaveBeenCalledExactlyOnceWith(beforeB);
    });

    it('must have the same source and target', () => {
      expectTypeOf(Iso.id<symbol>()).toEqualTypeOf<Iso<symbol, symbol>>();
    });
  });
});
