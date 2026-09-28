import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Concat } from './Concat.js';
import { Done, value } from './Done.js';
import { type Path, step, stepThen } from './Path.js';
import { next, Pending } from './Pending.js';
import { Single } from './Single.js';

describe('Concat', () => {
  const input = Symbol('input');

  describe('constructor', () => {
    it('must not apply either path', () => {
      const f = vi.fn();
      const g = vi.fn();

      expect(new Concat(new Single(f), new Single(g))).toBeInstanceOf(Concat);
      expect(f).not.toHaveBeenCalled();
      expect(g).not.toHaveBeenCalled();
    });

    it('must infer the exit type of its paths', () => {
      const prefix: Path<symbol, symbol, never> = new Single(vi.fn());

      const path = new Concat(prefix, new Single((arg: symbol) => arg));

      expectTypeOf(path).toEqualTypeOf<Concat<symbol, symbol, symbol, never>>();
    });
  });

  describe('step', () => {
    it('must continue the prefix with the suffix and return its step as is', () => {
      const prefix = new Single(vi.fn());
      const suffix = new Single(vi.fn());
      const done = new Done(Symbol('output'));
      const prefixStepThen = vi.spyOn(prefix, stepThen).mockReturnValue(done);

      const result = new Concat(prefix, suffix)[step](input);

      expect(prefixStepThen).toHaveBeenCalledExactlyOnceWith(
        input,
        expect.any(Single)
      );
      expect(prefixStepThen.mock.lastCall?.[1]).toBe(suffix);
      expect(result).toBe(done);
    });
  });

  describe('stepThen', () => {
    it('must not step into the prefix in the first step', () => {
      const prefix = new Single(vi.fn());
      const prefixStep = vi.spyOn(prefix, step);
      const prefixStepThen = vi.spyOn(prefix, stepThen);

      const first = new Concat(prefix, new Single(vi.fn()))[stepThen](
        input,
        new Single(vi.fn())
      );

      expect(first).toBeInstanceOf(Pending);
      expect(prefixStep).not.toHaveBeenCalled();
      expect(prefixStepThen).not.toHaveBeenCalled();
    });

    it('must continue with the prefix, then the suffix, then the rest', () => {
      const afterPrefix = Symbol('after prefix');
      const afterSuffix = Symbol('after suffix');
      const output = Symbol('output');
      const prefix = vi.fn(() => afterPrefix);
      const suffix = vi.fn(() => afterSuffix);
      const rest = vi.fn(() => output);

      let current = new Concat(new Single(prefix), new Single(suffix))[
        stepThen
      ](input, new Single(rest));

      while (current instanceof Pending) current = current[next]();

      expect(prefix).toHaveBeenCalledExactlyOnceWith(input);
      expect(suffix).toHaveBeenCalledExactlyOnceWith(afterPrefix);
      expect(rest).toHaveBeenCalledExactlyOnceWith(afterSuffix);
      assert(current instanceof Done);
      expect(current[value]()).toBe(output);
    });
  });
});
