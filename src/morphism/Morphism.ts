import { type Either, Left, Right } from '@fundamentry/coproduct';

import {
  Bind,
  Concat,
  More,
  Single,
  type Path,
  type Route,
} from '#project/morphism/path';

export const pathOf: unique symbol = Symbol('pathOf');

export class Morphism<in A, out B> {
  readonly [pathOf]: Path<A, B, never>;

  readonly #apply: (a: A) => B;

  private constructor(path: Path<A, B, never>, apply?: (a: A) => B) {
    this[pathOf] = path;
    this.#apply = apply ?? (a => path.apply(a));
  }

  static of<A, B>(fn: (a: A) => B): Morphism<A, B> {
    return new Morphism(new Single(fn), fn);
  }

  static id<A>(): Morphism<A, A> {
    return Morphism.of(a => a);
  }

  apply(a: A): B {
    return this.#apply(a);
  }

  andThen<C>(next: Morphism<B, C>): Morphism<A, C> {
    return new Morphism(new Concat(this[pathOf], next[pathOf]));
  }

  fanout<C>(other: Morphism<A, C>): Morphism<A, readonly [B, C]> {
    return Morphism.of((a: A): readonly [A, A] => [a, a]).andThen(
      this.split(other)
    );
  }

  split<C, D>(
    other: Morphism<C, D>
  ): Morphism<readonly [A, C], readonly [B, D]> {
    return new Morphism(
      new Bind(
        ([a, c]) =>
          new More(
            a,
            new Concat(
              this[pathOf],
              new Bind(
                b =>
                  new More(
                    c,
                    new Concat(other[pathOf], new Single(d => [b, d] as const))
                  )
              )
            )
          )
      )
    );
  }

  choice<C, D>(other: Morphism<C, D>): Morphism<Either<A, C>, Either<B, D>> {
    return this.andThen(Morphism.of(b => new Left(b))).fanin(
      other.andThen(Morphism.of(d => new Right(d)))
    );
  }

  fanin<C, D>(other: Morphism<C, D>): Morphism<Either<A, C>, B | D> {
    return new Morphism(
      new Bind(either =>
        either.match<Route<B | D, never>>({
          onLeft: a => new More(a, this[pathOf]),
          onRight: c => new More(c, other[pathOf]),
        })
      )
    );
  }
}
