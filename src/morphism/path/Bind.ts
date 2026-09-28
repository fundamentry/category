import { Concat } from './Concat.js';
import { More } from './More.js';
import { Path, step, stepThen } from './Path.js';
import { type Route, unpack } from './Route.js';
import { type Step } from './Step.js';

export class Bind<in A, out B, out X> extends Path<A, B, X> {
  readonly #router: (a: A) => Route<B, X>;

  constructor(router: (a: A) => Route<B, X>) {
    super();

    this.#router = router;
  }

  [step](a: A): Route<B, X> {
    return this.#router(a);
  }

  [stepThen]<C, Y>(a: A, rest: Path<B, C, Y>): Step<C | X | Y> {
    return this[step](a)[unpack]<Step<C | X | Y>>(
      <V>(value: V, path: Path<V, B, X>) =>
        new More(value, new Concat<V, B, C, X | Y>(path, rest))
    );
  }
}
