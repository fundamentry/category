import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Morphism } from '#project/morphism';

import { Lens } from './Lens.js';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Line {
  readonly start: Point;
  readonly end: Point;
}

describe('Lens', () => {
  const input = Symbol('input');
  const value = Symbol('value');
  const modified = Symbol('modified');
  const afterA = Symbol('after a');
  const afterB = Symbol('after b');
  const afterC = Symbol('after c');
  const beforeA = Symbol('before a');
  const beforeB = Symbol('before b');
  const beforeC = Symbol('before c');
  const getA = vi.fn(() => afterA);
  const getB = vi.fn(() => afterB);
  const getC = vi.fn(() => afterC);
  const setA = vi.fn((_: readonly [symbol, symbol]) => beforeA);
  const setB = vi.fn((_: readonly [symbol, symbol]) => beforeB);
  const setC = vi.fn((_: readonly [symbol, symbol]) => beforeC);
  const fn = vi.fn(() => modified);
  const a = Lens.of(Morphism.of(getA), Morphism.of(setA));
  const b = Lens.of(Morphism.of(getB), Morphism.of(setB));
  const c = Lens.of(Morphism.of(getC), Morphism.of(setC));

  const point: Point = { x: 1, y: 2 };
  const line: Line = { start: point, end: { x: 3, y: 4 } };
  const x = Lens.of(
    Morphism.of((source: Point) => source.x),
    Morphism.of(([source, focus]: readonly [Point, number]): Point => ({
      ...source,
      x: focus,
    }))
  );
  const start = Lens.of(
    Morphism.of((source: Line) => source.start),
    Morphism.of(([source, focus]: readonly [Line, Point]): Line => ({
      ...source,
      start: focus,
    }))
  );
  const increment = Morphism.of((focus: number) => focus + 1);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('of', () => {
    it('must not call either function', () => {
      expect(Lens.of(Morphism.of(getA), Morphism.of(setA))).toBeInstanceOf(
        Lens
      );
      expect(getA).not.toHaveBeenCalled();
      expect(setA).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('must call the get function with the argument and return its result as is', () => {
      const result = a.get(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(setA).not.toHaveBeenCalled();
      expect(result).toBe(afterA);
    });

    it('must be invariant in its source', () => {
      expectTypeOf<Lens<unknown, string>>().not.toExtend<
        Lens<string, string>
      >();
      expectTypeOf<Lens<string, string>>().not.toExtend<
        Lens<unknown, string>
      >();
    });

    it('must be invariant in its focus', () => {
      expectTypeOf<Lens<string, unknown>>().not.toExtend<
        Lens<string, string>
      >();
      expectTypeOf<Lens<string, string>>().not.toExtend<
        Lens<string, unknown>
      >();
    });
  });

  describe('set', () => {
    it('must call the set function with the source and the value and return its result as is', () => {
      const result = a.set(input, value);

      expect(setA).toHaveBeenCalledExactlyOnceWith([input, value]);
      expect(result).toBe(beforeA);
    });

    it('must get back the value it set', () => {
      expect(x.get(x.set(point, 9))).toBe(9);
    });

    it('must leave the source unchanged when setting the value it gets', () => {
      expect(x.set(point, x.get(point))).toEqual(point);
    });

    it('must keep only the last of two sets', () => {
      expect(x.set(x.set(point, 8), 9)).toEqual(x.set(point, 9));
    });
  });

  describe('modify', () => {
    it('must get the focus, apply the morphism and set its result', () => {
      const result = a.modify(Morphism.of(fn)).apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(setA).toHaveBeenCalledExactlyOnceWith([input, modified]);
      expect(result).toBe(beforeA);
    });

    it('must not call any function before it is applied', () => {
      expect(a.modify(Morphism.of(fn))).toBeInstanceOf(Morphism);
      expect(getA).not.toHaveBeenCalled();
      expect(setA).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    it('must leave the source unchanged when modified with identity', () => {
      expect(x.modify(Morphism.id()).apply(point)).toEqual(point);
    });

    it('must return a morphism from the source to itself', () => {
      expectTypeOf(x.modify(increment)).toEqualTypeOf<Morphism<Point, Point>>();
    });
  });

  describe('andThen', () => {
    it('must get through this lens first and then the next', () => {
      const result = a.andThen(b).get(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(getB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(result).toBe(afterB);
    });

    it('must modify the focus of the next lens within the focus of this one', () => {
      const result = a.andThen(b).modify(Morphism.of(fn)).apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(getB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterB);
      expect(setB).toHaveBeenCalledExactlyOnceWith([afterA, modified]);
      expect(setA).toHaveBeenCalledExactlyOnceWith([input, beforeB]);
      expect(result).toBe(beforeA);
    });

    it('must set through the next lens and then this', () => {
      const result = a.andThen(b).set(input, value);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(setB).toHaveBeenCalledExactlyOnceWith([afterA, value]);
      expect(setA).toHaveBeenCalledExactlyOnceWith([input, beforeB]);
      expect(result).toBe(beforeA);
    });

    it.each([
      ['left-nested', () => a.andThen(b).andThen(c)],
      ['right-nested', () => a.andThen(b.andThen(c))],
    ])('must get and modify a %s chain in order', (_, chain) => {
      const lens = chain();

      expect(lens.get(input)).toBe(afterC);
      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(getB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(getC).toHaveBeenCalledExactlyOnceWith(afterB);

      vi.clearAllMocks();

      expect(lens.modify(Morphism.of(fn)).apply(input)).toBe(beforeA);
      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(getB).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(getC).toHaveBeenCalledExactlyOnceWith(afterB);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterC);
      expect(setC).toHaveBeenCalledExactlyOnceWith([afterB, modified]);
      expect(setB).toHaveBeenCalledExactlyOnceWith([afterA, beforeC]);
      expect(setA).toHaveBeenCalledExactlyOnceWith([input, beforeB]);
    });

    it('must not call any function before the composition is applied', () => {
      expect(a.andThen(b)).toBeInstanceOf(Lens);
      expect(getA).not.toHaveBeenCalled();
      expect(setA).not.toHaveBeenCalled();
      expect(getB).not.toHaveBeenCalled();
      expect(setB).not.toHaveBeenCalled();
    });

    it('must remain lawful when composing lawful lenses', () => {
      const startX = start.andThen(x);

      expect(startX.get(startX.set(line, 9))).toBe(9);
      expect(startX.set(line, startX.get(line))).toEqual(line);
      expect(startX.set(startX.set(line, 8), 9)).toEqual(startX.set(line, 9));
    });

    it('must infer the source of this lens and the focus of the next', () => {
      expectTypeOf(start.andThen(x)).toEqualTypeOf<Lens<Line, number>>();
    });

    describe('when the chain is long', () => {
      const depth = 100_000;

      it('must not overflow the stack when nested to the right', () => {
        const composed = Array.from({ length: depth }).reduceRight<
          Lens<number, number>
        >(acc => Lens.id<number>().andThen(acc), Lens.id());

        expect(composed.get(1)).toBe(1);
        expect(composed.set(1, 2)).toBe(2);
        expect(composed.modify(increment).apply(1)).toBe(2);
      });

      it('must not overflow the stack when nested to the left', () => {
        const composed = Array.from({ length: depth }).reduce<
          Lens<number, number>
        >(acc => acc.andThen(Lens.id()), Lens.id());

        expect(composed.get(1)).toBe(1);
        expect(composed.set(1, 2)).toBe(2);
        expect(composed.modify(increment).apply(1)).toBe(2);
      });
    });
  });

  describe('id', () => {
    it('must get the source as is and set by replacing it', () => {
      expect(Lens.id<symbol>().get(input)).toBe(input);
      expect(Lens.id<symbol>().set(input, value)).toBe(value);
    });

    it('must be a left identity for andThen', () => {
      const result = Lens.id<symbol>()
        .andThen(a)
        .modify(Morphism.of(fn))
        .apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(setA).toHaveBeenCalledExactlyOnceWith([input, modified]);
      expect(result).toBe(beforeA);
    });

    it('must be a right identity for andThen', () => {
      const result = a.andThen(Lens.id()).modify(Morphism.of(fn)).apply(input);

      expect(getA).toHaveBeenCalledExactlyOnceWith(input);
      expect(fn).toHaveBeenCalledExactlyOnceWith(afterA);
      expect(setA).toHaveBeenCalledExactlyOnceWith([input, modified]);
      expect(result).toBe(beforeA);
    });

    it('must have the same source and focus', () => {
      expectTypeOf(Lens.id<Point>()).toEqualTypeOf<Lens<Point, Point>>();
    });
  });
});
