import { type Path, step } from './Path.js';
import { next } from './Pending.js';
import { Route, unpack } from './Route.js';
import { type Step } from './Step.js';

export class More<A, out B, out X> extends Route<B, X> {
  readonly #value: A;

  readonly #path: Path<A, B, X>;

  constructor(value: A, path: Path<A, B, X>) {
    super();

    this.#value = value;
    this.#path = path;
  }

  [next](): Step<B | X> {
    return this.#path[step](this.#value);
  }

  [unpack]<R>(continuation: <V>(value: V, path: Path<V, B, X>) => R): R {
    return continuation(this.#value, this.#path);
  }
}
