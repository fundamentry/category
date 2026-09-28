import { value } from './Done.js';
import { next, Pending } from './Pending.js';
import { type Step } from './Step.js';

export const step: unique symbol = Symbol('step');

export const stepThen: unique symbol = Symbol('stepThen');

declare const types: unique symbol;

export abstract class Path<in A, out B, out X> {
  declare readonly [types]?: { readonly value: B; readonly exit: X };

  apply(a: A): B | X {
    let current = this[step](a);

    while (current instanceof Pending) current = current[next]();

    return current[value]();
  }

  abstract [step](a: A): Step<B | X>;

  abstract [stepThen]<C, Y>(a: A, rest: Path<B, C, Y>): Step<C | X | Y>;
}
