import { More } from './More.js';
import { Path, step, stepThen } from './Path.js';
import { type Step } from './Step.js';

export class Concat<in A, B, out C, out X> extends Path<A, C, X> {
  readonly #prefix: Path<A, B, X>;

  readonly #suffix: Path<B, C, X>;

  constructor(prefix: Path<A, B, X>, suffix: Path<B, C, X>) {
    super();

    this.#prefix = prefix;
    this.#suffix = suffix;
  }

  [step](a: A): Step<C | X> {
    return this.#prefix[stepThen](a, this.#suffix);
  }

  [stepThen]<D, Y>(a: A, rest: Path<C, D, Y>): Step<D | X | Y> {
    return new More(
      a,
      new Concat<A, B, D, X | Y>(
        this.#prefix,
        new Concat<B, C, D, X | Y>(this.#suffix, rest)
      )
    );
  }
}
