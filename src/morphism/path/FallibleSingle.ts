import { type Failure, type Result } from '@fundamentry/coproduct';

import { Done } from './Done.js';
import { More } from './More.js';
import { Path, step, stepThen } from './Path.js';
import { type Step } from './Step.js';

export class FallibleSingle<in A, out B, out E> extends Path<A, B, Failure<E>> {
  readonly #fn: (a: A) => Result<B, E>;

  constructor(fn: (a: A) => Result<B, E>) {
    super();

    this.#fn = fn;
  }

  [step](a: A): Step<B | Failure<E>> {
    const result = this.#fn(a);

    return new Done(result.ok() ? result.value() : result);
  }

  [stepThen]<C, Y>(a: A, rest: Path<B, C, Y>): Step<C | Failure<E> | Y> {
    const result = this.#fn(a);

    return result.ok() ? new More(result.value(), rest) : new Done(result);
  }
}
