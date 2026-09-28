import { Done } from './Done.js';
import { More } from './More.js';
import { Path, step, stepThen } from './Path.js';
import { type Step } from './Step.js';

export class Single<in A, out B> extends Path<A, B, never> {
  readonly #fn: (a: A) => B;

  constructor(fn: (a: A) => B) {
    super();

    this.#fn = fn;
  }

  [step](a: A): Step<B> {
    return new Done(this.#fn(a));
  }

  [stepThen]<C, Y>(a: A, rest: Path<B, C, Y>): Step<C | Y> {
    return new More(this.#fn(a), rest);
  }
}
