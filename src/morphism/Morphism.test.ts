import {
  assert,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

import { type Either, Left, Right } from '@fundamentry/coproduct';

import { Morphism } from './Morphism.js';

describe('Morphism', () => {
  const input = Symbol('input');
  const afterA = Symbol('after a');
  const afterB = Symbol('after b');
  const afterC = Symbol('after c');
  const fa = vi.fn(() => afterA);
  const fb = vi.fn(() => afterB);
  const fc = vi.fn(() => afterC);
  const a = Morphism.of(fa);
  const b = Morphism.of(fb);
  const c = Morphism.of(fc);

  const length = Morphism.of((value: string) => value.length);
  const negate = Morphism.of((value: number) => -value);
  const double = Morphism.of((value: number) => value * 2);
  const isZero = Morphism.of((value: number) => value === 0);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('of', () => {
    it('must not call the function', () => {
      const fn = vi.fn();

      expect(Morphism.of(fn)).toBeInstanceOf(Morphism);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('apply', () => {
    it('must call the function with the argument and return its result as is', () => {
      const result = a.apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(afterA);
    });

    it('must call the function again on every application', () => {
      const first = Symbol('first');
      const second = Symbol('second');
      const fn = vi.fn((value: symbol) => value);
      const morphism = Morphism.of(fn);

      expect(morphism.apply(first)).toBe(first);
      expect(morphism.apply(second)).toBe(second);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, first);
      expect(fn).toHaveBeenNthCalledWith(2, second);
    });

    it('must propagate an error thrown by the function', () => {
      const error = new Error('Oops!');
      const morphism = Morphism.of(() => {
        throw error;
      });

      expect(() => morphism.apply(input)).toThrow(error);
    });

    it('must be contravariant in its domain', () => {
      expectTypeOf<Morphism<unknown, string>>().toExtend<
        Morphism<string, string>
      >();
      expectTypeOf<Morphism<string, string>>().not.toExtend<
        Morphism<unknown, string>
      >();
    });

    it('must be covariant in its codomain', () => {
      expectTypeOf<Morphism<string, string>>().toExtend<
        Morphism<string, unknown>
      >();
      expectTypeOf<Morphism<string, unknown>>().not.toExtend<
        Morphism<string, string>
      >();
    });
  });

  describe('andThen', () => {
    it('must apply this morphism first and pass its result to the next', () => {
      const result = a.andThen(b).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(result).toBe(afterB);
    });

    it.each([
      ['left-nested', () => a.andThen(b).andThen(c)],
      ['right-nested', () => a.andThen(b.andThen(c))],
    ])('must apply a %s chain in order', (_, chain) => {
      const result = chain().apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fc).toHaveBeenCalledExactlyOnceWith(afterB);
      expect(result).toBe(afterC);
    });

    it('must not call either function before the composition is applied', () => {
      expect(a.andThen(b)).toBeInstanceOf(Morphism);
      expect(fa).not.toHaveBeenCalled();
      expect(fb).not.toHaveBeenCalled();
    });

    it('must not call the next function when this function throws', () => {
      const error = new Error('Oops!');

      const composed = Morphism.of(() => {
        throw error;
      }).andThen(b);

      expect(() => composed.apply(input)).toThrow(error);
      expect(fb).not.toHaveBeenCalled();
    });

    describe('when the chain is long', () => {
      const count = 100_000;
      const increment = Morphism.of((value: number) => value + 1);
      const steps = Array.from({ length: count }, () => increment);

      it('must not overflow the stack when composed from the left', () => {
        const composed = steps.reduce(
          (acc, step) => acc.andThen(step),
          Morphism.id<number>()
        );

        expect(composed.apply(0)).toBe(count);
      });

      it('must not overflow the stack when composed from the right', () => {
        const composed = steps.reduceRight(
          (acc, step) => step.andThen(acc),
          Morphism.id<number>()
        );

        expect(composed.apply(0)).toBe(count);
      });

      it('must not overflow the stack when joining two long chains', () => {
        const chain = steps.reduce(
          (acc, step) => acc.andThen(step),
          Morphism.id<number>()
        );

        expect(chain.andThen(chain).apply(0)).toBe(2 * count);
      });
    });

    it('must infer the domain of this morphism and the codomain of the next', () => {
      expectTypeOf(length.andThen(isZero)).toEqualTypeOf<
        Morphism<string, boolean>
      >();
    });

    it('must reject a next morphism whose domain does not match the codomain', () => {
      type Next = Parameters<Morphism<string, number>['andThen']>[0];

      expectTypeOf<Next>().toEqualTypeOf<Morphism<number, unknown>>();
      expectTypeOf<Morphism<string, string>>().not.toExtend<Next>();
    });
  });

  describe('fanout', () => {
    it('must apply both morphisms to the same argument and pair their results as is', () => {
      const result = a.fanout(b).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toEqual([afterA, afterB]);
    });

    it('must not call either function before it is applied', () => {
      expect(a.fanout(b)).toBeInstanceOf(Morphism);
      expect(fa).not.toHaveBeenCalled();
      expect(fb).not.toHaveBeenCalled();
    });

    it('must propagate an error thrown by either function', () => {
      const error = new Error('Oops!');
      const failing = Morphism.of(() => {
        throw error;
      });

      expect(() => failing.fanout(b).apply(input)).toThrow(error);
      expect(() => a.fanout(failing).apply(input)).toThrow(error);
    });

    it('must pair the domain with the codomains of both morphisms', () => {
      expectTypeOf(length.fanout(length.andThen(isZero))).toEqualTypeOf<
        Morphism<string, readonly [number, boolean]>
      >();
    });
  });

  describe('split', () => {
    const first = Symbol('first');
    const second = Symbol('second');

    it('must apply each morphism to its own side of the pair and pair their results as is', () => {
      const result = a.split(b).apply([first, second]);

      expect(fa).toHaveBeenCalledExactlyOnceWith(first);
      expect(fb).toHaveBeenCalledExactlyOnceWith(second);
      expect(result).toEqual([afterA, afterB]);
    });

    it('must leave a side unchanged when split with identity', () => {
      const result = a.split(Morphism.id<symbol>()).apply([first, second]);

      expect(result).toEqual([afterA, second]);
    });

    it('must distribute over andThen', () => {
      const composed = double.andThen(negate).split(negate.andThen(double));
      const distributed = double.split(negate).andThen(negate.split(double));

      expect(composed.apply([1, 2])).toEqual(distributed.apply([1, 2]));
    });

    it('must not call either function before it is applied', () => {
      expect(a.split(b)).toBeInstanceOf(Morphism);
      expect(fa).not.toHaveBeenCalled();
      expect(fb).not.toHaveBeenCalled();
    });

    it('must propagate an error thrown by either function', () => {
      const error = new Error('Oops!');
      const failing = Morphism.of(() => {
        throw error;
      });

      expect(() => failing.split(b).apply([first, second])).toThrow(error);
      expect(() => a.split(failing).apply([first, second])).toThrow(error);
    });

    it('must pair the domains and the codomains of both morphisms', () => {
      expectTypeOf(length.split(isZero)).toEqualTypeOf<
        Morphism<readonly [string, number], readonly [number, boolean]>
      >();
    });
  });

  describe('choice', () => {
    it('must apply this morphism to a left and keep its result as is in a left', () => {
      const result = a.choice(b).apply(new Left(input));

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).not.toHaveBeenCalled();
      assert(result.isLeft());
      expect(result.left()).toBe(afterA);
    });

    it('must apply the other morphism to a right and keep its result as is in a right', () => {
      const result = a.choice(b).apply(new Right(input));

      expect(fb).toHaveBeenCalledExactlyOnceWith(input);
      expect(fa).not.toHaveBeenCalled();
      assert(result.isRight());
      expect(result.right()).toBe(afterB);
    });

    it('must not call either function before it is applied', () => {
      expect(a.choice(b)).toBeInstanceOf(Morphism);
      expect(fa).not.toHaveBeenCalled();
      expect(fb).not.toHaveBeenCalled();
    });

    it('must map both sides of the either', () => {
      expectTypeOf(length.choice(isZero)).toEqualTypeOf<
        Morphism<Either<string, number>, Either<number, boolean>>
      >();
    });
  });

  describe('fanin', () => {
    it('must apply this morphism to a left and return its result as is', () => {
      const result = a.fanin(b).apply(new Left(input));

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).not.toHaveBeenCalled();
      expect(result).toBe(afterA);
    });

    it('must apply the other morphism to a right and return its result as is', () => {
      const result = a.fanin(b).apply(new Right(input));

      expect(fb).toHaveBeenCalledExactlyOnceWith(input);
      expect(fa).not.toHaveBeenCalled();
      expect(result).toBe(afterB);
    });

    it('must rejoin the branches of a choice', () => {
      const merged = double
        .choice(negate)
        .andThen(Morphism.id<number>().fanin(Morphism.id<number>()));

      expect(merged.apply(new Left(3))).toBe(
        double.fanin(negate).apply(new Left(3))
      );
      expect(merged.apply(new Right(3))).toBe(
        double.fanin(negate).apply(new Right(3))
      );
    });

    it('must not call either function before it is applied', () => {
      expect(a.fanin(b)).toBeInstanceOf(Morphism);
      expect(fa).not.toHaveBeenCalled();
      expect(fb).not.toHaveBeenCalled();
    });

    it('must propagate an error thrown by either function', () => {
      const error = new Error('Oops!');
      const failing = Morphism.of(() => {
        throw error;
      });

      expect(() => failing.fanin(b).apply(new Left(input))).toThrow(error);
      expect(() => a.fanin(failing).apply(new Right(input))).toThrow(error);
    });

    it('must return the union of both codomains', () => {
      expectTypeOf(length.fanin(isZero)).toEqualTypeOf<
        Morphism<Either<string, number>, number | boolean>
      >();
    });
  });

  describe('when combinators are nested deeply', () => {
    const depth = 100_000;
    const increment = Morphism.of((value: number) => value + 1);
    const first = Morphism.of(([value]: readonly [number, unknown]) => value);
    const toPair = Morphism.of((value: number): readonly [number, number] => [
      value,
      0,
    ]);
    const toLeft = Morphism.of(
      (value: number): Either<number, number> => new Left(value)
    );
    const fromEither = Morphism.of((either: Either<number, number>) =>
      either.match({ onLeft: value => value, onRight: value => value })
    );

    const nest = (
      wrap: (inner: Morphism<number, number>) => Morphism<number, number>
    ) =>
      Array.from({ length: depth }).reduce<Morphism<number, number>>(
        inner => wrap(inner),
        increment
      );

    it('must not overflow the stack with fanout', () => {
      const nested = nest(inner => inner.fanout(Morphism.id()).andThen(first));

      expect(nested.apply(0)).toBe(1);
    });

    it('must not overflow the stack with split', () => {
      const nested = nest(inner =>
        toPair.andThen(inner.split(Morphism.id())).andThen(first)
      );

      expect(nested.apply(0)).toBe(1);
    });

    it('must not overflow the stack with choice', () => {
      const nested = nest(inner =>
        toLeft.andThen(inner.choice(Morphism.id())).andThen(fromEither)
      );

      expect(nested.apply(0)).toBe(1);
    });

    it('must not overflow the stack with fanin', () => {
      const nested = nest(inner => toLeft.andThen(inner.fanin(Morphism.id())));

      expect(nested.apply(0)).toBe(1);
    });
  });

  describe('id', () => {
    it('must return the argument as is', () => {
      expect(Morphism.id<symbol>().apply(input)).toBe(input);
    });

    it('must be a left identity for andThen', () => {
      const result = Morphism.id<symbol>().andThen(a).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(afterA);
    });

    it('must be a right identity for andThen', () => {
      const result = a.andThen(Morphism.id()).apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toBe(afterA);
    });

    it('must serve as the seed when folding a sequence of morphisms', () => {
      const composed = [a, b, c].reduce(
        (acc, step) => acc.andThen(step),
        Morphism.id<symbol>()
      );

      const result = composed.apply(input);

      expect(fa).toHaveBeenCalledExactlyOnceWith(input);
      expect(fb).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fc).toHaveBeenCalledExactlyOnceWith(afterB);
      expect(result).toBe(afterC);
    });

    it('must have the same domain and codomain', () => {
      expectTypeOf(Morphism.id<symbol>()).toEqualTypeOf<
        Morphism<symbol, symbol>
      >();
    });
  });
});
